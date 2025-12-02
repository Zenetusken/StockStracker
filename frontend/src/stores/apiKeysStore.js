import { create } from 'zustand';

const API_BASE = 'http://localhost:3001/api/admin/api-keys';

export const useApiKeysStore = create((set, get) => ({
  services: [],
  isLoading: false,
  error: null,
  lastFetch: null,

  // Detailed usage with individual call timestamps for sliding window tracking
  // Map of serviceName -> { limits: [...], timestamp: ... }
  detailedUsage: {},

  // Burst event hit counts for per-second rate limits
  // Map of serviceName -> { limitType: { hitCount, lastHitAt } }
  burstEvents: {},

  // Fetch all services with their status
  fetchServices: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/services`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const data = await response.json();
      set({
        services: data.services,
        isLoading: false,
        lastFetch: Date.now()
      });
      return data.services;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Get overall status
  getOverallStatus: () => {
    const { services } = get();
    if (services.length === 0) {
      return { status: 'not_configured', color: 'gray' };
    }

    let hasConfigured = false;
    let hasCritical = false;
    let hasWarning = false;

    for (const service of services) {
      if (service.active_keys > 0) {
        hasConfigured = true;
        if (service.usage) {
          if (service.usage.percentUsed > 90) {
            hasCritical = true;
          } else if (service.usage.percentUsed > 70) {
            hasWarning = true;
          }
        }
      }
    }

    if (!hasConfigured) {
      return { status: 'not_configured', color: 'gray' };
    }
    if (hasCritical) {
      return { status: 'critical', color: 'red' };
    }
    if (hasWarning) {
      return { status: 'warning', color: 'amber' };
    }
    return { status: 'healthy', color: 'green' };
  },

  // Add a new API key
  addKey: async (serviceName, keyValue, keyName) => {
    try {
      const response = await fetch(`${API_BASE}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceName, keyValue, keyName })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add key');
      }
      await get().fetchServices();
      return await response.json();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Update an API key
  updateKey: async (keyId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update key');
      }
      await get().fetchServices();
      return await response.json();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Delete an API key
  deleteKey: async (keyId) => {
    try {
      const response = await fetch(`${API_BASE}/keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete key');
      }
      await get().fetchServices();
      return await response.json();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Test an API key
  testKey: async (keyId) => {
    try {
      const response = await fetch(`${API_BASE}/keys/${keyId}/test`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test key');
      }
      return await response.json();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Fetch detailed usage for a service (with individual call timestamps)
  fetchDetailedUsage: async (serviceName) => {
    try {
      const response = await fetch(`${API_BASE}/services/${serviceName}/usage`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch detailed usage');
      }
      const data = await response.json();

      // Store the detailed usage data
      set((state) => ({
        detailedUsage: {
          ...state.detailedUsage,
          [serviceName]: data
        }
      }));

      return data;
    } catch (error) {
      console.error(`[apiKeysStore] Error fetching detailed usage for ${serviceName}:`, error);
      throw error;
    }
  },

  // Get current count for a specific limit type (filters expired calls client-side)
  getCurrentCount: (serviceName, limitType) => {
    const { detailedUsage } = get();
    const usage = detailedUsage[serviceName];
    if (!usage || !usage.limits) return 0;

    const limit = usage.limits.find((l) => l.type === limitType);
    if (!limit || !limit.calls) return 0;

    const now = Date.now();
    return limit.calls.filter((c) => c.expiresAt > now).length;
  },

  // Get calls for a specific limit type (with current TTLs)
  getCalls: (serviceName, limitType) => {
    const { detailedUsage } = get();
    const usage = detailedUsage[serviceName];
    if (!usage || !usage.limits) return [];

    const limit = usage.limits.find((l) => l.type === limitType);
    if (!limit || !limit.calls) return [];

    const now = Date.now();
    return limit.calls
      .filter((c) => c.expiresAt > now)
      .map((c) => ({
        ...c,
        ttlSeconds: Math.max(0, Math.ceil((c.expiresAt - now) / 1000))
      }))
      .sort((a, b) => a.expiresAt - b.expiresAt);
  },

  // Fetch burst events for a service (per-second rate limit hits)
  fetchBurstEvents: async (serviceName) => {
    try {
      const response = await fetch(`${API_BASE}/services/${serviceName}/burst-events`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch burst events');
      }
      const data = await response.json();

      // Store the burst event data
      set((state) => ({
        burstEvents: {
          ...state.burstEvents,
          [serviceName]: data.events
        }
      }));

      return data.events;
    } catch (error) {
      console.error(`[apiKeysStore] Error fetching burst events for ${serviceName}:`, error);
      throw error;
    }
  },

  // Get burst event hit count for a specific limit type
  getBurstEventCount: (serviceName, limitType) => {
    const { burstEvents } = get();
    const events = burstEvents[serviceName];
    if (!events || !events[limitType]) return 0;
    return events[limitType].hitCount || 0;
  },

  // Clear error
  clearError: () => set({ error: null })
}));

export default useApiKeysStore;
