import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

function AddToWatchlistModal({ isOpen, onClose, symbol }) {
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchWatchlists();
    }
  }, [isOpen]);

  const fetchWatchlists = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:3001/api/watchlists', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWatchlists(data);
        // Select the default or first watchlist
        if (data.length > 0) {
          const defaultWatchlist = data.find((w) => w.is_default === 1);
          setSelectedWatchlistId(defaultWatchlist ? defaultWatchlist.id : data[0].id);
        }
      } else {
        setError('Failed to load watchlists');
      }
    } catch (err) {
      console.error('Error fetching watchlists:', err);
      setError('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

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
      const response = await fetch(
        `http://localhost:3001/api/watchlists/${selectedWatchlistId}/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ symbol }),
        }
      );

      if (response.ok) {
        setSuccess(`${symbol} added to watchlist!`);
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add symbol to watchlist');
      }
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      setError('Failed to add symbol to watchlist. Please try again.');
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add {symbol} to Watchlist
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : watchlists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You don't have any watchlists yet.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Create a watchlist from the sidebar to get started.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Watchlist
                </label>
                <div className="space-y-2">
                  {watchlists.map((watchlist) => (
                    <label
                      key={watchlist.id}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedWatchlistId === watchlist.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="watchlist"
                        value={watchlist.id}
                        checked={selectedWatchlistId === watchlist.id}
                        onChange={() => setSelectedWatchlistId(watchlist.id)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {watchlist.name}
                          </span>
                          {watchlist.is_default === 1 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              (Default)
                            </span>
                          )}
                        </div>
                        {watchlist.item_count > 0 && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
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
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
