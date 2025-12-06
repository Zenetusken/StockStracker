import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Building2,
  Sparkles,
  Rocket,
  Eye,
  Zap,
  Target,
  Cpu,
  Flame,
} from 'lucide-react';
import { useMarketOverviewStore } from '../stores/marketOverviewStore';
import { getMarketStatus } from '../utils/marketStatus';

/**
 * Enhanced Top Movers Component
 * Displays market movers across multiple categories using Yahoo Finance screeners.
 *
 * Data Sources (all Yahoo Finance):
 * - Trending tickers (unfiltered viral movers)
 * - Most actives (high volume)
 * - Day gainers/losers (large/mid cap)
 * - Small cap gainers
 * - Aggressive small caps (penny stocks, micro-caps)
 *
 * Categories:
 * - Top Movers (Multi-source merge from trending, actives, screeners)
 * - Large & Mid Cap (Gainers, Losers, Most Active)
 * - Small Cap (Gainers, Aggressive)
 * - Growth Stocks (Undervalued, Tech Growth)
 * - Most Watched (Trending)
 * - Canada (TSX/TSXV/CSE)
 *
 * Display: Shows 15 stocks by default, expandable to 25 per tab
 */

// Section definitions with tabs
// Note: Hot Sectors removed - Yahoo Finance doesn't provide sector-themed stock lists via API
// All sections below use Yahoo's dynamic screener API (no hardcoded symbol lists)
const SECTIONS = [
  {
    id: 'viral',
    label: 'Top Movers',
    icon: Flame,
    description: 'Multi-source: trending, actives, screeners (all market caps)',
    tabs: [
      { id: 'gainers', label: 'Top Gainers', icon: TrendingUp, color: 'text-gain' },
      { id: 'losers', label: 'Top Losers', icon: TrendingDown, color: 'text-loss' },
    ],
  },
  {
    id: 'largeCap',
    label: 'Large & Mid Cap',
    icon: Building2,
    description: 'Filtered: price >$5, market cap >$2B',
    tabs: [
      { id: 'gainers', label: 'Gainers', icon: TrendingUp, color: 'text-gain' },
      { id: 'losers', label: 'Losers', icon: TrendingDown, color: 'text-loss' },
      { id: 'mostActive', label: 'Most Active', icon: Activity, color: 'text-brand' },
    ],
  },
  {
    id: 'smallCap',
    label: 'Small Cap',
    icon: Sparkles,
    tabs: [
      { id: 'gainers', label: 'Gainers', icon: TrendingUp, color: 'text-gain' },
      { id: 'aggressive', label: 'Aggressive', icon: Zap, color: 'text-amber-500' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth Stocks',
    icon: Rocket,
    tabs: [
      { id: 'undervalued', label: 'Undervalued', icon: Target, color: 'text-emerald-500' },
      { id: 'tech', label: 'Tech Growth', icon: Cpu, color: 'text-blue-500' },
    ],
  },
  {
    id: 'trending',
    label: 'Most Watched',
    icon: Eye,
    tabs: [
      { id: 'watched', label: 'Popular', icon: Eye, color: 'text-pink-500' },
    ],
  },
  {
    id: 'canada',
    label: '🇨🇦 Canada',
    icon: TrendingUp,
    description: 'TSX/TSXV/CSE stocks ≥$0.50 (excludes penny stocks)',
    tabs: [
      { id: 'gainers', label: 'Top Gainers', icon: TrendingUp, color: 'text-gain' },
      { id: 'mostActive', label: 'Most Active', icon: Activity, color: 'text-brand' },
    ],
  },
];

// Display configuration
const DEFAULT_DISPLAY_COUNT = 15; // Show 15 stocks by default
const EXPANDED_DISPLAY_COUNT = 25; // Show 25 stocks when expanded

function TopMovers() {
  // N3 fix: Use store for movers data with caching
  const data = useMarketOverviewStore((state) => state.movers);
  const loading = useMarketOverviewStore((state) => state.isLoadingMovers);
  const error = useMarketOverviewStore((state) => state.error);
  const fetchMovers = useMarketOverviewStore((state) => state.fetchMovers);

  // Local UI state
  const [expandedSections, setExpandedSections] = useState({ viral: true });
  const [activeTabs, setActiveTabs] = useState({
    viral: 'gainers',
    largeCap: 'gainers',
    smallCap: 'gainers',
    growth: 'undervalued',
    trending: 'watched',
    canada: 'gainers',
  });
  // Track which tabs are showing expanded view (25 items)
  const [expandedTabs, setExpandedTabs] = useState({});
  // N3 fix: Track current time in state for pure render (avoids Date.now() during render)
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Derived value
  const lastUpdated = data?.timestamp || null;

  // N3 fix: Use ref for stable interval callback
  const fetchMoversRef = useRef(fetchMovers);

  // N3 fix: Update ref in effect to avoid render-time ref mutation
  useEffect(() => {
    fetchMoversRef.current = fetchMovers;
  }, [fetchMovers]);

  useEffect(() => {
    // Initial fetch
    const { fetchMovers } = useMarketOverviewStore.getState();
    fetchMovers(false);

    // Dynamic auto-refresh based on market status:
    // - 30 seconds during trading hours (9:30 AM - 4:00 PM ET)
    // - 90 seconds outside trading hours
    let dataInterval = null;
    let currentIntervalMs = 0;

    const setupRefreshInterval = () => {
      const { isOpen } = getMarketStatus();
      const newIntervalMs = isOpen ? 30000 : 90000; // 30s during market hours, 90s otherwise

      // Only recreate interval if duration changed
      if (newIntervalMs !== currentIntervalMs) {
        if (dataInterval) {
          clearInterval(dataInterval);
        }
        currentIntervalMs = newIntervalMs;
        dataInterval = setInterval(() => {
          fetchMoversRef.current(false);
        }, currentIntervalMs);
        console.log(`[TopMovers] Auto-refresh set to ${currentIntervalMs / 1000}s (market ${isOpen ? 'open' : 'closed'})`);
      }
    };

    // Set initial interval
    setupRefreshInterval();

    // Check market status every minute to adjust interval when market opens/closes
    const statusCheckInterval = setInterval(setupRefreshInterval, 60000);

    // N3 fix: Update currentTime every 30 seconds for "time ago" display
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => {
      if (dataInterval) clearInterval(dataInterval);
      clearInterval(statusCheckInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Set active tab for a section
  const setActiveTab = (sectionId, tabId) => {
    setActiveTabs(prev => ({
      ...prev,
      [sectionId]: tabId,
    }));
  };

  // Format helpers
  const formatPrice = (val) => {
    if (val == null) return '-';
    return `$${val.toFixed(2)}`;
  };

  const formatPercent = (val) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const formatVolume = (vol) => {
    if (vol == null) return '-';
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  // N3 fix: Use currentTime from state instead of Date.now() for pure render
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((currentTime - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get stocks for a specific section and tab
  const getStocksForTab = (sectionId, tabId) => {
    return data?.categories?.[sectionId]?.[tabId] || [];
  };

  // Check if a section has any data
  const sectionHasData = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return false;
    return section.tabs.some(tab => getStocksForTab(sectionId, tab.id).length > 0);
  };

  // Toggle expanded view for a specific section/tab
  const toggleExpandedTab = (sectionId, tabId) => {
    const key = `${sectionId}:${tabId}`;
    setExpandedTabs(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Check if a tab is expanded
  const isTabExpanded = (sectionId, tabId) => {
    const key = `${sectionId}:${tabId}`;
    return expandedTabs[key] || false;
  };

  // Render stock list
  const renderStockList = (stocks, showVolume = false, sectionId = '', tabId = '') => {
    if (!stocks || stocks.length === 0) {
      return (
        <div className="text-center py-4 text-text-muted text-sm">
          No data available
        </div>
      );
    }

    const isExpanded = isTabExpanded(sectionId, tabId);
    const displayCount = isExpanded ? EXPANDED_DISPLAY_COUNT : DEFAULT_DISPLAY_COUNT;
    const displayedStocks = stocks.slice(0, displayCount);
    const hasMore = stocks.length > displayCount;
    const hiddenCount = stocks.length - displayCount;

    return (
      <div className="space-y-1">
        {displayedStocks.map((stock, idx) => (
          <Link
            key={stock.symbol}
            to={`/stock/${stock.symbol}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-page-bg transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-text-muted bg-page-bg rounded flex-shrink-0">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-text-primary text-sm">
                    {stock.symbol}
                  </span>
                  {/* Exchange badge for non-US stocks */}
                  {stock.exchange && stock.exchange !== 'US' && stock.exchange !== 'XNAS' && stock.exchange !== 'XNYS' && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-page-bg text-text-muted font-medium">
                      {stock.exchange}
                    </span>
                  )}
                </div>
                {stock.name && stock.name !== stock.symbol && (
                  <p className="text-xs text-text-muted truncate max-w-[120px]">
                    {stock.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">
                {formatPrice(stock.price)}
              </span>
              {showVolume ? (
                <span className="text-sm font-medium text-brand min-w-[60px] text-right">
                  {formatVolume(stock.volume)}
                </span>
              ) : (
                <span className={`text-sm font-medium min-w-[60px] text-right ${
                  stock.changePercent >= 0 ? 'text-gain' : 'text-loss'
                }`}>
                  {formatPercent(stock.changePercent)}
                </span>
              )}
            </div>
          </Link>
        ))}

        {/* Show more/less toggle */}
        {(hasMore || isExpanded) && (
          <button
            onClick={() => toggleExpandedTab(sectionId, tabId)}
            className="w-full py-2 text-xs font-medium text-brand hover:text-brand/80 hover:bg-brand/5 rounded transition-colors"
          >
            {isExpanded ? (
              `Show less`
            ) : (
              `Show ${hiddenCount} more`
            )}
          </button>
        )}
      </div>
    );
  };

  // Render a section
  const renderSection = (section) => {
    const isExpanded = expandedSections[section.id];
    const activeTab = activeTabs[section.id];
    const hasData = sectionHasData(section.id);
    const SectionIcon = section.icon;
    const stocks = getStocksForTab(section.id, activeTab);
    const showVolume = activeTab === 'mostActive';

    // Get count of gainers for the badge
    const primaryTabData = getStocksForTab(section.id, section.tabs[0].id);
    const topGain = primaryTabData[0]?.changePercent;

    return (
      <div key={section.id} className="border-b border-border last:border-b-0">
        {/* Section header - clickable to expand/collapse */}
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-page-bg/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-muted" />
            )}
            <SectionIcon className="w-4 h-4 text-text-muted" />
            <span className="font-medium text-text-primary">{section.label}</span>
            {!isExpanded && hasData && topGain != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                topGain >= 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
              }`}>
                {formatPercent(topGain)}
              </span>
            )}
          </div>
          {!hasData && (
            <span className="text-xs text-text-muted">No data</span>
          )}
        </button>

        {/* Section content */}
        {isExpanded && (
          <div className="px-4 pb-3">
            {/* Tabs */}
            <div className="flex gap-1 mb-2 overflow-x-auto">
              {section.tabs.map(tab => {
                const TabIcon = tab.icon;
                const tabData = getStocksForTab(section.id, tab.id);
                const count = tabData.length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(section.id, tab.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? `bg-brand/10 ${tab.color}`
                        : 'text-text-muted hover:text-text-primary hover:bg-page-bg'
                    }`}
                  >
                    <TabIcon className="w-3 h-3" />
                    {tab.label}
                    {count > 0 && (
                      <span className="text-[10px] opacity-60">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stock list */}
            {renderStockList(stocks, showVolume, section.id, activeTab)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Top Market Movers</h2>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-text-muted">
                {formatTimeAgo(lastUpdated)}
              </span>
            )}
            <button
              onClick={() => fetchMovers(true)}
              disabled={loading}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-page-bg rounded transition-colors"
              title="Refresh (fetch fresh data)"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {loading && !data && (
          <div className="flex items-center justify-center py-8 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading market movers...
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-loss mb-2">{error}</p>
            <button
              onClick={() => fetchMovers(true)}
              className="text-sm text-brand hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div>
            {SECTIONS.map(section => renderSection(section))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopMovers;
