import { useEffect } from 'react';
import { Database, RefreshCw, Check, AlertCircle } from 'lucide-react';
import useSymbolSync from '../../hooks/useSymbolSync';

/**
 * SymbolSyncCard Component
 * Displays symbol database status and allows triggering sync
 */
export default function SymbolSyncCard() {
  const {
    status,
    loading,
    syncing,
    error,
    fetchStatus,
    triggerSync,
    formatLastSync,
  } = useSymbolSync();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    try {
      await triggerSync(false);
    } catch (err) {
      // Error is already handled in the hook
    }
  };

  const handleRefreshSync = async () => {
    try {
      await triggerSync(true);
    } catch (err) {
      // Error is already handled in the hook
    }
  };

  const totalCount = status?.totalCount || 0;
  const stockCount = status?.countsByType?.['Common Stock'] || 0;
  const etfCount = status?.countsByType?.['ETP'] || 0;
  const lastSync = status?.syncInfo ? formatLastSync(status.syncInfo) : 'Never';
  const hasSyncedData = status?.hasSyncedData || false;

  // Determine sync status
  const syncStatus = status?.syncInfo?.find(s => s.exchange === 'US')?.sync_status || 'pending';

  return (
    <div className="bg-panel dark:!bg-white/5 dark:backdrop-blur-md rounded-lg border border-line overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mint-light flex items-center justify-center">
            <Database className="w-5 h-5 text-mint" />
          </div>
          <div>
            <h3 className="font-medium text-text-primary">
              Symbol Database
            </h3>
            <p className="text-sm text-text-secondary dark:text-gray-400">
              Local cache for instant search
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
          hasSyncedData
            ? 'bg-gain/20 text-gain'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          {hasSyncedData ? (
            <>
              <Check className="w-3 h-3" />
              Synced
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              Not Synced
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary dark:text-gray-100">
              {totalCount.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted dark:text-gray-500">
              Total Symbols
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary dark:text-gray-100">
              {stockCount.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted dark:text-gray-500">
              Stocks
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary dark:text-gray-100">
              {etfCount.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted dark:text-gray-500">
              ETFs
            </div>
          </div>
        </div>

        {/* Last Sync */}
        <div className="text-sm text-text-secondary dark:text-gray-400 flex items-center justify-between">
          <span>Last synced:</span>
          <span className="font-medium text-text-primary dark:text-gray-300">
            {lastSync}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg text-sm text-loss">
            {error}
          </div>
        )}

        {/* Benefits */}
        {!hasSyncedData && (
          <div className="p-3 bg-mint/10 rounded-lg text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">
              Enable instant search
            </p>
            <p>
              Sync the symbol database to enable lightning-fast local search (~5ms vs ~300ms API).
              Requires a valid Finnhub API key.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              hasSyncedData
                ? 'bg-page-bg text-text-primary hover:bg-card-hover'
                : 'bg-brand text-white hover:bg-brand-hover'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : hasSyncedData ? 'Update' : 'Sync Now'}
          </button>

          {hasSyncedData && (
            <button
              onClick={handleRefreshSync}
              disabled={syncing || loading}
              className="px-4 py-2 rounded-lg font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear and resync all symbols"
            >
              Full Refresh
            </button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-text-muted dark:text-gray-500 text-center">
          Syncs all US stocks and ETFs from Finnhub (~8,000 symbols)
        </p>
      </div>
    </div>
  );
}
