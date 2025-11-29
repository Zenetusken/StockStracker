import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import useSSE from '../hooks/useSSE';
import MarketStatusBadge from '../components/MarketStatusBadge';
import AddToWatchlistModal from '../components/AddToWatchlistModal';

function StockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [user, setUser] = useState(null);
  const [isAddToWatchlistModalOpen, setIsAddToWatchlistModalOpen] = useState(false);

  // SSE connection for real-time updates
  const { connected, reconnecting } = useSSE(
    symbol ? [symbol] : [],
    (data) => {
      // Handle quote update
      if (data.type === 'quote_update' && data.quotes && data.quotes.length > 0) {
        const quoteData = data.quotes.find((q) => q.symbol === symbol);
        if (quoteData && quoteData.quote) {
          setQuote(quoteData.quote);
          setLastUpdate(new Date());

          // Trigger pulse animation
          setIsPulsing(true);
          setTimeout(() => setIsPulsing(false), 300);
        }
      }
    },
    (err) => {
      console.error('SSE error:', err);
    }
  );

  useEffect(() => {
    // Get user from sessionStorage
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  // Fetch quote and profile
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch quote
        const quoteResponse = await fetch(
          `http://localhost:3001/api/quotes/${symbol}`,
          {
            credentials: 'include',
          }
        );

        if (!quoteResponse.ok) {
          throw new Error('Failed to fetch quote data');
        }

        const quoteData = await quoteResponse.json();
        setQuote(quoteData);
        setLastUpdate(new Date());

        // Fetch profile
        const profileResponse = await fetch(
          `http://localhost:3001/api/quotes/${symbol}/profile`,
          {
            credentials: 'include',
          }
        );

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile(profileData);
        }
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol]);

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
    if (!change && change !== 0) return 'text-gray-600 dark:text-gray-400';
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // Get background pulse color
  const getPulseColor = (change) => {
    if (!change && change !== 0) return '';
    if (change > 0) return 'bg-green-100 dark:bg-green-900';
    if (change < 0) return 'bg-red-100 dark:bg-red-900';
    return '';
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      sessionStorage.removeItem('user');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link to="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
              StockTracker Pro
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-12 w-12 border-4 border-light-primary dark:border-dark-primary border-t-transparent rounded-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link to="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
              StockTracker Pro
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
            StockTracker Pro
          </Link>
          <div className="flex items-center gap-4">
            {/* Market Status */}
            <MarketStatusBadge />

            {/* Connection Status Indicator */}
            {reconnecting && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span>Reconnecting...</span>
              </div>
            )}
            {!connected && !reconnecting && symbol && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Disconnected</span>
              </div>
            )}
            {user && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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
          <Link to="/dashboard" className="text-light-primary dark:text-dark-primary hover:underline">
            Dashboard
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-900 dark:text-white">{symbol}</span>
        </nav>

        {/* Quote Card */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 transition-colors duration-300 ${
            isPulsing ? getPulseColor(quote?.change) : ''
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {symbol}
              </h1>
              {profile?.name && (
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {profile.name}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsAddToWatchlistModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mt-4 md:mt-0"
            >
              <Plus className="w-5 h-5" />
              Add to Watchlist
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Current Price */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Price</p>
              <p className="text-4xl font-bold font-mono text-gray-900 dark:text-white">
                {formatPrice(quote?.c)}
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
                      ({formatPercent(quote.dp)})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* High / Low */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Day Range</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">High:</span>
                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                    {formatPrice(quote?.h)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Low:</span>
                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                    {formatPrice(quote?.l)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Open:</span>
                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                    {formatPrice(quote?.o)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Prev Close:</span>
                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                    {formatPrice(quote?.pc)}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trading Info</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Volume:</span>
                  <span className="font-mono text-gray-900 dark:text-white font-semibold">
                    {formatLargeNumber(quote?.v)}
                  </span>
                </div>
                {lastUpdate && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company Profile */}
        {profile && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Exchange</p>
                <p className="text-lg text-gray-900 dark:text-white font-semibold">
                  {profile.exchange || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Currency</p>
                <p className="text-lg text-gray-900 dark:text-white font-semibold">
                  {profile.currency || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Market Cap</p>
                <p className="text-lg text-gray-900 dark:text-white font-semibold">
                  {profile.marketCapitalization ? formatLargeNumber(profile.marketCapitalization * 1e6) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Industry</p>
                <p className="text-lg text-gray-900 dark:text-white font-semibold">
                  {profile.finnhubIndustry || '—'}
                </p>
              </div>
              {profile.weburl && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Website</p>
                  <a
                    href={profile.weburl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg text-light-primary dark:text-dark-primary hover:underline"
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
