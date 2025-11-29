import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, TrendingUp, TrendingDown, Minus, Edit2, MoreVertical } from 'lucide-react';
import Layout from '../components/Layout';
import useSSE from '../hooks/useSSE';
import RenameWatchlistModal from '../components/RenameWatchlistModal';
import DeleteWatchlistModal from '../components/DeleteWatchlistModal';

function WatchlistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch watchlist details
  useEffect(() => {
    fetchWatchlist();
  }, [id]);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/watchlists/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWatchlist(data);
        setError(null);
      } else if (response.status === 404) {
        setError('Watchlist not found');
      } else {
        setError('Failed to load watchlist');
      }
    } catch (err) {
      console.error('Error fetching watchlist:', err);
      setError('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  // Get list of symbols for SSE subscription
  const symbols = watchlist?.items?.map(item => item.symbol) || [];

  // Handle quote updates from SSE
  const handleQuoteUpdate = useCallback((data) => {
    if (data.type === 'quote_update' && data.quotes) {
      setQuotes(prev => ({
        ...prev,
        ...data.quotes,
      }));
    }
  }, []);

  // Subscribe to real-time quotes
  const { connected, reconnecting } = useSSE(symbols, handleQuoteUpdate);

  // Remove symbol from watchlist
  const handleRemoveSymbol = async (symbol) => {
    if (!confirm(`Remove ${symbol} from this watchlist?`)) {
      return;
    }

    try {
      setRemovingSymbol(symbol);
      const response = await fetch(
        `http://localhost:3001/api/watchlists/${id}/items/${symbol}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        // Update local state
        setWatchlist(prev => ({
          ...prev,
          items: prev.items.filter(item => item.symbol !== symbol),
        }));

        // Remove quote from state
        setQuotes(prev => {
          const newQuotes = { ...prev };
          delete newQuotes[symbol];
          return newQuotes;
        });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove symbol');
      }
    } catch (err) {
      console.error('Error removing symbol:', err);
      alert('Failed to remove symbol');
    } finally {
      setRemovingSymbol(null);
    }
  };

  // Handle rename success
  const handleRenameSuccess = (updatedWatchlist) => {
    setWatchlist(prev => ({
      ...prev,
      name: updatedWatchlist.name,
      color: updatedWatchlist.color,
      icon: updatedWatchlist.icon,
    }));
    // Trigger a page refresh event for sidebar to update
    window.dispatchEvent(new Event('watchlist-updated'));
  };

  // Handle delete success
  const handleDeleteSuccess = () => {
    // Navigate back to dashboard after deletion
    navigate('/dashboard');
    // Trigger a page refresh event for sidebar to update
    window.dispatchEvent(new Event('watchlist-updated'));
  };

  // Format number with K/M/B suffix
  const formatNumber = (num) => {
    if (!num) return '-';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
  };

  // Format price
  const formatPrice = (price) => {
    if (!price) return '-';
    return '$' + price.toFixed(2);
  };

  // Format percent change
  const formatPercentChange = (change) => {
    if (!change) return '-';
    const sign = change > 0 ? '+' : '';
    return sign + change.toFixed(2) + '%';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Loading watchlist...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: watchlist.color + '20' }}
            >
              <TrendingUp
                className="w-6 h-6"
                style={{ color: watchlist.color }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {watchlist.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {watchlist.items?.length || 0} symbols
                {connected && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    • Live updates
                  </span>
                )}
                {reconnecting && (
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    • Reconnecting...
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                <button
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    setShowMenu(false);
                    setShowRenameModal(true);
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                  Rename Watchlist
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteModal(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Watchlist
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {(!watchlist.items || watchlist.items.length === 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No symbols in this watchlist
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Search for stocks and add them to your watchlist
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Watchlist table */}
        {watchlist.items && watchlist.items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    % Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Volume
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {watchlist.items.map((item) => {
                  const quote = quotes[item.symbol];
                  const isPositive = quote?.dp > 0;
                  const isNegative = quote?.dp < 0;

                  return (
                    <tr
                      key={item.symbol}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                      onClick={(e) => {
                        if (e.target.closest('button')) return; // Don't navigate if clicking button
                        navigate(`/stock/${item.symbol}`);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.symbol}
                          </span>
                          {quote && (
                            <span className={`text-xs ${
                              isPositive ? 'text-green-600 dark:text-green-400' :
                              isNegative ? 'text-red-600 dark:text-red-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {isPositive ? '▲' : isNegative ? '▼' : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {quote?.name || 'Loading...'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {quote ? formatPrice(quote.c) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          isPositive ? 'text-green-600 dark:text-green-400' :
                          isNegative ? 'text-red-600 dark:text-red-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {quote ? (quote.d > 0 ? '+' : '') + quote.d.toFixed(2) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          isPositive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                          isNegative ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
                        }`}>
                          {quote ? formatPercentChange(quote.dp) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {quote ? formatNumber(quote.v) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSymbol(item.symbol);
                          }}
                          disabled={removingSymbol === item.symbol}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                          title="Remove from watchlist"
                        >
                          {removingSymbol === item.symbol ? (
                            <Minus className="w-4 h-4 text-gray-400 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <RenameWatchlistModal
        watchlist={watchlist}
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onSuccess={handleRenameSuccess}
      />

      <DeleteWatchlistModal
        watchlist={watchlist}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={handleDeleteSuccess}
      />
    </Layout>
  );
}

export default WatchlistDetail;
