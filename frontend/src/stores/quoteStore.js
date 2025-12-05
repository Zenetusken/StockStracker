import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../api/client';

// === PUB/SUB FOR QUOTE UPDATES ===
// Allows other stores (e.g., chartStore) to subscribe to quote updates
// without creating a direct dependency between stores
const quoteUpdateSubscribers = new Set();

/**
 * Subscribe to real-time quote updates from SSE.
 * Used by chartStore to update live candles without direct coupling.
 * @param {Function} callback - Called with array of { symbol, quote } updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToQuoteUpdates = (callback) => {
  quoteUpdateSubscribers.add(callback);
  return () => quoteUpdateSubscribers.delete(callback);
};

// SSE requires full URL for EventSource (cannot use api client)
const SSE_BASE_URL = '/api/stream/quotes';
const QUOTE_STALE_MS = 15000; // 15 seconds
const SSE_RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const FALLBACK_FETCH_DELAY = 2000; // 2 seconds before REST fallback

// Store for centralized quote management with SSE
export const useQuoteStore = create((set, get) => ({
  // === STATE ===
  quotes: {}, // { AAPL: { current, change, percentChange, high, low, open, previousClose, volume, name, lastUpdate } }
  subscriptions: {}, // { AAPL: 2, MSFT: 1 } - reference counts
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
  lastError: null,

  // Private state (not persisted)
  _eventSource: null,
  _reconnectTimeout: null,
  _currentSymbolsKey: '',

  // === SELECTORS ===

  // Get a single quote (enrichQuote format for StockDetail)
  getQuote: (symbol) => {
    const { quotes } = get();
    return quotes[symbol?.toUpperCase()] || null;
  },

  // Get quote in Finnhub format (for WatchlistDetail)
  // Maps enrichQuote fields to Finnhub-style: c, d, dp, h, l, o, pc, v, name
  getQuoteFinnhub: (symbol) => {
    const quote = get().getQuote(symbol);
    if (!quote) return null;
    return {
      c: quote.current,
      d: quote.change,
      dp: quote.percentChange,
      h: quote.high,
      l: quote.low,
      o: quote.open,
      pc: quote.previousClose,
      v: quote.volume,
      name: quote.name || symbol?.toUpperCase(),
      lastUpdate: quote.lastUpdate,
    };
  },

  // Check if quote is fresh
  isQuoteFresh: (symbol) => {
    const quote = get().getQuote(symbol);
    if (!quote || !quote.lastUpdate) return false;
    return Date.now() - quote.lastUpdate < QUOTE_STALE_MS;
  },

  // Get all subscribed symbols
  getSubscribedSymbols: () => {
    return Object.keys(get().subscriptions);
  },

  // Get multiple quotes in Finnhub format
  getQuotesFinnhub: (symbols) => {
    const result = {};
    symbols.forEach((sym) => {
      const quote = get().getQuoteFinnhub(sym);
      if (quote) {
        result[sym.toUpperCase()] = quote;
      }
    });
    return result;
  },

  // === ACTIONS ===

  // Subscribe to symbols (increments reference count)
  subscribe: (symbols) => {
    if (!symbols || symbols.length === 0) return;

    const normalizedSymbols = symbols.map((s) => s.toUpperCase());

    set((state) => {
      const newSubscriptions = { ...state.subscriptions };
      normalizedSymbols.forEach((sym) => {
        newSubscriptions[sym] = (newSubscriptions[sym] || 0) + 1;
      });
      return { subscriptions: newSubscriptions };
    });

    // Update SSE connection if symbols changed
    get()._updateSSEConnection();
  },

  // Unsubscribe from symbols (decrements reference count)
  unsubscribe: (symbols) => {
    if (!symbols || symbols.length === 0) return;

    const normalizedSymbols = symbols.map((s) => s.toUpperCase());

    set((state) => {
      const newSubscriptions = { ...state.subscriptions };
      normalizedSymbols.forEach((sym) => {
        if (newSubscriptions[sym]) {
          newSubscriptions[sym]--;
          if (newSubscriptions[sym] <= 0) {
            delete newSubscriptions[sym];
          }
        }
      });
      return { subscriptions: newSubscriptions };
    });

    // Update SSE connection if symbols changed
    get()._updateSSEConnection();
  },

  // Update quotes from SSE or REST response
  // Handles SSE array format: [{ symbol, quote: {...}, error }]
  updateQuotes: (quotesData) => {
    const now = Date.now();
    set((state) => {
      const newQuotes = { ...state.quotes };

      // Handle array format from SSE: [{ symbol, quote: {...} }]
      if (Array.isArray(quotesData)) {
        quotesData.forEach((item) => {
          if (item.symbol && item.quote) {
            newQuotes[item.symbol.toUpperCase()] = {
              ...item.quote,
              name: item.quote.name || item.symbol.toUpperCase(),
              lastUpdate: now,
            };
          }
        });
      }
      // Handle object format from REST batch: { AAPL: {...}, MSFT: {...} }
      else if (typeof quotesData === 'object' && quotesData !== null) {
        Object.entries(quotesData).forEach(([symbol, quote]) => {
          newQuotes[symbol.toUpperCase()] = {
            ...quote,
            name: quote.name || symbol.toUpperCase(),
            lastUpdate: now,
          };
        });
      }

      return { quotes: newQuotes };
    });
  },

  // Fetch quotes for symbols that are not fresh (REST fallback)
  fetchQuotesIfNeeded: async (symbols) => {
    const staleSymbols = symbols
      .map((s) => s.toUpperCase())
      .filter((sym) => !get().isQuoteFresh(sym));

    if (staleSymbols.length === 0) return;

    try {
      const data = await api.post('/quotes/batch', { symbols: staleSymbols });
      if (data) {
        get().updateQuotes(data);
      }
    } catch (err) {
      console.error('[QuoteStore] Failed to fetch quotes:', err);
    }
  },

  // === PRIVATE: SSE Connection Management ===

  _updateSSEConnection: () => {
    const { _debounceTimeout } = get();
    
    // Clear pending debounce
    if (_debounceTimeout) {
      clearTimeout(_debounceTimeout);
    }

    // Debounce the connection update to handle rapid changes (e.g. React Strict Mode)
    const timeout = setTimeout(() => {
      const { subscriptions, _eventSource, _reconnectTimeout, _currentSymbolsKey } = get();
      const symbols = Object.keys(subscriptions);
      const newSymbolsKey = symbols.sort().join(',');

      // Clear any pending reconnect
      if (_reconnectTimeout) {
        clearTimeout(_reconnectTimeout);
        set({ _reconnectTimeout: null });
      }

      // Close existing connection if no subscriptions
      if (symbols.length === 0) {
        if (_eventSource) {
          console.log('[QuoteStore] Closing SSE - no subscriptions');
          _eventSource.close();
          set({
            _eventSource: null,
            connected: false,
            reconnecting: false,
            reconnectAttempts: 0,
            _currentSymbolsKey: '',
          });
        }
        set({ _debounceTimeout: null });
        return;
      }

      // Check if current connection has same symbols
      if (_currentSymbolsKey === newSymbolsKey && _eventSource) {
        set({ _debounceTimeout: null });
        return; // No change needed
      }

      // Close old connection and create new one
      if (_eventSource) {
        console.log('[QuoteStore] Closing SSE - symbols changed');
        _eventSource.close();
      }

      get()._connectSSE(symbols);
      set({ _debounceTimeout: null });
    }, 300); // 300ms debounce to catch React Strict Mode double-mounts

    set({ _debounceTimeout: timeout });
  },

  _connectSSE: (symbols) => {
    const symbolsKey = symbols.sort().join(',');
    const url = `${SSE_BASE_URL}?symbols=${encodeURIComponent(symbols.join(','))}`;

    console.log('[QuoteStore] Connecting SSE:', symbols.join(', '));

    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onopen = () => {
      console.log('[QuoteStore] SSE connected');
      set({
        connected: true,
        reconnecting: false,
        reconnectAttempts: 0,
        lastError: null,
        _eventSource: eventSource,
        _currentSymbolsKey: symbolsKey,
      });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'quote_update' && data.quotes) {
          get().updateQuotes(data.quotes);

          // Notify subscribers (e.g., chartStore) of quote updates
          // This decouples quoteStore from chartStore
          const validUpdates = data.quotes.filter(item => item.symbol && item.quote);
          if (validUpdates.length > 0 && quoteUpdateSubscribers.size > 0) {
            quoteUpdateSubscribers.forEach(callback => {
              try {
                callback(validUpdates);
              } catch (err) {
                console.error('[QuoteStore] Subscriber callback error:', err);
              }
            });
          }
        }
      } catch (err) {
        console.error('[QuoteStore] SSE parse error:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[QuoteStore] SSE error:', error);
      eventSource.close();

      const attempts = get().reconnectAttempts;

      if (attempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempts),
          30000
        );
        console.log(
          `[QuoteStore] Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
        );

        const timeout = setTimeout(() => {
          const currentSymbols = get().getSubscribedSymbols();
          if (currentSymbols.length > 0) {
            get()._connectSSE(currentSymbols);
          }
        }, delay);

        set({
          connected: false,
          reconnecting: true,
          reconnectAttempts: attempts + 1,
          lastError: 'Connection lost',
          _reconnectTimeout: timeout,
          _eventSource: null,
          _currentSymbolsKey: '',
        });
      } else {
        console.error('[QuoteStore] Max reconnection attempts reached');
        set({
          connected: false,
          reconnecting: false,
          lastError: 'Max reconnection attempts reached',
          _eventSource: null,
          _currentSymbolsKey: '',
        });
      }
    };

    set({ _eventSource: eventSource, _currentSymbolsKey: symbolsKey });
  },

  // Cleanup (for app unmount)
  cleanup: () => {
    const { _eventSource, _reconnectTimeout } = get();
    if (_reconnectTimeout) clearTimeout(_reconnectTimeout);
    if (_eventSource) _eventSource.close();
    set({
      _eventSource: null,
      _reconnectTimeout: null,
      connected: false,
      reconnecting: false,
      _currentSymbolsKey: '',
    });
  },

  // Clear all quotes (for logout)
  clearQuotes: () => {
    get().cleanup();
    set({
      quotes: {},
      subscriptions: {},
    });
  },
}));

// === HOOKS FOR COMPONENTS ===

/**
 * useQuote - Subscribe to a single symbol's quote (enrichQuote format)
 * Used by StockDetail
 */
