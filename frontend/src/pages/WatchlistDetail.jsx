import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, TrendingUp, TrendingDown, Minus, Edit2, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Download, GripVertical } from 'lucide-react';
import Layout from '../components/Layout';
import { useQuotes } from '../stores/quoteStore';
import { useWatchlistStore } from '../stores/watchlistStore';
import { formatPrice, formatPercentChange, formatNumber } from '../utils/formatters';
import { handleApiError } from '../utils/errorHandler';
import RenameWatchlistModal from '../components/RenameWatchlistModal';
import DeleteWatchlistModal from '../components/DeleteWatchlistModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable row component - uses imported formatters directly (L1 fix: reduced prop drilling)
function SortableRow({ item, quote, navigate, handleRemoveSymbol, removingSymbol }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.symbol });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'default',
  };

  const isPositive = quote?.dp > 0;
  const isNegative = quote?.dp < 0;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-card-hover transition-colors"
    >
      {/* Drag handle */}
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-card-hover rounded transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-5 h-5 text-text-secondary" />
        </button>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">
            {item.symbol}
          </span>
          {quote && (
            <span className={`text-xs ${
              isPositive ? 'text-gain' :
              isNegative ? 'text-loss' :
              'text-text-muted'
            }`}>
              {isPositive ? '▲' : isNegative ? '▼' : '—'}
            </span>
          )}
        </div>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <span className="text-sm text-text-secondary">
          {quote?.name || 'Loading...'}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap text-right cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <span className="text-sm font-medium text-text-primary">
          {quote ? formatPrice(quote.c) : '-'}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap text-right cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <span className={`text-sm font-medium ${
          isPositive ? 'text-gain' :
          isNegative ? 'text-loss' :
          'text-text-muted'
        }`}>
          {quote ? (quote.d > 0 ? '+' : '') + quote.d.toFixed(2) : '-'}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap text-right cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          isPositive ? 'bg-gain/10 text-gain' :
          isNegative ? 'bg-loss/10 text-loss' :
          'bg-mint/10 text-text-secondary'
        }`}>
          {quote ? formatPercentChange(quote.dp) : '-'}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap text-right cursor-pointer"
        onClick={() => navigate(`/stock/${item.symbol}`)}
      >
        <span className="text-sm text-text-secondary">
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
          className="p-1 hover:bg-card-hover rounded transition-colors disabled:opacity-50"
          title="Remove from watchlist"
        >
          {removingSymbol === item.symbol ? (
            <Minus className="w-4 h-4 text-text-secondary animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 text-text-secondary hover:text-loss" />
          )}
        </button>
      </td>
    </tr>
  );
}

function WatchlistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sortColumn, setSortColumn] = useState(null); // null, 'symbol', 'price', 'change', 'percentChange', 'volume'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [quickAddSymbol, setQuickAddSymbol] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState(null);

  // Get watchlist data from centralized store
  const watchlist = useWatchlistStore((state) => state.getWatchlistDetail(id));
  const loading = useWatchlistStore((state) => state.isLoadingDetail[id] || false);
  const error = useWatchlistStore((state) => state.error);
  const fetchWatchlistDetail = useWatchlistStore((state) => state.fetchWatchlistDetail);
  const removeSymbolFromStore = useWatchlistStore((state) => state.removeSymbol);
  const addSymbolToStore = useWatchlistStore((state) => state.addSymbol);
  const reorderItems = useWatchlistStore((state) => state.reorderItems);

  // Get list of symbols for quote subscription
  const symbols = watchlist?.items?.map(item => item.symbol) || [];

  // Subscribe to real-time quotes via centralized store
  const { quotes, connected, reconnecting } = useQuotes(symbols);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch watchlist details from store
  useEffect(() => {
    if (id) {
      fetchWatchlistDetail(id);
    }
  }, [id, fetchWatchlistDetail]);

  // Remove symbol from watchlist using store
  const handleRemoveSymbol = async (symbol) => {
    if (!confirm(`Remove ${symbol} from this watchlist?`)) {
      return;
    }

    try {
      setRemovingSymbol(symbol);
      await removeSymbolFromStore(id, symbol);
    } catch (err) {
      // Use centralized error handler for consistent UX feedback (M4 integration)
      handleApiError(err, 'Remove symbol', { service: 'watchlist-remove' });
    } finally {
      setRemovingSymbol(null);
    }
  };

  // Handle rename success - store handles reactivity automatically
  const handleRenameSuccess = () => {
    // Re-fetch to ensure UI is updated (store will be updated by modal)
    fetchWatchlistDetail(id, true);
  };

  // Handle delete success - navigate away after deletion
  const handleDeleteSuccess = () => {
    navigate('/dashboard');
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
      return <ArrowUpDown className="w-4 h-4 text-text-secondary" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 text-mint" />
      : <ArrowDown className="w-4 h-4 text-mint" />;
  };

  // Handle quick-add symbol using store
  const handleQuickAddSymbol = async (e) => {
    e.preventDefault();

    const symbol = quickAddSymbol.trim().toUpperCase();
    if (!symbol) {
      setQuickAddError('Please enter a symbol');
      return;
    }

    // Check if symbol already in watchlist
    if (watchlist?.items?.some(item => item.symbol === symbol)) {
      setQuickAddError('Symbol already in watchlist');
      return;
    }

    try {
      setQuickAddLoading(true);
      setQuickAddError(null);

      // Add to watchlist using store (store handles validation)
      const result = await addSymbolToStore(id, symbol);

      if (result?.alreadyExists) {
        setQuickAddError('Symbol already in watchlist');
      } else {
        // Clear input on success
        setQuickAddSymbol('');
        setQuickAddError(null);
      }
    } catch (err) {
      console.error('Error adding symbol:', err);
      setQuickAddError(err.message || 'Failed to add symbol');
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

  // Handle drag end using store
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !watchlist?.items) {
      return;
    }

    const oldIndex = watchlist.items.findIndex(item => item.symbol === active.id);
    const newIndex = watchlist.items.findIndex(item => item.symbol === over.id);

    // Create new items array with updated positions
    const newItems = arrayMove(watchlist.items, oldIndex, newIndex).map((item, index) => ({
      ...item,
      position: index,
    }));

    try {
      // Store handles optimistic update and rollback
      await reorderItems(id, newItems);
    } catch (err) {
      console.error('Error reordering items:', err);
      alert('Failed to save new order');
    }
  };

  // Formatters now imported from utils/formatters.js (L1 fix)

  if (loading || (!watchlist && !error)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-text-muted">Loading watchlist...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-loss mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
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
              <h1 className="text-2xl font-bold text-text-primary">
                {watchlist.name}
              </h1>
              <p className="text-sm text-text-secondary">
                {watchlist.items?.length || 0} symbols
                {connected && (
                  <span className="ml-2 text-mint">
                    • Live updates
                  </span>
                )}
                {reconnecting && (
                  <span className="ml-2 text-warning">
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
              className="p-2 hover:bg-card-hover rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-text-secondary" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-line py-1 z-10">
                <button
                  className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-card-hover flex items-center gap-2"
                  onClick={() => {
                    setShowMenu(false);
                    handleExportCSV();
                  }}
                >
                  <Download className="w-4 h-4 text-brand" />
                  Export to CSV
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-card-hover flex items-center gap-2"
                  onClick={() => {
                    setShowMenu(false);
                    setShowRenameModal(true);
                  }}
                >
                  <Edit2 className="w-4 h-4 text-brand" />
                  Rename Watchlist
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-loss hover:bg-card-hover flex items-center gap-2"
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
          <div className="bg-card rounded-lg border border-line p-12 text-center">
            <TrendingUp className="w-12 h-12 text-mint mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No symbols in this watchlist
            </h3>
            <p className="text-text-secondary mb-4">
              Search for stocks and add them to your watchlist
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Watchlist table */}
        {watchlist.items && watchlist.items.length > 0 && (
          <div className="bg-card rounded-lg border border-line overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full" role="table" aria-label={`Stocks in ${watchlist?.name || 'watchlist'}`}>
                <caption className="sr-only">
                  Watchlist stocks with current prices, changes, and volume. Click column headers to sort.
                </caption>
                <thead className="bg-table-header border-b border-line" role="rowgroup">
                  <tr role="row">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider" aria-label="Drag handle">
                      {/* Drag handle column */}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-page-bg transition-colors select-none"
                      onClick={() => handleSort('symbol')}
                      aria-sort={sortColumn === 'symbol' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('symbol')}
                    >
                      <div className="flex items-center gap-2">
                        Symbol
                        {renderSortIcon('symbol')}
                      </div>
                    </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-page-bg transition-colors select-none"
                    onClick={() => handleSort('price')}
                    aria-sort={sortColumn === 'price' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Price
                      {renderSortIcon('price')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-page-bg transition-colors select-none"
                    onClick={() => handleSort('change')}
                    aria-sort={sortColumn === 'change' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSort('change')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Change
                      {renderSortIcon('change')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-page-bg transition-colors select-none"
                    onClick={() => handleSort('percentChange')}
                    aria-sort={sortColumn === 'percentChange' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSort('percentChange')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      % Change
                      {renderSortIcon('percentChange')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:bg-page-bg transition-colors select-none"
                    onClick={() => handleSort('volume')}
                    aria-sort={sortColumn === 'volume' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Volume
                      {renderSortIcon('volume')}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <SortableContext
                items={getSortedItems().map(item => item.symbol)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="divide-y divide-line">
                  {getSortedItems().map((item) => {
                    const quote = quotes[item.symbol];
                    return (
                      <SortableRow
                        key={item.symbol}
                        item={item}
                        quote={quote}
                        navigate={navigate}
                        handleRemoveSymbol={handleRemoveSymbol}
                        removingSymbol={removingSymbol}
                      />
                    );
                  })}
                </tbody>
              </SortableContext>
            </table>
            </DndContext>

            {/* Quick-add symbol form */}
            <div className="border-t border-line p-4 bg-table-header">
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
                    className="w-full px-4 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                    disabled={quickAddLoading}
                  />
                  {quickAddError && (
                    <div className="mt-1 text-sm text-loss">
                      {quickAddError}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={quickAddLoading || !quickAddSymbol.trim()}
                  className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
