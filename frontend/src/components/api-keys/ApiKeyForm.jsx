import { useState } from 'react';
import { X, Key, Tag } from 'lucide-react';
import { useApiKeysStore } from '../../stores/apiKeysStore';

export default function ApiKeyForm({ serviceName, serviceDisplayName, onClose, onSuccess }) {
  const [keyValue, setKeyValue] = useState('');
  const [keyName, setKeyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { addKey } = useApiKeysStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!keyValue.trim()) {
      setError('API key is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await addKey(serviceName, keyValue.trim(), keyName.trim() || null);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card dark:!bg-gray-900/90 dark:backdrop-blur-xl rounded-xl shadow-xl w-full max-w-md mx-4 border border-line">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="text-lg font-semibold text-text-primary">
            Add API Key for {serviceDisplayName}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-card-hover transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg text-loss text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              API Key *
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="Enter your API key"
                className="w-full pl-10 pr-4 py-2 border border-line
                         rounded-lg bg-page-bg text-text-primary
                         placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Key Name (optional)
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., Personal Key, Work Account"
                className="w-full pl-10 pr-4 py-2 border border-line
                         rounded-lg bg-page-bg text-text-primary
                         placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              A friendly name to identify this key
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-primary dark:text-gray-300
                       hover:bg-card-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand
                       hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed
                       rounded-lg transition-colors"
            >
              {isSubmitting ? 'Adding...' : 'Add Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
