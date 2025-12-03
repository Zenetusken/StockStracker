import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import api from '../api/client';

/**
 * Top Movers Component
 * #118: Top gainers list
 * #119: Top losers list
 * #120: Most active by volume
 */

// Tab options
const TABS = [
  { id: 'gainers', label: 'Gainers', icon: TrendingUp, color: 'text-gain' },
  { id: 'losers', label: 'Losers', icon: TrendingDown, color: 'text-loss' },
  { id: 'mostActive', label: 'Most Active', icon: Activity, color: 'text-brand' },
];

function TopMovers() {
  const [activeTab, setActiveTab] = useState('gainers');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMovers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/market/movers');
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch movers:', err);
      setError('Failed to load market movers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovers();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchMovers, 120000);
    return () => clearInterval(interval);
  }, [fetchMovers]);

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

  const activeData = data?.[activeTab] || [];

  return (
    <div className="bg-card rounded-lg shadow">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? `bg-brand/10 ${tab.color}`
                      : 'text-text-muted hover:text-text-primary hover:bg-page-bg'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={fetchMovers}
            disabled={loading}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-page-bg rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && !data && (
          <div className="flex items-center justify-center py-8 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-loss mb-2">{error}</p>
            <button
              onClick={fetchMovers}
              className="text-sm text-brand hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && activeData.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            No data available
          </div>
        )}

        {activeData.length > 0 && (
          <div className="space-y-2">
            {activeData.slice(0, 5).map((stock, idx) => (
              <Link
                key={stock.symbol}
                to={`/stock/${stock.symbol}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-page-bg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center text-xs font-medium text-text-muted bg-page-bg rounded">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {stock.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-text-secondary">
                    {formatPrice(stock.price)}
                  </span>
                  {activeTab === 'mostActive' ? (
                    <span className="text-sm font-medium text-brand">
                      {formatVolume(stock.volume)}
                    </span>
                  ) : (
                    <span className={`text-sm font-medium ${
                      stock.changePercent >= 0 ? 'text-gain' : 'text-loss'
                    }`}>
                      {formatPercent(stock.changePercent)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopMovers;
