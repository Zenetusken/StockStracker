import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, TrendingUp, TrendingDown, Minus, Edit2, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
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
  const [sortColumn, setSortColumn] = useState(null); // null, 'symbol', 'price', 'change', 'percentChange', 'volume'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [quickAddSymbol, setQuickAddSymbol] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState(null);

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

  // Handle column sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sorted items
  const getSortedItems = () => {
    if (!watchlist?.items || !sortColumn) {
      return watchlist?.items || [];
    }

    const items = [...watchlist.items];

    items.sort((a, b) => {
      const quoteA = quotes[a.symbol];
      const quoteB = quotes[b.symbol];

      let valueA, valueB;

      switch (sortColumn) {
        case 'symbol':
          valueA = a.symbol;
          valueB = b.symbol;
          break;
        case 'price':
          valueA = quoteA?.c || 0;
          valueB = quoteB?.c || 0;
          break;
        case 'change':
          valueA = quoteA?.d || 0;
          valueB = quoteB?.d || 0;
          break;
        case 'percentChange':
          valueA = quoteA?.dp || 0;
          valueB = quoteB?.dp || 0;
          break;
        case 'volume':
          valueA = quoteA?.v || 0;
          valueB = quoteB?.v || 0;
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof valueA === 'string') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      // Handle number comparison
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });

    return items;
  };

  // Render sort icon for column header
  const renderSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  };

  // Handle quick-add symbol
  const handleQuickAddSymbol = async (e) => {
    e.preventDefault();

    const symbol = quickAddSymbol.trim().toUpperCase();
    if (!symbol) {
      setQuickAddError('Please enter a symbol');
      return;
    }

    // Check if symbol already in watchlist
    if (watchlist.items.some(item => item.symbol === symbol)) {
      setQuickAddError('Symbol already in watchlist');
      return;
    }

    try {
      setQuickAddLoading(true);
      setQuickAddError(null);

      // Validate symbol exists by checking quote
      const quoteResponse = await fetch(`http://localhost:3001/api/market/quote/${symbol}`, {
        credentials: 'include',
      });

      if (!quoteResponse.ok) {
        setQuickAddError('Invalid symbol or unable to fetch quote');
        return;
      }

      // Add to watchlist
      const response = await fetch(`http://localhost:3001/api/watchlists/${id}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update local state
        setWatchlist(prev => ({
          ...prev,
          items: [...(prev.items || []), data],
        }));

        // Clear input
        setQuickAddSymbol('');
        setQuickAddError(null);
      } else {
        const data = await response.json();
        setQuickAddError(data.error || 'Failed to add symbol');
      }
    } catch (err) {
      console.error('Error adding symbol:', err);
      setQuickAddError('Failed to add symbol');
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Handle CSV export
  const handleExportCSV = () => {
    try {
      // Prepare CSV headers
      const headers = ['Symbol', 'Name', 'Price', 'Change', '% Change', 'Volume'];

      // Prepare CSV rows
      const rows = watchlist.items.map(item => {
        const quote = quotes[item.symbol];
        return [
          item.symbol,
          quote?.name || '',
          quote?.c ? quote.c.toFixed(2) : '',
          quote?.d ? quote.d.toFixed(2) : '',
          quote?.dp ? quote.dp.toFixed(2) : '',
          quote?.v ? quote.v.toString() : ''
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${watchlist.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke URL to free memory
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export CSV');
    }
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
                    handleExportCSV();
                  }}
                >
                  <Download className="w-4 h-4" />
                  Export to CSV
                </button>
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
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-2">
                      Symbol
                      {renderSortIcon('symbol')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Price
                      {renderSortIcon('price')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('change')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Change
                      {renderSortIcon('change')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('percentChange')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      % Change
                      {renderSortIcon('percentChange')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Volume
                      {renderSortIcon('volume')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {getSortedItems().map((item) => {
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

            {/* Quick-add symbol form */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
              <form onSubmit={handleQuickAddSymbol} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={quickAddSymbol}
                    onChange={(e) => {
                      setQuickAddSymbol(e.target.value.toUpperCase());
                      setQuickAddError(null);
                    }}
                    placeholder="Enter symbol (e.g., TSLA, MSFT)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={quickAddLoading}
                  />
                  {quickAddError && (
                    <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {quickAddError}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={quickAddLoading || !quickAddSymbol.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Symbol'}
                </button>
              </form>
            </div>
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