export function useQuote(symbol) {
  const upperSymbol = symbol?.toUpperCase();
  const quote = useQuoteStore((state) => state.quotes[upperSymbol] || null);
  const connected = useQuoteStore((state) => state.connected);
  const reconnecting = useQuoteStore((state) => state.reconnecting);
  const subscribe = useQuoteStore((state) => state.subscribe);
  const unsubscribe = useQuoteStore((state) => state.unsubscribe);
  const fetchQuotesIfNeeded = useQuoteStore((state) => state.fetchQuotesIfNeeded);

  // Track if we've set up the fallback timeout
  const fallbackRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!upperSymbol) return;

    subscribe([upperSymbol]);

    // Set up REST fallback if SSE doesn't deliver within 2 seconds
    fallbackRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchQuotesIfNeeded([upperSymbol]);
      }
    }, FALLBACK_FETCH_DELAY);

    return () => {
      unsubscribe([upperSymbol]);
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
      }
    };
  }, [upperSymbol, subscribe, unsubscribe, fetchQuotesIfNeeded]);

  return {
    quote,
    loading: !quote && connected,
    connected,
    reconnecting,
  };
}

/**
 * useQuotes - Subscribe to multiple symbols' quotes (Finnhub format)
 * Used by WatchlistDetail
 */
