import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWatchlistStore } from '../stores/watchlistStore';

function RenameWatchlistModal({ watchlist, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateWatchlist = useWatchlistStore((state) => state.updateWatchlist);

  useEffect(() => {
    if (watchlist) {
      setName(watchlist.name || '');
    }
  }, [watchlist]);

  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a watchlist name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateWatchlist(watchlist.id, { name: name.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error renaming watchlist:', err);
      setError(err.message || 'Failed to rename watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName(watchlist?.name || '');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Rename Watchlist
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label
              htmlFor="watchlist-name"
              className="block text-sm font-medium text-text-primary dark:text-gray-300 mb-2"
            >
              Watchlist Name
            </label>
            <input
              type="text"
              id="watchlist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary disabled:opacity-50"
              placeholder="Enter watchlist name"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg text-sm text-loss">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-text-primary dark:text-gray-300 hover:bg-table-header dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RenameWatchlistModal;
