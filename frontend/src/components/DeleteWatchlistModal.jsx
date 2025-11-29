import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

function DeleteWatchlistModal({ watchlist, isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3001/api/watchlists/${watchlist.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete watchlist');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error deleting watchlist:', err);
      setError('Failed to delete watchlist');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const isDefault = watchlist?.is_default === 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Delete Watchlist
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isDefault ? (
            <>
              {/* Default watchlist warning */}
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    This is your default watchlist and cannot be deleted.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You can rename it or create a new watchlist instead.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Delete confirmation */}
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Are you sure you want to delete <span className="font-semibold">"{watchlist?.name}"</span>?
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This will permanently remove the watchlist and all its symbols. This action cannot be undone.
                  </p>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDefault ? 'Close' : 'Cancel'}
            </button>
            {!isDefault && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete Watchlist'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeleteWatchlistModal;
