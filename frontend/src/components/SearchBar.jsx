import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchPreviewPanel, WatchlistQuickAdd } from './search';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { useSearchStore } from '../stores/searchStore';
import api from '../api/client';

// Delay before showing preview panel (ms) - set to 0 for immediate show
const PREVIEW_DELAY = 0;

// Detect if user is on macOS
const isMac = () => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
};

// Generate unique ID for accessibility
const generateId = () => `search-${Math.random().toString(36).substr(2, 9)}`;

// Search filter options
const SEARCH_MODES = [
  { value: 'symbol', label: 'Symbol/Name', description: 'Search by ticker or company name' },
  { value: 'keyword', label: 'Keywords', description: 'Search by industry keywords (e.g., "technology", "bank")' },
];

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'Common Stock', label: 'Stocks' },
  { value: 'ETP', label: 'ETFs' },
];

// Format price for display
const formatPrice = (price) => {
  if (!price && price !== 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// Format change percentage
const formatChange = (change, percentChange) => {
  if (change === undefined || percentChange === undefined) return null;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)} (${sign}${percentChange.toFixed(2)}%)`;
};

const SearchBar = forwardRef(function SearchBar(props, ref) {
  const navigate = useNavigate();

  // Get search store actions via getState() - these are stable references (H3 fix)
  // Using getState() for actions avoids re-renders and effect dependency issues
  const searchStore = useCallback((...args) => useSearchStore.getState().search(...args), []);
  const fetchStoreSuggestions = useCallback((...args) => useSearchStore.getState().fetchSuggestions(...args), []);
  const fetchStoreRecentQuotes = useCallback(() => useSearchStore.getState().fetchRecentQuotes(), []);
  const addRecentSearch = useCallback((...args) => useSearchStore.getState().addRecentSearch(...args), []);

  // Subscribe to state that needs to trigger re-renders
  const storeRecentSearches = useSearchStore((state) => state.recentSearches);
  const storeRecentQuotes = useSearchStore((state) => state.recentQuotes);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState({ stocks: 0, etps: 0 });
  const [totalMatches, setTotalMatches] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredResult, setHoveredResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchMode, setSearchMode] = useState('symbol');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [suggestionHint, setSuggestionHint] = useState('');
  const [trendingStocks, setTrendingStocks] = useState([]);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const filterRef = useRef(null);
  const debounceTimer = useRef(null);
  const previewShowTimer = useRef(null);
  const previewHideTimer = useRef(null);
  const suggestionTimer = useRef(null);
  const [listboxId] = useState(() => generateId());

  // OS-specific keyboard shortcut for placeholder
  const shortcutHint = useMemo(() => (isMac() ? '⌘K' : 'Ctrl+K'), []);

  // Expose focus method for global keyboard shortcut
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  // Keyboard navigation hook
  const {
    activeIndex,
    activeItem,
    isItemActive,
    handleKeyDown: handleNavKeyDown,
    previewOpen: keyboardPreviewOpen,
  } = useKeyboardNavigation({
    items: results,
    isOpen: isOpen && results.length > 0,
    onSelect: (item) => {
      if (item) {
        handleSelectSymbol(item.symbol, item.description);
      }
    },
    onClose: () => {
      setIsOpen(false);
      inputRef.current?.blur();
    },
    onPreviewOpen: (item) => {
      setHoveredResult(item);
      setShowPreview(true);
    },
    onPreviewClose: () => {
      setShowPreview(false);
    },
    loop: true,
  });

  // Fetch quotes for recent searches when dropdown opens (using store)
  useEffect(() => {
    if (!isOpen || storeRecentSearches.length === 0 || query.trim().length > 0) {
      return;
    }
    fetchStoreRecentQuotes();
  }, [isOpen, storeRecentSearches, query, fetchStoreRecentQuotes]);

  // Fetch trending stocks for suggestions (100% dynamic from API)
  // N4 fix: Add cleanup for AbortController and unmount guard
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchTrending = async () => {
      try {
        const data = await api.get('/search/trending?limit=5', { signal: controller.signal });
        // Only update state if still mounted
        if (isMounted) {
          // Combine gainers (preferred) with most active as fallback
          const stocks = [...(data.gainers || []), ...(data.mostActive || [])]
            .slice(0, 5)
            .map(stock => ({
              symbol: stock.symbol,
              description: stock.description || stock.name || stock.symbol,
            }));
          setTrendingStocks(stocks);
        }
      } catch (err) {
        // N4 fix: Don't log warning for aborted requests
        if (err.name !== 'AbortError') {
          console.warn('Failed to fetch trending stocks:', err);
        }
        // Leave trendingStocks empty - no hardcoded fallback
      }
    };
    fetchTrending();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Handle click outside to close dropdown and filters
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search (using store)
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setCategories({ stocks: 0, etps: 0 });
      setTotalMatches(0);
      return;
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for 300ms
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchStore(query, {
          mode: searchMode,
          typeFilter,
          includeQuotes: true,
          limit: 10,
        });

        setResults(data.results || []);
        setCategories(data.categories || { stocks: 0, etps: 0 });
        setTotalMatches(data.totalMatches || 0);
        setIsOpen(true);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
        setCategories({ stocks: 0, etps: 0 });
        setTotalMatches(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, searchMode, typeFilter, searchStore]);

  // Fetch autocomplete suggestions for symbol-like queries (using store)
  useEffect(() => {
    // Only fetch suggestions in symbol mode and for uppercase-like queries
    if (searchMode !== 'symbol' || query.length < 1) {
      setSuggestionHint('');
      return;
    }

    // Check if query looks like a symbol prefix (uppercase letters)
    const isSymbolLike = /^[A-Z]+$/i.test(query);
    if (!isSymbolLike) {
      setSuggestionHint('');
      return;
    }

    // Clear previous timer
    if (suggestionTimer.current) {
      clearTimeout(suggestionTimer.current);
    }

    // Fetch suggestions quickly (100ms debounce)
    suggestionTimer.current = setTimeout(async () => {
      try {
        const data = await fetchStoreSuggestions(query.toUpperCase());
        const topSuggestion = data.suggestions?.[0];
        if (topSuggestion && topSuggestion.symbol.toUpperCase().startsWith(query.toUpperCase())) {
          // Show the rest of the symbol as a hint
          setSuggestionHint(topSuggestion.symbol.substring(query.length));
        } else {
          setSuggestionHint('');
        }
      } catch {
        // Silently fail - suggestions are optional
        setSuggestionHint('');
      }
    }, 100);

    return () => {
      if (suggestionTimer.current) {
        clearTimeout(suggestionTimer.current);
      }
    };
  }, [query, searchMode, fetchStoreSuggestions]);

  // Handle Tab key to accept suggestion
  const handleKeyDown = useCallback((e) => {
    // Accept suggestion with Tab
    if (e.key === 'Tab' && suggestionHint) {
      e.preventDefault();
      setQuery(query + suggestionHint);
      setSuggestionHint('');
      return;
    }
    // Pass to keyboard navigation handler
    handleNavKeyDown(e);
  }, [suggestionHint, query, handleNavKeyDown]);

  const handleSelectSymbol = (symbol, description) => {
    // Add to recent searches (using store - handles localStorage internally)
    addRecentSearch(symbol, description);

    // Navigate to stock page
    setQuery('');
    setIsOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    // Always open dropdown on focus to show trending stocks and/or recent searches
    setIsOpen(true);
  };

  // Handle hover on result item - show preview immediately
  const handleResultHover = useCallback((result) => {
    // Cancel any pending hide
    if (previewHideTimer.current) {
      clearTimeout(previewHideTimer.current);
      previewHideTimer.current = null;
    }

    // Set the hovered result and show preview immediately
    setHoveredResult(result);

    if (PREVIEW_DELAY > 0) {
      // Clear any existing show timer
      if (previewShowTimer.current) {
        clearTimeout(previewShowTimer.current);
      }
      previewShowTimer.current = setTimeout(() => {
        setShowPreview(true);
      }, PREVIEW_DELAY);
    } else {
      // Show immediately
      setShowPreview(true);
    }
  }, []);

  // Handle mouse leave from result item
  const handleResultLeave = useCallback(() => {
    // Clear any pending show timer
    if (previewShowTimer.current) {
      clearTimeout(previewShowTimer.current);
      previewShowTimer.current = null;
    }

    // Use a short delay before hiding to allow mouse to reach preview panel
    previewHideTimer.current = setTimeout(() => {
      setShowPreview(false);
      setHoveredResult(null);
    }, 150); // 150ms grace period to reach the preview panel
  }, []);

  // Clean up preview timers on unmount
  useEffect(() => {
    return () => {
      if (previewShowTimer.current) {
        clearTimeout(previewShowTimer.current);
      }
      if (previewHideTimer.current) {
        clearTimeout(previewHideTimer.current);
      }
    };
  }, []);

  // Clear preview when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setShowPreview(false);
      setHoveredResult(null);
    }
  }, [isOpen]);

  // Sync keyboard active item with hover/preview state
  useEffect(() => {
    if (activeItem && activeIndex >= 0) {
      setHoveredResult(activeItem);
      if (keyboardPreviewOpen) {
        setShowPreview(true);
      }
    }
  }, [activeItem, activeIndex, keyboardPreviewOpen]);

  // Determine if an item should be highlighted (from either hover or keyboard)
  const isItemHighlighted = useCallback((result) => {
    return hoveredResult?.symbol === result.symbol || isItemActive(result);
  }, [hoveredResult, isItemActive]);

  // Check if any filter is active
  const hasActiveFilters = searchMode !== 'symbol' || typeFilter !== '';

  return (
    <div ref={searchRef} className="relative w-full max-w-xl">
      {/* Search Input with Filter Button */}
      <div className="relative flex gap-2">
        {/* Main Search Input */}
        <div className="relative flex-1 bg-page-bg rounded-lg">
          {/* Ghost hint overlay */}
          {suggestionHint && (
            <div className="absolute inset-0 flex items-center pl-10 pr-10 pointer-events-none overflow-hidden">
              <span className="text-transparent whitespace-pre">{query}</span>
              <span className="text-text-muted opacity-50 whitespace-pre">{suggestionHint}</span>
              <span className="ml-2 text-xs text-text-muted bg-page-bg px-1.5 py-0.5 rounded opacity-70">Tab</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={searchMode === 'keyword' ? `Search by keywords... (${shortcutHint})` : `Search stocks... (${shortcutHint})`}
            className="w-full px-4 py-2 pl-10 pr-10 border border-line rounded-lg bg-transparent text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand relative z-10"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          />

          {/* Search Icon */}
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {/* Clear Button */}
          {query && !loading && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 z-20 text-text-secondary hover:text-text-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-brand border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Filter Button */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg transition-colors ${
              hasActiveFilters
                ? 'bg-brand/10 border-brand text-brand'
                : 'bg-page-bg border-line text-text-secondary hover:border-brand'
            }`}
            title="Search filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-brand rounded-full"></span>
            )}
          </button>

          {/* Filter Dropdown */}
          {showFilters && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-line rounded-lg shadow-lg z-50 overflow-hidden">
              {/* Search Mode */}
              <div className="p-3 border-b border-line">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-2">
                  Search Mode
                </div>
                <div className="space-y-1">
                  {SEARCH_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        setSearchMode(mode.value);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        searchMode === mode.value
                          ? 'bg-brand/10 text-brand'
                          : 'hover:bg-card-hover text-text-primary'
                      }`}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-xs text-text-muted">
                        {mode.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div className="p-3">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-2">
                  Security Type
                </div>
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setTypeFilter(type.value);
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        typeFilter === type.value
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-primary hover:bg-card-hover'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="p-3 border-t border-line">
                  <button
                    onClick={() => {
                      setSearchMode('symbol');
                      setTypeFilter('');
                    }}
                    className="w-full px-3 py-2 text-sm text-loss hover:bg-loss/10 rounded-lg transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute z-50 w-full mt-2 bg-card border border-line rounded-lg shadow-lg max-h-96 overflow-visible"
        >
          <div className="max-h-96 overflow-y-auto">
          {/* Search Results */}
          {query.trim().length > 0 && results.length > 0 && (
            <div>
              <div className="px-4 py-2 flex items-center justify-between border-b border-line">
                <span className="text-xs font-semibold text-text-secondary uppercase">
                  Results
                </span>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {categories.stocks > 0 && (
                    <span className="px-1.5 py-0.5 bg-mint/10 rounded">
                      {categories.stocks} {categories.stocks === 1 ? 'Stock' : 'Stocks'}
                    </span>
                  )}
                  {categories.etps > 0 && (
                    <span className="px-1.5 py-0.5 bg-page-bg rounded">
                      {categories.etps} {categories.etps === 1 ? 'ETF' : 'ETFs'}
                    </span>
                  )}
                  {totalMatches > results.length && (
                    <span className="text-text-muted">
                      ({totalMatches} total)
                    </span>
                  )}
                </div>
              </div>
              {results.map((result, index) => (
                <div
                  key={result.symbol}
                  className="relative"
                  onMouseEnter={() => handleResultHover(result)}
                  onMouseLeave={handleResultLeave}
                >
                  <div
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isItemHighlighted(result)}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-line-light last:border-b-0 cursor-pointer ${
                      isItemHighlighted(result)
                        ? 'bg-card-hover ring-2 ring-inset ring-brand/30'
                        : 'hover:bg-card-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Clickable area for navigation */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleSelectSymbol(result.symbol, result.description)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary">
                            {result.symbol}
                          </span>
                          {result.type && (
                            <span className="px-1.5 py-0.5 text-xs bg-mint-light text-text-secondary rounded">
                              {result.type === 'Common Stock' ? 'Stock' : result.type}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-text-secondary truncate">
                          {result.description}
                        </div>
                      </div>
                      {/* Price and Change - also clickable for navigation */}
                      {result.quote && (
                        <div
                          className="flex-shrink-0 text-right cursor-pointer"
                          onClick={() => handleSelectSymbol(result.symbol, result.description)}
                        >
                          <div className="font-mono font-medium text-text-primary">
                            {formatPrice(result.quote.price)}
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              result.quote.change >= 0
                                ? 'text-gain'
                                : 'text-loss'
                            }`}
                          >
                            {result.quote.change >= 0 ? '▲' : '▼'}{' '}
                            {formatChange(result.quote.change, result.quote.percentChange)}
                          </div>
                        </div>
                      )}
                      {/* Quick Add to Watchlist - separate clickable area */}
                      <WatchlistQuickAdd
                        symbol={result.symbol}
                        onSuccess={(symbol, watchlistName) => {
                          console.log(`Added ${symbol} to ${watchlistName}`);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {query.trim().length > 0 && !loading && results.length === 0 && (
            <div>
              <div className="px-4 py-8 text-center border-b border-line">
                <svg
                  className="mx-auto h-12 w-12 text-mint"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="mt-2 text-text-primary">No results found</p>
                <p className="text-sm text-text-secondary">
                  Try a different search term
                </p>
              </div>

              {/* Trending Stocks Suggestions (100% dynamic from API) */}
              {trendingStocks.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">
                    Trending Stocks
                  </div>
                  {trendingStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleSelectSymbol(stock.symbol, stock.description)}
                      className="w-full px-4 py-3 text-left hover:bg-card-hover transition-colors border-b border-line-light last:border-b-0"
                    >
                      <div className="font-semibold text-text-primary">
                        {stock.symbol}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {stock.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Searches */}
          {query.trim().length === 0 && storeRecentSearches.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase border-b border-line">
                Recently Viewed
              </div>
              {storeRecentSearches.map((recent) => {
                const quote = storeRecentQuotes[recent.symbol];
                // Use enriched quote format from /api/quotes/batch
                const change = quote ? quote.change : null;
                const percentChange = quote ? quote.percentChange : null;
                const isPositive = change >= 0;

                // Create result-like object for preview panel
                const recentAsResult = {
                  symbol: recent.symbol,
                  description: recent.description,
                  quote: quote ? {
                    price: quote.current,
                    change: quote.change,
                    percentChange: quote.percentChange,
                    high: quote.high,
                    low: quote.low
                  } : null
                };

                return (
                  <div
                    key={recent.symbol}
                    className="relative"
                    onMouseEnter={() => handleResultHover(recentAsResult)}
                    onMouseLeave={handleResultLeave}
                  >
                    <button
                      onClick={() => handleSelectSymbol(recent.symbol, recent.description)}
                      className="w-full px-4 py-3 text-left hover:bg-card-hover transition-colors border-b border-line-light last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center flex-1 min-w-0">
                          <svg
                            className="w-4 h-4 mr-3 text-mint flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-text-primary">
                              {recent.symbol}
                            </div>
                            <div className="text-sm text-text-secondary truncate">
                              {recent.description}
                            </div>
                          </div>
                        </div>
                        {/* Quote data */}
                        {quote && quote.current > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <div className="font-mono font-medium text-text-primary">
                              {formatPrice(quote.current)}
                            </div>
                            <div
                              className={`text-xs font-medium ${
                                isPositive ? 'text-gain' : 'text-loss'
                              }`}
                            >
                              {isPositive ? '▲' : '▼'}{' '}
                              {formatChange(change, percentChange)}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          </div>
          {/* End of scrollable content */}

          {/* Preview Panel - rendered outside scroll container to avoid clipping */}
          {showPreview && hoveredResult && (
            <div
              className="absolute left-full top-0 ml-2 z-50"
              onMouseEnter={() => {
                // Cancel any pending hide timer when mouse enters preview panel
                if (previewHideTimer.current) {
                  clearTimeout(previewHideTimer.current);
                  previewHideTimer.current = null;
                }
              }}
              onMouseLeave={() => {
                // Hide preview when mouse leaves the preview panel
                setShowPreview(false);
                setHoveredResult(null);
              }}
            >
              <SearchPreviewPanel
                symbol={hoveredResult.symbol}
                description={hoveredResult.description}
                quote={hoveredResult.quote}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SearchBar;
