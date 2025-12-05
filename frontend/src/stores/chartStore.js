import { create } from 'zustand';
import api from '../api/client';

// Cache TTL by resolution type
const CACHE_TTL = {
  intraday: 60000,    // 1 minute for intraday
  daily: 300000,      // 5 minutes for daily
  weekly: 1800000,    // 30 minutes for weekly
};

// LRU Cache implementation
class LRUCache {
  constructor(maxSize = 20) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    return this.cache.has(key);
  }

  entries() {
    return this.cache.entries();
  }
}

// Create cache instance
const candleCache = new LRUCache(20);

// Request deduplication: prevents concurrent duplicate API calls
const pendingRequests = new Map();

// Helper to get cache TTL based on resolution
const getCacheTTL = (resolution) => {
  if (['1', '5', '15', '30', '60'].includes(resolution)) {
    return CACHE_TTL.intraday;
  }
  if (resolution === 'D') {
    return CACHE_TTL.daily;
  }
  return CACHE_TTL.weekly;
};

// Helper to check if timestamp is today
const isSameDay = (timestamp, now) => {
  const date1 = new Date(timestamp);
  const date2 = new Date(now);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const useChartStore = create((set, get) => ({
  // === STATE ===
  isLoading: {}, // { [cacheKey]: boolean }
  error: {}, // { [cacheKey]: string }
  preferences: {}, // { [symbol]: { timeframe, chartType, smaEnabled, smaPeriod } }

  // === HELPERS ===

  getCacheKey: (symbol, resolution, from, to) => {
    return `${symbol.toUpperCase()}:${resolution}:${from}:${to}`;
  },

  // === SELECTORS ===

  getCandles: (symbol, resolution, from, to) => {
    const key = get().getCacheKey(symbol, resolution, from, to);
    const cached = candleCache.get(key);
    if (cached && !get().isStale(key)) {
      return cached.data;
    }
    return null;
  },

  isStale: (cacheKey) => {
    const cached = candleCache.get(cacheKey);
    if (!cached) return true;
    const resolution = cacheKey.split(':')[1];
    const ttl = getCacheTTL(resolution);
    return Date.now() - cached.timestamp > ttl;
  },

  initPreferences: (symbol, defaultTimeframe = '6M', defaultChartType = 'candlestick') => {
    if (!symbol) return null;
    const upperSymbol = symbol.toUpperCase();
    const { preferences } = get();

    // Load from localStorage
    const savedTimeframe = localStorage.getItem(`chart_timeframe_${upperSymbol}`);
    let savedChartType = localStorage.getItem(`chart_type_${upperSymbol}`);

    // Normalize legacy 'candle' type
    if (savedChartType === 'candle') {
      savedChartType = 'candlestick';
    }

    // SMA Migration Logic
    let savedEnabledSMAs = [];
    const savedEnabledSMAsJson = localStorage.getItem(`chart_enabled_smas_${upperSymbol}`);
    if (savedEnabledSMAsJson) {
      try {
        savedEnabledSMAs = JSON.parse(savedEnabledSMAsJson);
      } catch {
        // Ignore parse errors
      }
    } else {
      // Fallback to old format
      const isSmaEnabled = localStorage.getItem(`chart_sma_enabled_${upperSymbol}`) === 'true';
      const smaPeriod = parseInt(localStorage.getItem(`chart_sma_period_${upperSymbol}`)) || 20;
      if (isSmaEnabled && smaPeriod) {
        savedEnabledSMAs = [smaPeriod];
      }
    }

    // Determine values to use: Saved > Default
    // If we have saved values, we use them.
    // If we DON'T have saved values, we use the passed defaults.
    const finalTimeframe = savedTimeframe || defaultTimeframe;
    const finalChartType = savedChartType || defaultChartType;
    const finalEnabledSMAs = savedEnabledSMAs;

    const newPrefs = {
      timeframe: finalTimeframe,
      chartType: finalChartType,
      enabledSMAs: finalEnabledSMAs,
      smaEnabled: finalEnabledSMAs.length > 0,
      smaPeriod: finalEnabledSMAs.length > 0 ? finalEnabledSMAs[0] : 20,
    };

    // Optimization: If store already has these exact values, do nothing.
    const current = preferences[upperSymbol];
    if (current &&
      current.timeframe === newPrefs.timeframe &&
      current.chartType === newPrefs.chartType &&
      JSON.stringify(current.enabledSMAs) === JSON.stringify(newPrefs.enabledSMAs)) {
      return current;
    }

    // If we are here, either it's not initialized, OR the defaults changed and we are updating the "non-persisted" state.
    // However, we must be careful not to overwrite user overrides with defaults if the user *just* changed them in memory but hasn't persisted?
    // Wait, our setters (setTimeframe etc) persist to localStorage immediately. 
    // So checking localStorage is safe as the source of truth for "has user override".

    set((state) => ({
      preferences: {
        ...state.preferences,
        [upperSymbol]: newPrefs,
      },
    }));

    return newPrefs;
  },

  getPreferences: (symbol) => {
    // Determine if we need to initialize (lazy init via getter is risky during render, 
    // but useful if accessed outside react lifecycle. 
    // For React components, they should use useChartStore(state => state.preferences[symbol])
    // This helper remains for non-reactive access if needed, but implementation delegates to init
    return get().initPreferences(symbol);
  },

  isLoadingKey: (cacheKey) => {
    return get().isLoading[cacheKey] || false;
  },

  getError: (cacheKey) => {
    return get().error[cacheKey] || null;
  },

  // === ACTIONS ===

  fetchCandles: async (symbol, resolution, from, to, force = false) => {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = get().getCacheKey(upperSymbol, resolution, from, to);

    // Check cache first
    if (!force && !get().isStale(cacheKey)) {
      const cached = candleCache.get(cacheKey);
      if (cached) {
        return { data: cached.data, isStale: false };
      }
    }

    // Request deduplication: if there's already a pending request for this key, wait for it
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = (async () => {
      // Set loading
      set((state) => ({
        isLoading: { ...state.isLoading, [cacheKey]: true },
        error: { ...state.error, [cacheKey]: null },
      }));

      try {
        const data = await api.get(
          `/quotes/${upperSymbol}/candles?resolution=${resolution}&from=${from}&to=${to}`
        );

        // Cache the result
        candleCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        set((state) => ({
          isLoading: { ...state.isLoading, [cacheKey]: false },
        }));

        return { data, isStale: false };
      } catch (error) {
        set((state) => ({
          isLoading: { ...state.isLoading, [cacheKey]: false },
          error: { ...state.error, [cacheKey]: error.message },
        }));
        throw error;
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store the pending request
    pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  // Update current candle with live quote data
  updateCurrentCandle: (symbol, quote) => {
    const upperSymbol = symbol.toUpperCase();
    const now = Date.now();

    // Iterate through cached entries for this symbol
    // Use Array.from to avoid infinite loop due to Map modification during iteration
    for (const [key, entry] of Array.from(candleCache.entries())) {
      if (!key.startsWith(`${upperSymbol}:`)) continue;

      const { data } = entry;
      if (!data?.t || data.t.length === 0) continue;

      // Get the last candle timestamp
      const lastTimestamp = data.t[data.t.length - 1];
      const lastCandleTime = lastTimestamp * 1000; // Convert to ms

      // Check if last candle is today (for daily resolution) or within current period
      if (isSameDay(lastCandleTime, now)) {
        // Update the last candle with current quote data
        const idx = data.c.length - 1;

        // Update close price
        if (quote.current !== undefined && quote.current !== null) {
          data.c[idx] = quote.current;
        }

        // Update high if current price exceeds it
        if (quote.high !== undefined && quote.high !== null) {
          data.h[idx] = Math.max(data.h[idx], quote.high);
        } else if (quote.current !== undefined) {
          data.h[idx] = Math.max(data.h[idx], quote.current);
        }

        // Update low if current price is lower
        if (quote.low !== undefined && quote.low !== null) {
          data.l[idx] = Math.min(data.l[idx], quote.low);
        } else if (quote.current !== undefined) {
          data.l[idx] = Math.min(data.l[idx], quote.current);
        }

        // Update the cache entry (trigger re-render by creating new timestamp)
        candleCache.set(key, {
          ...entry,
          data: { ...data },
          lastQuoteUpdate: now,
        });
      }
    }

    // Trigger state update to notify subscribers
    set(() => ({
      _lastQuoteUpdate: now, // Force re-render
    }));
  },

  // Update multiple candles with live quote data
  updateCurrentCandlesBulk: (updates) => {
    const now = Date.now();
    let hasUpdates = false;

    updates.forEach(({ symbol, quote }) => {
      const upperSymbol = symbol.toUpperCase();

      // Iterate through cached entries for this symbol
      // Use Array.from to avoid infinite loop due to Map modification during iteration
      for (const [key, entry] of Array.from(candleCache.entries())) {
        if (!key.startsWith(`${upperSymbol}:`)) continue;

        const { data } = entry;
        if (!data?.t || data.t.length === 0) continue;

        // Get the last candle timestamp
        const lastTimestamp = data.t[data.t.length - 1];
        const lastCandleTime = lastTimestamp * 1000; // Convert to ms

        // Check if last candle is today (for daily resolution) or within current period
        if (isSameDay(lastCandleTime, now)) {
          // Update the last candle with current quote data
          const idx = data.c.length - 1;

          // Update close price
          if (quote.current !== undefined && quote.current !== null) {
            data.c[idx] = quote.current;
          }

          // Update high if current price exceeds it
          if (quote.high !== undefined && quote.high !== null) {
            data.h[idx] = Math.max(data.h[idx], quote.high);
          } else if (quote.current !== undefined) {
            data.h[idx] = Math.max(data.h[idx], quote.current);
          }

          // Update low if current price is lower
          if (quote.low !== undefined && quote.low !== null) {
            data.l[idx] = Math.min(data.l[idx], quote.low);
          } else if (quote.current !== undefined) {
            data.l[idx] = Math.min(data.l[idx], quote.current);
          }

          // Update the cache entry
          candleCache.set(key, {
            ...entry,
            data: { ...data },
            lastQuoteUpdate: now,
          });
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      // Trigger state update to notify subscribers
      set(() => ({
        _lastQuoteUpdate: now, // Force re-render
      }));
    }
  },

  // Helper to ensure complete preferences object (prevents partial updates when store isn't hydrated)
  // Helper to ensure complete preferences object
  _getExistingPrefs: (state, upperSymbol) => {
    if (state.preferences[upperSymbol]) {
      return state.preferences[upperSymbol];
    }
    // If not in state, trigger initialization logic essentially by returning what initPreferences would
    // But since we are inside a set() callback, we can't call get().initPreferences() easily without risk.
    // We'll just replicate the default structure reading.
    const savedTimeframe = localStorage.getItem(`chart_timeframe_${upperSymbol}`);
    const savedChartType = localStorage.getItem(`chart_type_${upperSymbol}`);

    let savedEnabledSMAs = [];
    const savedEnabledSMAsJson = localStorage.getItem(`chart_enabled_smas_${upperSymbol}`);
    if (savedEnabledSMAsJson) {
      try {
        savedEnabledSMAs = JSON.parse(savedEnabledSMAsJson);
      } catch {
        // Ignore parse errors
      }
    } else {
      const isSmaEnabled = localStorage.getItem(`chart_sma_enabled_${upperSymbol}`) === 'true';
      const smaPeriod = parseInt(localStorage.getItem(`chart_sma_period_${upperSymbol}`)) || 20;
      if (isSmaEnabled && smaPeriod) savedEnabledSMAs = [smaPeriod];
    }

    return {
      timeframe: savedTimeframe || '6M',
      chartType: savedChartType || 'candlestick',
      enabledSMAs: savedEnabledSMAs,
      smaEnabled: savedEnabledSMAs.length > 0,
      smaPeriod: savedEnabledSMAs.length > 0 ? savedEnabledSMAs[0] : 20,
    };
  },

  setTimeframe: (symbol, timeframe) => {
    const upperSymbol = symbol.toUpperCase();
    localStorage.setItem(`chart_timeframe_${upperSymbol}`, timeframe);
    set((state) => {
      const existing = get()._getExistingPrefs(state, upperSymbol);
      return {
        preferences: {
          ...state.preferences,
          [upperSymbol]: { ...existing, timeframe },
        },
      };
    });
  },

  setChartType: (symbol, chartType) => {
    const upperSymbol = symbol.toUpperCase();
    localStorage.setItem(`chart_type_${upperSymbol}`, chartType);
    set((state) => {
      const existing = get()._getExistingPrefs(state, upperSymbol);
      return {
        preferences: {
          ...state.preferences,
          [upperSymbol]: { ...existing, chartType },
        },
      };
    });
  },

  setEnabledSMAs: (symbol, enabledSMAs) => {
    const upperSymbol = symbol.toUpperCase();
    localStorage.setItem(`chart_enabled_smas_${upperSymbol}`, JSON.stringify(enabledSMAs));

    // Also update legacy fields for backward compatibility
    const hasAnySMA = enabledSMAs.length > 0;
    localStorage.setItem(`chart_sma_enabled_${upperSymbol}`, hasAnySMA.toString());
    if (hasAnySMA) {
      localStorage.setItem(`chart_sma_period_${upperSymbol}`, enabledSMAs[0].toString());
    }

    set((state) => {
      const existing = get()._getExistingPrefs(state, upperSymbol);
      return {
        preferences: {
          ...state.preferences,
          [upperSymbol]: {
            ...existing,
            enabledSMAs,
            smaEnabled: hasAnySMA,
            smaPeriod: hasAnySMA ? enabledSMAs[0] : existing.smaPeriod
          },
        },
      };
    });
  },

  // Legacy support - maps to setEnabledSMAs
  setSmaEnabled: (symbol, enabled) => {
    const { preferences } = get();
    const upperSymbol = symbol.toUpperCase();
    const existing = preferences[upperSymbol] || get().initPreferences(symbol);
    const currentPeriod = existing.smaPeriod || 20;

    // If enabling, add the current period if not present
    // If disabling, remove all
    let newEnabledSMAs = [];
    if (enabled) {
      newEnabledSMAs = [currentPeriod];
    }

    get().setEnabledSMAs(symbol, newEnabledSMAs);
  },

  // Legacy support - maps to setEnabledSMAs
  setSmaPeriod: (symbol, period) => {
    // When setting a period in legacy mode, we assume single SMA mode
    // So we replace the list with just this period
    get().setEnabledSMAs(symbol, [period]);
  },

  clearCache: (symbol = null) => {
    if (symbol) {
      const upperSymbol = symbol.toUpperCase();
      for (const [key] of candleCache.entries()) {
        if (key.startsWith(`${upperSymbol}:`)) {
          candleCache.delete(key);
        }
      }
    } else {
      candleCache.clear();
    }
  },

  clearError: (cacheKey = null) => {
    if (cacheKey) {
      set((state) => {
        const newError = { ...state.error };
        delete newError[cacheKey];
        return { error: newError };
      });
    } else {
      set({ error: {} });
    }
  },

  /**
   * Clear all per-stock chart preferences (Reset to global defaults)
   */
  clearAllPreferences: () => {
    // 1. Clear from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('chart_type_') ||
        key.startsWith('chart_timeframe_') ||
        key.startsWith('chart_enabled_smas_') ||
        key.startsWith('chart_sma_enabled_') ||
        key.startsWith('chart_sma_period_')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 2. Reset store state
    set({ preferences: {} });

    return true;
  },
}));

export default useChartStore;
