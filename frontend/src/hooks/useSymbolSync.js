import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3001/api';

/**
 * useSymbolSync Hook
 * Manages symbol database sync status and triggers
 */
export default function useSymbolSync() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch current symbol database status
   */
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/symbols/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch symbol status');
      }

      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Trigger symbol sync from Finnhub API
   * @param {boolean} refresh - If true, clear existing data before sync
   */
  const triggerSync = useCallback(async (refresh = false) => {
    setSyncing(true);
    setError(null);

    try {
      const url = new URL(`${API_BASE}/symbols/sync`);
      if (refresh) {
        url.searchParams.append('refresh', 'true');
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync symbols');
      }

      // Refresh status after successful sync
      await fetchStatus();

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [fetchStatus]);

  /**
   * Format last sync time for display
   */
  const formatLastSync = useCallback((syncInfo) => {
    if (!syncInfo || syncInfo.length === 0) return 'Never';

    const usSync = syncInfo.find(s => s.exchange === 'US');
    if (!usSync || !usSync.last_sync_at) return 'Never';

    const syncDate = new Date(usSync.last_sync_at);
    const now = new Date();
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return syncDate.toLocaleDateString();
  }, []);

  return {
    status,
    loading,
    syncing,
    error,
    fetchStatus,
    triggerSync,
    formatLastSync,
  };
}
