import { useState, useEffect, useRef } from 'react';
import { Plus, Check, Star, ChevronDown } from 'lucide-react';
import { useWatchlistStore } from '../../stores/watchlistStore';
import { LoadingSpinner } from '../ui';

/**
 * WatchlistQuickAdd - Inline dropdown for quickly adding a symbol to a watchlist
 * Used in search results to allow one-click watchlist additions
 */
function WatchlistQuickAdd({ symbol, onSuccess, className = '' }) {
  // N6 fix: Use store instead of local state and direct API calls
  const watchlists = useWatchlistStore((state) => state.watchlists);
  const loading = useWatchlistStore((state) => state.isLoading);

  const [isOpen, setIsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [addedTo, setAddedTo] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setError('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Fetch watchlists when dropdown opens
  // N6 fix: Use store fetchWatchlists with caching
  useEffect(() => {
    if (isOpen && watchlists.length === 0) {
      const { fetchWatchlists } = useWatchlistStore.getState();
      fetchWatchlists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only fetch when opening if empty
  }, [isOpen]);

  // Reset success state after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
        setAddedTo(null);
        setIsOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleAddToWatchlist = async (watchlistId, watchlistName) => {
    setAdding(true);
    setError('');

    try {
      // Use watchlistStore.addSymbol which handles:
      // - API call with CSRF token
      // - Optimistic store update with rollback on failure
      // - Store state sync (no custom events needed)
      await useWatchlistStore.getState().addSymbol(watchlistId, symbol);
      setSuccess(true);
      setAddedTo(watchlistName);
      onSuccess?.(symbol, watchlistName);
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      if (err.message?.includes('already')) {
        setError('Already in list');
      } else {
        setError(err.message || 'Failed to add');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(!isOpen);
    setError('');
  };

  const handleDropdownClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleWatchlistClick = (e, watchlistId, watchlistName) => {
    e.stopPropagation();
    e.preventDefault();
    handleAddToWatchlist(watchlistId, watchlistName);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
          success
            ? 'bg-gain/20 text-gain'
            : isOpen
            ? 'bg-brand/20 text-brand dark:bg-dark-primary/20 dark:text-dark-primary'
            : 'text-text-secondary hover:text-brand hover:bg-brand/10 dark:text-gray-400 dark:hover:text-dark-primary dark:hover:bg-dark-primary/10'
        }`}
        title={success ? `Added to ${addedTo}` : 'Add to watchlist'}
      >
        {success ? (
          <Check className="w-4 h-4" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !success && (
        <div
          onClick={handleDropdownClick}
          className="absolute right-0 top-full mt-1 w-48 bg-card border border-line rounded-lg shadow-lg z-[100] overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 py-2 bg-table-header border-b border-line">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-text-secondary uppercase">
                Add to Watchlist
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : error && watchlists.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-loss">{error}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // N6 fix: Use store fetchWatchlists with force flag
                    useWatchlistStore.getState().fetchWatchlists(true);
                  }}
                  className="mt-2 text-xs text-brand hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : watchlists.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-text-secondary">
                  No watchlists yet
                </p>
              </div>
            ) : (
              watchlists.map((watchlist) => (
                <button
                  key={watchlist.id}
                  onClick={(e) => handleWatchlistClick(e, watchlist.id, watchlist.name)}
                  disabled={adding}
                  className="w-full px-3 py-2 text-left hover:bg-card-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: watchlist.color || '#3B82F6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">
                      {watchlist.name}
                    </div>
                    {watchlist.item_count > 0 && (
                      <div className="text-xs text-text-muted">
                        {watchlist.item_count} {watchlist.item_count === 1 ? 'stock' : 'stocks'}
                      </div>
                    )}
                  </div>
                  {watchlist.is_default === 1 && (
                    <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Error display */}
          {error && watchlists.length > 0 && (
            <div className="px-3 py-2 bg-loss/10 border-t border-loss/30">
              <p className="text-xs text-loss">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Success Toast (mini) */}
      {success && isOpen && (
        <div
          onClick={handleDropdownClick}
          className="absolute right-0 top-full mt-1 px-3 py-2 bg-gain/10 border border-gain/30 rounded-lg shadow-lg z-[100] whitespace-nowrap"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-gain" />
            <span className="text-sm text-gain font-medium">
              Added to {addedTo}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatchlistQuickAdd;
