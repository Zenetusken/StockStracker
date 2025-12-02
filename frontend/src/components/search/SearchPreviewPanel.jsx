import { useEffect, useState } from 'react';
import MiniChart from './MiniChart';
import useSearchPreview from '../../hooks/useSearchPreview';
import { useWatchlistStore } from '../../stores/watchlistStore';

/**
 * SearchPreviewPanel Component
 * Displays detailed stock information in a preview panel on hover/focus.
 * Shows: company name, exchange, mini-chart, quote data, and company info.
 */

// Format price for display
const formatPrice = (price) => {
  if (!price && price !== 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// Format change for display
const formatChange = (change, percentChange) => {
  if (change === undefined || percentChange === undefined) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)} (${sign}${percentChange.toFixed(2)}%)`;
};

function SearchPreviewPanel({ symbol, description, quote, onAddToWatchlist }) {
  const { profile, loading, formatMarketCap } = useSearchPreview(symbol, true);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [, setLastAddedName] = useState('');

  // Use watchlistStore for data and actions
  const watchlists = useWatchlistStore((state) => state.watchlists);
  const fetchWatchlists = useWatchlistStore((state) => state.fetchWatchlists);
  const getWatchlistsContainingSymbol = useWatchlistStore((state) => state.getWatchlistsContainingSymbol);
  const addSymbol = useWatchlistStore((state) => state.addSymbol);

  // Get which watchlists already contain this symbol (derived from store state)
  const addedToWatchlists = new Set(getWatchlistsContainingSymbol(symbol));

  // Fetch watchlists on mount if not already loaded
  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  const handleAddToWatchlist = async (watchlistId, watchlistName) => {
    if (addingToWatchlist) return;

    // Already in this watchlist
    if (addedToWatchlists.has(watchlistId)) {
      return;
    }

    setAddingToWatchlist(true);
    try {
      // Use store's addSymbol which handles:
      // - API call with CSRF token
      // - Optimistic store update with rollback on failure
      // - Store state sync (triggers automatic re-renders - no custom events needed)
      await addSymbol(watchlistId, symbol);

      setLastAddedName(watchlistName);
      setShowWatchlistDropdown(false);

      if (onAddToWatchlist) {
        onAddToWatchlist(symbol, watchlistId);
      }
    } catch (err) {
      // Check if it's a 409 (already exists) - treat as success
      if (err.status === 409 || err.message?.includes('already')) {
        setLastAddedName(watchlistName);
        setShowWatchlistDropdown(false);
      } else {
        console.error('Failed to add to watchlist:', err);
      }
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const companyName = profile?.name || description || symbol;
  const exchange = profile?.exchange || '';
  const industry = profile?.finnhubIndustry || profile?.industry || '';
  const marketCap = profile?.marketCapitalization
    ? formatMarketCap(profile.marketCapitalization * 1e6) // Finnhub returns market cap in millions
    : null;

  const isPositive = quote?.change >= 0;

  return (
    <div
      className="w-72 bg-card border border-line rounded-lg shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-line bg-panel">
        <h3 className="font-semibold text-text-primary truncate">
          {companyName}
        </h3>
        <div className="text-sm text-text-secondary">
          {exchange && <span>{exchange}: </span>}
          <span className="font-medium">{symbol}</span>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="px-4 py-3 border-b border-line">
        <div className="text-xs text-text-muted mb-1">5-Day Performance</div>
        <MiniChart symbol={symbol} height={70} />
      </div>

      {/* Quote Data */}
      {quote && (
        <div className="px-4 py-3 border-b border-line">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-text-muted text-xs">Price</div>
              <div className="font-mono font-medium text-text-primary">
                {formatPrice(quote.price)}
              </div>
            </div>
            <div>
              <div className="text-text-muted text-xs">Change</div>
              <div className={`font-medium ${isPositive ? 'text-gain' : 'text-loss'}`}>
                {isPositive ? '▲' : '▼'} {formatChange(quote.change, quote.percentChange)}
              </div>
            </div>
            <div>
              <div className="text-text-muted text-xs">Day High</div>
              <div className="font-mono text-text-primary">
                {formatPrice(quote.high)}
              </div>
            </div>
            <div>
              <div className="text-text-muted text-xs">Day Low</div>
              <div className="font-mono text-text-primary">
                {formatPrice(quote.low)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Info */}
      <div className="px-4 py-3 border-b border-line">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {industry && (
            <div>
              <div className="text-text-muted text-xs">Industry</div>
              <div className="text-text-primary truncate" title={industry}>
                {industry}
              </div>
            </div>
          )}
          {marketCap && (
            <div>
              <div className="text-text-muted text-xs">Market Cap</div>
              <div className="text-text-primary">{marketCap}</div>
            </div>
          )}
        </div>
        {loading && (
          <div className="text-xs text-text-muted mt-2">
            Loading company info...
          </div>
        )}
      </div>

      {/* Add to Watchlist */}
      <div className="px-4 py-3 relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowWatchlistDropdown(!showWatchlistDropdown);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add to Watchlist
          <svg
            className={`w-4 h-4 transition-transform ${showWatchlistDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Watchlist Dropdown */}
        {showWatchlistDropdown && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-card border border-line rounded-lg shadow-lg overflow-hidden">
            {watchlists.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-muted">
                No watchlists yet
              </div>
            ) : (
              watchlists.map((watchlist) => {
                const alreadyAdded = addedToWatchlists.has(watchlist.id);
                return (
                  <button
                    key={watchlist.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToWatchlist(watchlist.id, watchlist.name);
                    }}
                    disabled={addingToWatchlist || alreadyAdded}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                      alreadyAdded
                        ? 'bg-gain/10 cursor-default'
                        : 'hover:bg-card-hover disabled:opacity-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: watchlist.color }}
                    />
                    <span className="text-text-primary truncate flex-1">
                      {watchlist.name}
                    </span>
                    {alreadyAdded && (
                      <svg className="w-4 h-4 text-gain flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {watchlist.is_default && !alreadyAdded && (
                      <span className="text-xs text-text-muted">(default)</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPreviewPanel;
