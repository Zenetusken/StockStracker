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

  getPreferences: (symbol) => {
    const { preferences } = get();
    const upperSymbol = symbol?.toUpperCase();

    // Check if already loaded in store (single source of truth for session)
    if (preferences[upperSymbol]) {
      return preferences[upperSymbol];
    }

    // Load from localStorage and hydrate store for consistency
    const savedTimeframe = localStorage.getItem(`chart_timeframe_${upperSymbol}`);
    const savedChartType = localStorage.getItem(`chart_type_${upperSymbol}`);
    const savedSmaEnabled = localStorage.getItem(`chart_sma_enabled_${upperSymbol}`);
    const savedSmaPeriod = localStorage.getItem(`chart_sma_period_${upperSymbol}`);

    const loadedPrefs = {
      timeframe: savedTimeframe || '1M',
      chartType: savedChartType || 'candlestick',
      smaEnabled: savedSmaEnabled === 'true',
      smaPeriod: parseInt(savedSmaPeriod) || 20,
    };

    // Hydrate store so subsequent accesses use the store (reactive + consistent)
    set((state) => ({
      preferences: {
        ...state.preferences,
        [upperSymbol]: loadedPrefs,
      },
    }));

    return loadedPrefs;
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
  _getExistingPrefs: (state, upperSymbol) => {
    if (state.preferences[upperSymbol]) {
      return state.preferences[upperSymbol];
    }
    // Load from localStorage if not in store yet
    return {
      timeframe: localStorage.getItem(`chart_timeframe_${upperSymbol}`) || '1M',
      chartType: localStorage.getItem(`chart_type_${upperSymbol}`) || 'candlestick',
      smaEnabled: localStorage.getItem(`chart_sma_enabled_${upperSymbol}`) === 'true',
      smaPeriod: parseInt(localStorage.getItem(`chart_sma_period_${upperSymbol}`)) || 20,
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

  setSmaEnabled: (symbol, enabled) => {
    const upperSymbol = symbol.toUpperCase();
    localStorage.setItem(`chart_sma_enabled_${upperSymbol}`, enabled.toString());
    set((state) => {
      const existing = get()._getExistingPrefs(state, upperSymbol);
      return {
        preferences: {
          ...state.preferences,
          [upperSymbol]: { ...existing, smaEnabled: enabled },
        },
      };
    });
  },

  setSmaPeriod: (symbol, period) => {
    const upperSymbol = symbol.toUpperCase();
    localStorage.setItem(`chart_sma_period_${upperSymbol}`, period.toString());
    set((state) => {
      const existing = get()._getExistingPrefs(state, upperSymbol);
      return {
        preferences: {
          ...state.preferences,
          [upperSymbol]: { ...existing, smaPeriod: period },
        },
      };
    });
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
}));

export default useChartStore;
