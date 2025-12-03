import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Activity,
  BarChart3,
} from 'lucide-react';
import api from '../api/client';

/**
 * Market Overview Component
 * #116: Major indices (S&P 500, Dow, Nasdaq) with live updates
 * #117: Sector performance heatmap
 */

// Refresh interval (60 seconds - aligned with backend cache TTL for efficiency)
const REFRESH_INTERVAL = 60000;

function MarketOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.get('/market/overview');
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Market overview error:', err);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Format helpers
  const formatPrice = (val) => {
    if (val == null) return '-';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Get color class for change
  const getChangeClass = (change) => {
    if (change > 0) return 'text-gain';
    if (change < 0) return 'text-loss';
    return 'text-text-muted';
  };

  // Get heatmap color for sector
  const getHeatmapColor = (changePercent) => {
    if (changePercent >= 2) return 'bg-emerald-600';
    if (changePercent >= 1) return 'bg-emerald-500';
    if (changePercent >= 0.5) return 'bg-emerald-400';
    if (changePercent > 0) return 'bg-emerald-300';
    if (changePercent === 0) return 'bg-gray-400';
    if (changePercent > -0.5) return 'bg-rose-300';
    if (changePercent > -1) return 'bg-rose-400';
    if (changePercent > -2) return 'bg-rose-500';
    return 'bg-rose-600';
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading market data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="text-center">
          <p className="text-loss mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Major Indices (#116) */}
      <div className="bg-card rounded-lg shadow">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Market Indices
          </h2>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-text-muted">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-page-bg rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data?.indices?.map((index) => (
              <Link
                key={index.symbol}
                to={`/stock/${index.symbol}`}
                className="bg-page-bg rounded-lg p-3 hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-muted">
                    {index.displaySymbol}
                  </span>
                  {index.changePercent !== undefined && (
                    index.changePercent >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-gain" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )
                  )}
                </div>
                <div className="text-sm font-semibold text-text-primary truncate">
                  {index.name}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold text-text-primary">
                    ${formatPrice(index.price)}
                  </span>
                  <span className={`text-sm font-medium ${getChangeClass(index.changePercent)}`}>
                    {formatPercent(index.changePercent)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sector Heatmap (#117) */}
      <div className="bg-card rounded-lg shadow">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Sector Performance
          </h2>
          {data?.breadth && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gain">
                {data.breadth.sectorGainers} up
              </span>
              <span className="text-text-muted">|</span>
              <span className="text-loss">
                {data.breadth.sectorLosers} down
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data?.sectors?.map((sector) => (
              <Link
                key={sector.symbol}
                to={`/stock/${sector.symbol}`}
                className={`rounded-lg p-3 text-white hover:opacity-90 transition-opacity ${getHeatmapColor(sector.changePercent)}`}
              >
                <div className="text-xs font-medium opacity-90 truncate">
                  {sector.name}
                </div>
                <div className="text-lg font-bold mt-1">
                  {formatPercent(sector.changePercent)}
                </div>
                <div className="text-xs opacity-75">
                  {sector.symbol}
                </div>
              </Link>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-1 text-xs text-text-muted">
            <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px]">-2%+</span>
            <span className="px-2 py-0.5 bg-rose-400 text-white rounded text-[10px]">-1%</span>
            <span className="px-2 py-0.5 bg-gray-400 text-white rounded text-[10px]">0%</span>
            <span className="px-2 py-0.5 bg-emerald-400 text-white rounded text-[10px]">+1%</span>
            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px]">+2%+</span>
          </div>
        </div>
      </div>

      {/* Market Sentiment */}
      {data?.sentiment && (
        <div className="bg-card rounded-lg shadow px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Market Sentiment</span>
            <span className={`text-sm font-medium capitalize ${
              data.sentiment.includes('bullish') ? 'text-gain' :
              data.sentiment.includes('bearish') ? 'text-loss' :
              'text-text-secondary'
            }`}>
              {data.sentiment.replace('-', ' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketOverview;
