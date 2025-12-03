import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Building2,
  DollarSign,
  BarChart3,
  Percent,
  X,
  Activity,
  Target,
  Plus,
  Save,
  FolderOpen,
  Star,
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useWatchlistStore } from '../stores/watchlistStore';
import { useToast } from '../components/toast/ToastContext';

/**
 * Stock Screener Page
 * Features #103-115: Stock Screener
 *
 * #103: Filter by market cap range
 * #104: Filter by P/E ratio range
 * #105: Filter by sector
 * #106: Filter by industry
 * #107: Filter by price range
 * #108: Filter by volume threshold
 * #109: Filter by 52-week high/low proximity
 * #110: Filter by dividend yield
 * #111: Combine multiple filters
 * #112: Screener results table
 * #113: Add result to watchlist
 * #114: Save screener configuration
 * #115: Load saved screeners
 */

// Saved screener storage key
const SAVED_SCREENERS_KEY = 'stocktracker_saved_screeners';

// Market cap presets
const MARKET_CAP_PRESETS = [
  { label: 'All', min: undefined, max: undefined },
  { label: 'Mega (>$200B)', min: 200000, max: undefined },
  { label: 'Large ($10B-$200B)', min: 10000, max: 200000 },
  { label: 'Mid ($2B-$10B)', min: 2000, max: 10000 },
  { label: 'Small ($300M-$2B)', min: 300, max: 2000 },
];

// P/E presets
const PE_PRESETS = [
  { label: 'All', min: undefined, max: undefined },
  { label: 'Low (<15)', min: undefined, max: 15 },
  { label: 'Value (15-25)', min: 15, max: 25 },
  { label: 'Growth (25-50)', min: 25, max: 50 },
  { label: 'High (>50)', min: 50, max: undefined },
];

// Volume presets (#108)
const VOLUME_PRESETS = [
  { label: 'All', min: undefined },
  { label: 'High (>10M)', min: 10000000 },
  { label: 'Medium (1M-10M)', min: 1000000 },
  { label: 'Low (100K-1M)', min: 100000 },
];

// 52-Week proximity presets (#109)
const PROXIMITY_PRESETS = [
  { label: 'All', nearHigh: undefined, nearLow: undefined },
  { label: 'Near 52W High (<5%)', nearHigh: 5, nearLow: undefined },
  { label: 'Near 52W High (<10%)', nearHigh: 10, nearLow: undefined },
  { label: 'Near 52W Low (<10%)', nearLow: 10, nearHigh: undefined },
  { label: 'Near 52W Low (<20%)', nearLow: 20, nearHigh: undefined },
];

// Dividend yield presets (#110)
const DIVIDEND_PRESETS = [
  { label: 'All', min: undefined, max: undefined },
  { label: 'High (>4%)', min: 4, max: undefined },
  { label: 'Medium (2-4%)', min: 2, max: 4 },
  { label: 'Low (1-2%)', min: 1, max: 2 },
  { label: 'None (<1%)', min: undefined, max: 1 },
];

// Sectors
const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Communication Services',
  'Real Estate',
  'Utilities',
  'Basic Materials',
];

