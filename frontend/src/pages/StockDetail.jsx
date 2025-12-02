import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useQuote } from '../stores/quoteStore';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';
import MarketStatusBadge from '../components/MarketStatusBadge';
import AddToWatchlistModal from '../components/AddToWatchlistModal';
import StockChart from '../components/StockChart';

function StockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [isPulsing, setIsPulsing] = useState(false);
  const [isAddToWatchlistModalOpen, setIsAddToWatchlistModalOpen] = useState(false);

  // Auth from centralized store
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Profile from centralized store
  const profile = useProfileStore((state) => state.getProfile(symbol));
  const loading = useProfileStore((state) => state.isProfileLoading(symbol));
  const error = useProfileStore((state) => state.getProfileError(symbol));
  const fetchProfile = useProfileStore((state) => state.fetchProfile);

  // Subscribe to real-time quote via centralized store
  const { quote, connected, reconnecting } = useQuote(symbol);

  // Fetch profile on mount
  useEffect(() => {
    if (symbol) {
      fetchProfile(symbol);
    }
  }, [symbol, fetchProfile]);

  // Trigger pulse animation when quote updates
  useEffect(() => {
    if (quote?.lastUpdate) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [quote?.lastUpdate]);

  // Format number with K/M/B
  const formatLargeNumber = (num) => {
    if (!num) return '—';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  // Format price
  const formatPrice = (price) => {
    if (!price && price !== 0) return '—';
    return `$${price.toFixed(2)}`;
  };

  // Format percent
  const formatPercent = (value) => {
    if (!value && value !== 0) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Get color class based on change
  const getChangeColor = (change) => {
    if (!change && change !== 0) return 'text-text-secondary';
    if (change > 0) return 'text-gain';
    if (change < 0) return 'text-loss';
    return 'text-text-secondary';
  };

  // Get background pulse color
  const getPulseColor = (change) => {
    if (!change && change !== 0) return '';
    if (change > 0) return 'bg-gain/10';
    if (change < 0) return 'bg-loss/10';
    return '';
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page-bg">
        <header className="bg-card shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link to="/dashboard" className="text-2xl font-bold text-text-primary">
              StockTracker
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-12 w-12 border-4 border-brand border-t-transparent rounded-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-page-bg">
        <header className="bg-card shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link to="/dashboard" className="text-2xl font-bold text-text-primary">
              StockTracker
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="bg-card shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold text-text-primary">
            StockTracker
          </Link>
          <div className="flex items-center gap-4">
            {/* Market Status */}
            <MarketStatusBadge />

            {/* Connection Status Indicator */}
            {reconnecting && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span>Reconnecting...</span>
              </div>
            )}
            {!connected && !reconnecting && symbol && (
              <div className="flex items-center gap-2 text-sm text-loss">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Disconnected</span>
              </div>
            )}
            {user && (
              <span className="text-sm text-text-muted">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm">
          <Link to="/dashboard" className="text-brand hover:underline">
            Dashboard
          </Link>
          <span className="mx-2 text-text-muted">/</span>
          <span className="text-text-primary">{symbol}</span>
        </nav>

        {/* Quote Card */}
        <div
          className={`bg-card rounded-lg shadow-lg p-6 mb-6 transition-colors duration-300 ${
            isPulsing ? getPulseColor(quote?.change) : ''
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-1">
                {symbol}
              </h1>
              {profile?.name && (
                <p className="text-lg text-text-muted">
                  {profile.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsAddToWatchlistModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors mt-4 md:mt-0"
            >
              <Plus className="w-5 h-5" />
              Add to Watchlist
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Current Price */}
            <div>
              <p className="text-sm text-text-muted mb-1">Current Price</p>
              <p className="text-4xl font-bold font-mono text-text-primary">
                {formatPrice(quote?.current)}
              </p>
              <div className={`flex items-center gap-2 mt-2 ${getChangeColor(quote?.change)}`}>
                {quote?.change !== undefined && (
                  <>
                    <span className="text-xl font-semibold">
                      {quote.change >= 0 ? '▲' : '▼'}
                    </span>
                    <span className="text-xl font-semibold font-mono">
                      {formatPrice(Math.abs(quote.change))}
                    </span>
                    <span className="text-xl font-semibold">
                      ({formatPercent(quote.percentChange)})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Day Range */}
            <div>
              <p className="text-sm text-text-muted mb-2">Day Range</p>
              <div className="space-y-1.5">
                <div className="flex items-center">
                  <span className="text-sm text-text-muted w-24">High</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {formatPrice(quote?.high)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-text-muted w-24">Low</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {formatPrice(quote?.low)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-text-muted w-24">Open</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {formatPrice(quote?.open)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-text-muted w-24">Prev Close</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {formatPrice(quote?.previousClose)}
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Info */}
            <div>
              <p className="text-sm text-text-muted mb-2">Trading Info</p>
              <div className="space-y-1.5">
                <div className="flex items-center">
                  <span className="text-sm text-text-muted w-24">Volume</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {formatLargeNumber(quote?.volume)}
                  </span>
                </div>
              </div>
              {quote?.lastUpdate && (
                <p className="text-xs text-text-muted mt-3">
                  Last updated: {new Date(quote.lastUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stock Chart */}
        <div className="mb-6">
          <StockChart symbol={symbol} chartType="candlestick" timeframe="6M" />
        </div>

        {/* Company Profile */}
        {profile && (
          <div className="bg-card rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-text-muted mb-1">Exchange</p>
                <p className="text-lg text-text-primary font-semibold">
                  {profile.exchange || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">Currency</p>
                <p className="text-lg text-text-primary font-semibold">
                  {profile.currency || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">Market Cap</p>
                <p className="text-lg text-text-primary font-semibold">
                  {profile.marketCapitalization ? formatLargeNumber(profile.marketCapitalization * 1e6) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted mb-1">Industry</p>
                <p className="text-lg text-text-primary font-semibold">
                  {profile.finnhubIndustry || '—'}
                </p>
              </div>
              {profile.weburl && (
                <div className="md:col-span-2">
                  <p className="text-sm text-text-muted mb-1">Website</p>
                  <a
                    href={profile.weburl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg text-brand hover:underline"
                  >
                    {profile.weburl}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add to Watchlist Modal */}
      <AddToWatchlistModal
        isOpen={isAddToWatchlistModalOpen}
        onClose={() => setIsAddToWatchlistModalOpen(false)}
        symbol={symbol}
      />
    </div>
  );
}

export default StockDetail;
