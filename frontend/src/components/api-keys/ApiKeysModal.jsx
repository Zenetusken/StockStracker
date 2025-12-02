import { useState, useEffect } from 'react';
import { X, RefreshCw, Key } from 'lucide-react';
import { useApiKeysStore } from '../../stores/apiKeysStore';
import ApiServiceCard from './ApiServiceCard';
import ApiKeyForm from './ApiKeyForm';
import SymbolSyncCard from './SymbolSyncCard';

export default function ApiKeysModal({ isOpen, onClose }) {
  const { services, isLoading, error, fetchServices, clearError } = useApiKeysStore();
  const [addingKeyForService, setAddingKeyForService] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchServices();
    }
  }, [isOpen, fetchServices]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    clearError();
    fetchServices();
  };

  const handleAddKey = (serviceName) => {
    const service = services.find(s => s.name === serviceName);
    setAddingKeyForService(service);
  };

  const handleKeyAdded = () => {
    setAddingKeyForService(null);
    fetchServices();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-card shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-brand" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                API Keys Manager
              </h2>
              <p className="text-sm text-text-secondary">
                Manage your API keys and monitor rate limits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-card-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-card-hover transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-4 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-loss">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-sm text-loss underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoading && services.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Symbol Database Sync */}
              <SymbolSyncCard />

              {/* Divider */}
              <div className="border-t border-line pt-4">
                <h3 className="text-sm font-medium text-text-muted mb-3">
                  API Services
                </h3>
              </div>

              {services.map((service) => (
                <ApiServiceCard
                  key={service.id}
                  service={service}
                  onAddKey={handleAddKey}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-table-header dark:!bg-white/5 dark:backdrop-blur-md">
          <p className="text-xs text-text-muted text-center">
            API keys are stored locally and used for authenticated API requests.
            Rate limits refresh according to each provider's policy.
          </p>
        </div>
      </div>

      {/* Add Key Form */}
      {addingKeyForService && (
        <ApiKeyForm
          serviceName={addingKeyForService.name}
          serviceDisplayName={addingKeyForService.display_name}
          onClose={() => setAddingKeyForService(null)}
          onSuccess={handleKeyAdded}
        />
      )}
    </>
  );
}