function Screener() {
  // Filter state
  const [filters, setFilters] = useState({
    minMarketCap: undefined,
    maxMarketCap: undefined,
    minPE: undefined,
    maxPE: undefined,
    sector: 'all',
    industry: '',
    minPrice: undefined,
    maxPrice: undefined,
    minVolume: undefined,  // #108
    nearHigh: undefined,   // #109
    nearLow: undefined,    // #109
    minDividend: undefined, // #110
    maxDividend: undefined, // #110
  });

  // Results state
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sort state
  const [sortField, setSortField] = useState('marketCap');
  const [sortDirection, setSortDirection] = useState('desc');

  // Watchlist state (#113)
  const watchlists = useWatchlistStore((state) => state.watchlists);
  const addSymbol = useWatchlistStore((state) => state.addSymbol);
  const fetchWatchlists = useWatchlistStore((state) => state.fetchWatchlists);
  const { showToast } = useToast();
  const [watchlistDropdownOpen, setWatchlistDropdownOpen] = useState(null);

  // Saved screeners state (#114, #115)
  const [savedScreeners, setSavedScreeners] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [screenerName, setScreenerName] = useState('');

  // Fetch watchlists on mount
  useEffect(() => {
    fetchWatchlists();
    // Load saved screeners from localStorage
    const saved = localStorage.getItem(SAVED_SCREENERS_KEY);
    if (saved) {
      try {
        setSavedScreeners(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved screeners:', e);
      }
    }
  }, [fetchWatchlists]);

  // Add to watchlist handler (#113)
  const handleAddToWatchlist = useCallback(async (symbol, watchlistId) => {
    try {
      await addSymbol(watchlistId, symbol);
      showToast(`Added ${symbol} to watchlist`, 'success');
      setWatchlistDropdownOpen(null);
    } catch {
      showToast(`Failed to add ${symbol} to watchlist`, 'error');
    }
  }, [addSymbol, showToast]);

  // Save screener (#114)
  const handleSaveScreener = useCallback(() => {
    if (!screenerName.trim()) return;

    const newScreener = {
      id: Date.now(),
      name: screenerName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedScreeners, newScreener];
    setSavedScreeners(updated);
    localStorage.setItem(SAVED_SCREENERS_KEY, JSON.stringify(updated));
    setSaveModalOpen(false);
    setScreenerName('');
    showToast(`Saved screener "${newScreener.name}"`, 'success');
  }, [screenerName, filters, savedScreeners, showToast]);

  // Load screener (#115)
  const handleLoadScreener = useCallback((screener) => {
    setFilters(screener.filters);
    setLoadModalOpen(false);
    showToast(`Loaded screener "${screener.name}"`, 'success');
  }, [showToast]);

  // Delete saved screener
  const handleDeleteScreener = useCallback((screenerId) => {
    const updated = savedScreeners.filter(s => s.id !== screenerId);
    setSavedScreeners(updated);
    localStorage.setItem(SAVED_SCREENERS_KEY, JSON.stringify(updated));
    showToast('Screener deleted', 'success');
  }, [savedScreeners, showToast]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minMarketCap !== undefined || filters.maxMarketCap !== undefined) count++;
    if (filters.minPE !== undefined || filters.maxPE !== undefined) count++;
    if (filters.sector !== 'all') count++;
    if (filters.industry) count++;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++;
    if (filters.minVolume !== undefined) count++;  // #108
    if (filters.nearHigh !== undefined || filters.nearLow !== undefined) count++;  // #109
    if (filters.minDividend !== undefined || filters.maxDividend !== undefined) count++;  // #110
    return count;
  }, [filters]);

  // Fetch screener results
  const runScreener = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.minMarketCap !== undefined) params.append('minMarketCap', filters.minMarketCap);
      if (filters.maxMarketCap !== undefined) params.append('maxMarketCap', filters.maxMarketCap);
      if (filters.minPE !== undefined) params.append('minPE', filters.minPE);
      if (filters.maxPE !== undefined) params.append('maxPE', filters.maxPE);
      if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
      if (filters.industry) params.append('industry', filters.industry);
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice);
      if (filters.minVolume !== undefined) params.append('minVolume', filters.minVolume);  // #108
      if (filters.nearHigh !== undefined) params.append('nearHigh', filters.nearHigh);  // #109
      if (filters.nearLow !== undefined) params.append('nearLow', filters.nearLow);  // #109
      if (filters.minDividend !== undefined) params.append('minDividend', filters.minDividend);  // #110
      if (filters.maxDividend !== undefined) params.append('maxDividend', filters.maxDividend);  // #110
      params.append('limit', '50');

      const data = await api.get(`/screener?${params.toString()}`);
      setResults(data.results || []);
    } catch (err) {
      console.error('Screener error:', err);
      setError('Failed to run screener. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Run screener on mount
  useEffect(() => {
    runScreener();
  }, []);

  // Sort results
  const sortedResults = useMemo(() => {
    if (!results.length) return [];

    return [...results].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined
      if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [results, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      minMarketCap: undefined,
      maxMarketCap: undefined,
      minPE: undefined,
      maxPE: undefined,
      sector: 'all',
      industry: '',
      minPrice: undefined,
      maxPrice: undefined,
      minVolume: undefined,
      nearHigh: undefined,
      nearLow: undefined,
      minDividend: undefined,
      maxDividend: undefined,
    });
  };

  // Format helpers
  const formatMarketCap = (val) => {
    if (val == null) return '-';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}T`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}B`;
    return `$${val.toFixed(0)}M`;
  };

  const formatPrice = (val) => {
    if (val == null) return '-';
    return `$${val.toFixed(2)}`;
  };

  const formatPercent = (val) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Sort icon component
  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-brand" />
    ) : (
      <ArrowDown className="w-3 h-3 text-brand" />
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              <Search className="w-8 h-8" />
              Stock Screener
            </h1>
            <p className="text-text-muted mt-1">
              Filter stocks by market cap, P/E ratio, sector, and more
            </p>
          </div>

          {/* Save/Load Buttons (#114, #115) */}
          <div className="flex gap-2">
            <button
              onClick={() => setLoadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary hover:bg-card-hover rounded-lg transition-colors"
              title="Load saved screener"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Load</span>
            </button>
            <button
              onClick={() => setSaveModalOpen(true)}
              disabled={activeFilterCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save current screener"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg shadow p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-brand text-white text-xs rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Reset
                  </button>
                )}
              </div>

              {/* Market Cap Filter (#103) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Market Cap
                </label>
                <div className="space-y-2">
                  {MARKET_CAP_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          minMarketCap: preset.min,
                          maxMarketCap: preset.max,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        filters.minMarketCap === preset.min &&
                        filters.maxMarketCap === preset.max
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-secondary hover:bg-brand/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* P/E Ratio Filter (#104) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  P/E Ratio
                </label>
                <div className="space-y-2">
                  {PE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          minPE: preset.min,
                          maxPE: preset.max,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        filters.minPE === preset.min && filters.maxPE === preset.max
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-secondary hover:bg-brand/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sector Filter (#105) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Sector
                </label>
                <select
                  value={filters.sector}
                  onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                  className="w-full px-3 py-2 bg-page-bg border border-border rounded text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector === 'All Sectors' ? 'all' : sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </div>

              {/* Industry Filter (#106) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Industry (contains)
                </label>
                <input
                  type="text"
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                  placeholder="e.g. Software, Banks"
                  className="w-full px-3 py-2 bg-page-bg border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* Price Filter (#107) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Price Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.minPrice || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Min"
                    className="w-1/2 px-3 py-2 bg-page-bg border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    type="number"
                    value={filters.maxPrice || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Max"
                    className="w-1/2 px-3 py-2 bg-page-bg border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Volume Filter (#108) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Volume
                </label>
                <div className="space-y-2">
                  {VOLUME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          minVolume: preset.min,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        filters.minVolume === preset.min
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-secondary hover:bg-brand/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 52-Week Proximity Filter (#109) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  52-Week Range
                </label>
                <div className="space-y-2">
                  {PROXIMITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          nearHigh: preset.nearHigh,
                          nearLow: preset.nearLow,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        filters.nearHigh === preset.nearHigh &&
                        filters.nearLow === preset.nearLow
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-secondary hover:bg-brand/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dividend Yield Filter (#110) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Dividend Yield
                </label>
                <div className="space-y-2">
                  {DIVIDEND_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          minDividend: preset.min,
                          maxDividend: preset.max,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        filters.minDividend === preset.min &&
                        filters.maxDividend === preset.max
                          ? 'bg-brand text-white'
                          : 'bg-page-bg text-text-secondary hover:bg-brand/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={runScreener}
                disabled={loading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Screening...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Run Screener
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-lg shadow overflow-hidden">
              {/* Results Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-sm text-text-muted">
                  {loading ? (
                    'Loading...'
                  ) : (
                    <>
                      <span className="font-semibold text-text-primary">{results.length}</span>{' '}
                      stocks found
                    </>
                  )}
                </div>
                <button
                  onClick={runScreener}
                  disabled={loading}
                  className="p-2 text-text-muted hover:text-text-primary hover:bg-page-bg rounded transition-colors disabled:opacity-50"
                  title="Refresh results"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Error state */}
              {error && (
                <div className="p-6 text-center">
                  <p className="text-loss">{error}</p>
                  <button
                    onClick={runScreener}
                    className="mt-4 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Loading state */}
              {loading && !error && (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-4" />
                  <p className="text-text-muted">Screening stocks...</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && results.length === 0 && (
                <div className="p-12 text-center">
                  <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-muted">
                    No stocks match your criteria. Try adjusting the filters.
                  </p>
                </div>
              )}

              {/* Results Table */}
              {!loading && !error && results.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-page-bg">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                          Symbol
                        </th>
                        <th
                          className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary"
                          onClick={() => handleSort('currentPrice')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Price <SortIcon field="currentPrice" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary"
                          onClick={() => handleSort('changePercent')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Change <SortIcon field="changePercent" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary"
                          onClick={() => handleSort('marketCap')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Market Cap <SortIcon field="marketCap" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary"
                          onClick={() => handleSort('peRatio')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            P/E <SortIcon field="peRatio" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider hidden lg:table-cell">
                          Sector
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedResults.map((stock) => (
                        <tr
                          key={stock.symbol}
                          className="hover:bg-card-hover transition-colors"
                        >
                          <td className="px-4 py-4">
                            <Link
                              to={`/stock/${stock.symbol}`}
                              className="flex items-center gap-3"
                            >
                              <div>
                                <div className="font-semibold text-text-primary hover:text-brand transition-colors">
                                  {stock.symbol}
                                </div>
                                <div className="text-xs text-text-muted truncate max-w-[150px]">
                                  {stock.name}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-text-primary">
                            {formatPrice(stock.currentPrice)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div
                              className={`flex items-center justify-end gap-1 font-medium ${
                                stock.changePercent >= 0 ? 'text-gain' : 'text-loss'
                              }`}
                            >
                              {stock.changePercent >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {formatPercent(stock.changePercent)}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary">
                            {formatMarketCap(stock.marketCap)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary">
                            {stock.peRatio?.toFixed(2) || '-'}
                          </td>
                          <td className="px-4 py-4 text-left text-text-muted text-sm hidden lg:table-cell">
                            {stock.sector || '-'}
                          </td>
                          {/* Add to Watchlist (#113) */}
                          <td className="px-4 py-4 text-center relative">
                            <button
                              onClick={() =>
                                setWatchlistDropdownOpen(
                                  watchlistDropdownOpen === stock.symbol ? null : stock.symbol
                                )
                              }
                              className="p-2 text-text-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                              title="Add to watchlist"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                            {/* Watchlist dropdown */}
                            {watchlistDropdownOpen === stock.symbol && (
                              <div className="absolute right-4 top-12 z-10 w-48 bg-card border border-border rounded-lg shadow-lg py-1">
                                <div className="px-3 py-2 text-xs font-medium text-text-muted border-b border-border">
                                  Add to watchlist
                                </div>
                                {watchlists.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-text-muted">
                                    No watchlists
                                  </div>
                                ) : (
                                  watchlists.map((wl) => (
                                    <button
                                      key={wl.id}
                                      onClick={() => handleAddToWatchlist(stock.symbol, wl.id)}
                                      className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-page-bg transition-colors"
                                    >
                                      {wl.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Screener Modal (#114) */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Save Screener</h2>
            <input
              type="text"
              value={screenerName}
              onChange={(e) => setScreenerName(e.target.value)}
              placeholder="Enter screener name..."
              className="w-full px-4 py-2 bg-page-bg border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand mb-4"
              autoFocus
            />
            <div className="text-sm text-text-muted mb-4">
              <strong>Filters:</strong> {activeFilterCount} active
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSaveModalOpen(false);
                  setScreenerName('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScreener}
                disabled={!screenerName.trim()}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Screener Modal (#115) */}
      {loadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Load Saved Screener</h2>
            {savedScreeners.length === 0 ? (
              <p className="text-text-muted py-8 text-center">No saved screeners yet</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {savedScreeners.map((screener) => (
                  <div
                    key={screener.id}
                    className="flex items-center justify-between p-3 bg-page-bg rounded-lg hover:bg-card-hover transition-colors"
                  >
                    <button
                      onClick={() => handleLoadScreener(screener)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium text-text-primary">{screener.name}</div>
                      <div className="text-xs text-text-muted">
                        Saved {new Date(screener.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteScreener(screener.id)}
                      className="p-2 text-text-muted hover:text-loss transition-colors"
                      title="Delete screener"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setLoadModalOpen(false)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Screener;