export function useQuotes(symbols) {
  // Create a stable key for dependency tracking
  const symbolsKey = (symbols || []).map((s) => s.toUpperCase()).sort().join(',');

  const normalizedSymbols = useMemo(
    () => (symbols || []).map((s) => s.toUpperCase()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbolsKey]
  );

  // Create a stable selector function that only re-renders when quote values change (M2 fix)
  const quoteSelector = useCallback(
    (state) => {
      const result = {};
      normalizedSymbols.forEach((sym) => {
        const quote = state.quotes[sym];
        if (quote) {
          // Map enrichQuote format to Finnhub format
          result[sym] = {
            c: quote.current,
            d: quote.change,
            dp: quote.percentChange,
            h: quote.high,
            l: quote.low,
            o: quote.open,
            pc: quote.previousClose,
            v: quote.volume,
            name: quote.name || sym,
            lastUpdate: quote.lastUpdate,
          };
        }
      });
      return result;
    },
    [normalizedSymbols]
  );

  // Use shallow comparison to prevent re-renders when quote objects are equal (M2 fix)
  const quotes = useQuoteStore(useShallow(quoteSelector));

  const connected = useQuoteStore((state) => state.connected);
  const reconnecting = useQuoteStore((state) => state.reconnecting);
  const subscribe = useQuoteStore((state) => state.subscribe);
  const unsubscribe = useQuoteStore((state) => state.unsubscribe);
  const fetchQuotesIfNeeded = useQuoteStore((state) => state.fetchQuotesIfNeeded);

  // Track if we've set up the fallback timeout
  const fallbackRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (normalizedSymbols.length === 0) return;

    subscribe(normalizedSymbols);

    // Set up REST fallback if SSE doesn't deliver within 2 seconds
    fallbackRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchQuotesIfNeeded(normalizedSymbols);
      }
    }, FALLBACK_FETCH_DELAY);

    return () => {
      unsubscribe(normalizedSymbols);
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
      }
    };
    // Using symbolsKey to track symbol changes (normalizedSymbols is memoized based on it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, subscribe, unsubscribe, fetchQuotesIfNeeded]);

  return { quotes, connected, reconnecting };
}

export default useQuoteStore;
