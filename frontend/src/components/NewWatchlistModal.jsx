import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { useWatchlistStore } from '../stores/watchlistStore';
import { WATCHLIST_ICON_OPTIONS } from './WatchlistIcons';

const COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

function NewWatchlistModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIcon, setSelectedIcon] = useState('star');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWatchlist = useWatchlistStore((state) => state.createWatchlist);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Watchlist name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const watchlist = await createWatchlist(name.trim(), selectedColor, selectedIcon);
      setName('');
      setSelectedColor(COLOR_OPTIONS[0]);
      setSelectedIcon('star');
      onSuccess(watchlist);
      onClose();
    } catch (err) {
      console.error('Error creating watchlist:', err);
      setError(err.message || 'Failed to create watchlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedColor(COLOR_OPTIONS[0]);
    setSelectedIcon('star');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Create New Watchlist
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-card-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-sm text-loss">{error}</p>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label
              htmlFor="watchlist-name"
              className="block text-sm font-medium text-text-primary dark:text-gray-300 mb-2"
            >
              Watchlist Name
            </label>
            <input
              id="watchlist-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tech Stocks"
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    selectedColor === color
                      ? 'ring-2 ring-offset-2 ring-brand'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {/* eslint-disable-next-line no-unused-vars -- Icon IS used in JSX below */}
              {WATCHLIST_ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedIcon(name)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedIcon === name
                      ? 'border-brand bg-mint-light'
                      : 'border-line hover:border-text-secondary'
                  }`}
                  title={name}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: selectedIcon === name ? selectedColor : undefined }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-table-header rounded-lg">
            <p className="text-xs font-medium text-text-secondary mb-2">
              Preview
            </p>
            <div className="flex items-center gap-3">
              {(() => {
                const IconComponent = WATCHLIST_ICON_OPTIONS.find((opt) => opt.name === selectedIcon)?.Icon || Star;
                return (
                  <IconComponent
                    className="w-5 h-5"
                    style={{ color: selectedColor }}
                  />
                );
              })()}
              <span className="text-text-primary font-medium">
                {name || 'Watchlist Name'}
              </span>
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Watchlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewWatchlistModal;
