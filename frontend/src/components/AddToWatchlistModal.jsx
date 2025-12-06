import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useWatchlistStore } from '../stores/watchlistStore';
import { LoadingSpinner } from './ui';

function AddToWatchlistModal({ isOpen, onClose, symbol }) {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get watchlists from store
  const watchlists = useWatchlistStore((state) => state.watchlists);
  const loading = useWatchlistStore((state) => state.isLoading);
  const fetchWatchlists = useWatchlistStore((state) => state.fetchWatchlists);
  const addSymbol = useWatchlistStore((state) => state.addSymbol);
  const getDefaultWatchlist = useWatchlistStore((state) => state.getDefaultWatchlist);

  useEffect(() => {
    if (isOpen) {
      fetchWatchlists();
    }
  }, [isOpen, fetchWatchlists]);

  // Select default watchlist when watchlists load
  useEffect(() => {
    if (watchlists.length > 0 && !selectedWatchlistId) {
      const defaultWatchlist = getDefaultWatchlist();
      setSelectedWatchlistId(defaultWatchlist?.id || watchlists[0]?.id);
    }
  }, [watchlists, selectedWatchlistId, getDefaultWatchlist]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedWatchlistId) {
      setError('Please select a watchlist');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addSymbol(selectedWatchlistId, symbol);

      if (result?.alreadyExists) {
        setError('Symbol already in this watchlist');
      } else {
        setSuccess(`${symbol} added to watchlist!`);
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1500);
      }
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      setError(err.message || 'Failed to add symbol to watchlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Add {symbol} to Watchlist
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-card-hover dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-sm text-loss">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-gain/10 border border-gain/30 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5 text-gain" />
              <p className="text-sm text-gain">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : watchlists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-primary dark:text-gray-400 mb-4">
                You don't have any watchlists yet.
              </p>
              <p className="text-sm text-text-secondary dark:text-gray-500">
                Create a watchlist from the sidebar to get started.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary dark:text-gray-300 mb-2">
                  Select Watchlist
                </label>
                <div className="space-y-2">
                  {watchlists.map((watchlist) => (
                    <label
                      key={watchlist.id}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedWatchlistId === watchlist.id
                          ? 'border-brand bg-mint-light'
                          : 'border-line hover:border-text-secondary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="watchlist"
                        value={watchlist.id}
                        checked={selectedWatchlistId === watchlist.id}
                        onChange={() => setSelectedWatchlistId(watchlist.id)}
                        className="w-4 h-4 text-brand"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">
                            {watchlist.name}
                          </span>
                          {watchlist.is_default === 1 && (
                            <span className="text-xs text-text-secondary">
                              (Default)
                            </span>
                          )}
                        </div>
                        {watchlist.item_count > 0 && (
                          <span className="text-sm text-text-secondary dark:text-gray-400">
                            {watchlist.item_count} {watchlist.item_count === 1 ? 'stock' : 'stocks'}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || !selectedWatchlistId}
                >
                  {isSubmitting ? 'Adding...' : 'Add to Watchlist'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default AddToWatchlistModal;
