import { create } from 'zustand';
import api from '../api/client';

// Cooldown to prevent alert spam (5 minutes per alert)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export const useAlertStore = create((set, get) => ({
  alerts: [],
  alertHistory: [],
  loading: false,
  error: null,
  notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  triggeredTimestamps: {}, // { alertId: timestamp } to prevent spam

  // Fetch all alerts
  fetchAlerts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.get('/alerts');
      set({ alerts: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Fetch alert history
  fetchAlertHistory: async () => {
    try {
      const data = await api.get('/alerts/history/all');
      set({ alertHistory: data });
      return data;
    } catch {
      // Silent failure - alert history is supplementary data
      return [];
    }
  },

  // Request browser notification permission
  requestNotificationPermission: async () => {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      set({ notificationPermission: permission });
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  },

  // Get active alerts for specific symbols
  getActiveAlertsForSymbols: (symbols) => {
    const { alerts } = get();
    const upperSymbols = symbols.map(s => s.toUpperCase());
    return alerts.filter(
      alert => alert.is_active && upperSymbols.includes(alert.symbol.toUpperCase())
    );
  },

  // Check if alert can trigger (respects cooldown)
  canTriggerAlert: (alertId) => {
    const { triggeredTimestamps } = get();
    const lastTriggered = triggeredTimestamps[alertId];
    if (!lastTriggered) return true;
    return Date.now() - lastTriggered > ALERT_COOLDOWN_MS;
  },

  // Mark alert as triggered
  markAlertTriggered: (alertId, quote) => {
    set((state) => ({
      triggeredTimestamps: {
        ...state.triggeredTimestamps,
        [alertId]: Date.now()
      }
    }));

    // Record in backend (fire and forget)
    api.post(`/alerts/${alertId}/trigger`, {
      triggered_price: quote.current
    }).catch(err => console.error('Failed to record alert trigger:', err));

    // If non-recurring, disable the alert
    const alert = get().alerts.find(a => a.id === alertId);
    if (alert && !alert.is_recurring) {
      get().updateAlert(alertId, { is_active: 0 });
    }
  },

  // Create a new alert
  createAlert: async (alertData) => {
    set({ loading: true, error: null });
    try {
      const newAlert = await api.post('/alerts', alertData);
      set((state) => ({
        alerts: [newAlert, ...state.alerts],
        loading: false
      }));
      return newAlert;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Update an alert
  updateAlert: async (id, alertData) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.put(`/alerts/${id}`, alertData);
      set((state) => ({
        alerts: state.alerts.map(a => a.id === id ? updated : a),
        loading: false
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Delete an alert
  deleteAlert: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/alerts/${id}`);
      set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Toggle alert active status
  toggleAlert: async (id) => {
    const alert = get().alerts.find(a => a.id === id);
    if (!alert) return;

    return get().updateAlert(id, { is_active: alert.is_active ? 0 : 1 });
  },

  // Clear error
  clearError: () => set({ error: null })
}));

export default useAlertStore;
