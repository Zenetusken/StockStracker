import { create } from 'zustand';
import api from '../api/client';

/**
 * Settings Store
 * Manages user preferences loaded from backend
 * #153-156: Theme, Chart Type, Timeframe, Decimal Places preferences
 */

// Map backend chart type names to frontend names
const CHART_TYPE_MAP = {
  candle: 'candlestick',
  line: 'line',
  area: 'area',
};

// Reverse mapping for saving to backend
const CHART_TYPE_REVERSE_MAP = {
  candlestick: 'candle',
  line: 'line',
  area: 'area',
};

export const useSettingsStore = create((set, get) => ({
  // === STATE ===
  preferences: {
    theme: 'system', // 'light' | 'dark' | 'system'
    defaultChartType: 'candlestick',
    defaultTimeframe: '1M',
    decimalPlaces: 2,
    notificationsEnabled: true,
  },
  isLoading: false,
  isLoaded: false,
  error: null,

  // === ACTIONS ===

  /**
   * Fetch preferences from backend
   */
  fetchPreferences: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get('/settings');
      set({
        preferences: {
          theme: data.theme || 'system',
          // Map backend chart type to frontend name
          defaultChartType: CHART_TYPE_MAP[data.defaultChartType] || 'candlestick',
          defaultTimeframe: data.defaultTimeframe || '1M',
          decimalPlaces: data.decimalPlaces ?? 2,
          notificationsEnabled: data.notificationsEnabled ?? true,
        },
        isLoading: false,
        isLoaded: true,
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to load preferences',
      });
      return false;
    }
  },

  /**
   * Update preferences in backend
   */
  savePreferences: async (newPrefs) => {
    set({ isLoading: true, error: null });
    try {
      // Map frontend chart type back to backend name
      const backendPrefs = {
        ...newPrefs,
        defaultChartType: newPrefs.defaultChartType
          ? CHART_TYPE_REVERSE_MAP[newPrefs.defaultChartType]
          : undefined,
      };

      await api.put('/settings', backendPrefs);

      // Update local state
      set((state) => ({
        preferences: {
          ...state.preferences,
          ...newPrefs,
        },
        isLoading: false,
      }));

      return { success: true };
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to save preferences',
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Update a single preference locally (for optimistic updates)
   */
  setPreference: (key, value) => {
    set((state) => ({
      preferences: {
        ...state.preferences,
        [key]: value,
      },
    }));
  },

  /**
   * Clear preferences (on logout)
   */
  clearPreferences: () => {
    set({
      preferences: {
        theme: 'system',
        defaultChartType: 'candlestick',
        defaultTimeframe: '1M',
        decimalPlaces: 2,
        notificationsEnabled: true,
      },
      isLoaded: false,
      error: null,
    });
  },

  // === SELECTORS ===
  getDefaultChartType: () => get().preferences.defaultChartType,
  getDefaultTimeframe: () => get().preferences.defaultTimeframe,
  getDecimalPlaces: () => get().preferences.decimalPlaces,
  getThemePreference: () => get().preferences.theme,
}));

export default useSettingsStore;
