import { useEffect, useState, useCallback } from 'react';
import { useSearchStore } from '../../stores/searchStore';

/**
 * TrendingSection Component
 * Displays trending stocks - top gainers, losers, and most active
 * shown when search input is empty.
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

// Format percent change
const formatPercent = (percent) => {
  if (percent === undefined || percent === null) return '—';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
};

// Stock item component
function StockItem({ stock, onClick }) {
  const isPositive = stock.percentChange >= 0;

  return (
    <button
      onClick={() => onClick(stock.symbol)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-card-hover transition-colors rounded-lg group"
    >
      {/* Symbol and name */}
      <div className="flex-1 min-w-0 text-left">
        <div className="font-medium text-text-primary text-sm">
          {stock.symbol}
        </div>
        <div className="text-xs text-text-muted truncate">
          {stock.description}
        </div>
      </div>

      {/* Price and change */}
      <div className="text-right">
        <div className="font-mono text-sm text-text-primary">
          {formatPrice(stock.price)}
        </div>
        <div
          className={`text-xs font-medium ${
            isPositive ? 'text-gain' : 'text-loss'
          }`}
        >
          {isPositive ? '▲' : '▼'} {formatPercent(stock.percentChange)}
        </div>
      </div>
    </button>
  );
}

// Section header component
function SectionHeader({ title, icon, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
      <span className={`text-lg ${color}`}>{icon}</span>
      <span className="text-sm font-semibold text-text-primary">
        {title}
      </span>
    </div>
  );
}

function TrendingSection({ onSelectStock, className = '' }) {
  const [activeTab, setActiveTab] = useState('gainers'); // 'gainers', 'losers', 'mostActive'

  // Get store state and actions
  const trending = useSearchStore((state) => state.trending);
  const loading = useSearchStore((state) => state.trendingLoading);
  const error = useSearchStore((state) => state.trendingError);
  const storeFetchTrending = useSearchStore((state) => state.fetchTrending);

  const fetchTrending = useCallback(async (force = false) => {
    try {
      await storeFetchTrending(5, force);
    } catch (err) {
      console.error('Error fetching trending:', err);
    }
  }, [storeFetchTrending]);

  useEffect(() => {
    fetchTrending();

    // Refresh every 2 minutes
    const interval = setInterval(() => fetchTrending(true), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  const handleStockClick = (symbol) => {
    if (onSelectStock) {
      onSelectStock(symbol);
    }
  };

  if (loading && !trending) {
    return (
      <div className={`bg-card rounded-lg border border-line ${className}`}>
        <div className="p-4 text-center">
          <div className="animate-pulse flex flex-col gap-2">
            <div className="h-4 bg-card-hover rounded w-3/4 mx-auto" />
            <div className="h-3 bg-card-hover rounded w-1/2 mx-auto" />
          </div>
          <p className="text-sm text-text-muted mt-2">
            Loading trending stocks...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-card rounded-lg border border-line ${className}`}>
        <div className="p-4 text-center">
          <p className="text-sm text-text-muted">
            Unable to load trending stocks
          </p>
          <button
            onClick={() => fetchTrending(true)}
            className="mt-2 text-sm text-brand hover:text-brand-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!trending) return null;

  const tabs = [
    { id: 'gainers', label: 'Top Gainers', icon: '📈', color: 'text-gain' },
    { id: 'losers', label: 'Top Losers', icon: '📉', color: 'text-loss' },
    { id: 'mostActive', label: 'Most Active', icon: '⚡', color: 'text-brand' },
  ];

  const currentStocks = trending[activeTab] || [];

  return (
    <div className={`bg-card rounded-lg border border-line overflow-hidden ${className}`}>
      {/* Tab Headers */}
      <div className="flex border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-panel text-text-primary border-b-2 border-brand'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Stock List */}
      <div className="divide-y divide-line">
        {currentStocks.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-muted">
            No data available
          </div>
        ) : (
          currentStocks.map((stock) => (
            <StockItem
              key={stock.symbol}
              stock={stock}
              onClick={handleStockClick}
              isGainer={activeTab === 'gainers'}
            />
          ))
        )}
      </div>

      {/* Footer with refresh info */}
      <div className="px-3 py-2 bg-panel border-t border-line">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {trending.cached ? 'Cached' : 'Live'} data
          </span>
          <button
            onClick={() => fetchTrending(true)}
            disabled={loading}
            className="text-xs text-brand hover:text-brand-hover disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrendingSection;
