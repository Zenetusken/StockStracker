import { create } from 'zustand';
import api from '../api/client';

export const useAlertStore = create((set, get) => ({
  alerts: [],
  loading: false,
  error: null,

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
