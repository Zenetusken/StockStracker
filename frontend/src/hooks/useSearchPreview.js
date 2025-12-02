import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useSearchPreview Hook
 * Fetches company profile and additional data for search preview panel.
 * Implements caching and debouncing to minimize API calls.
 */

// In-memory cache for profile data (5 minute TTL)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedProfile(symbol) {
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedProfile(symbol, data) {
  profileCache.set(symbol, {
    data,
    timestamp: Date.now(),
  });
}

export default function useSearchPreview(symbol, enabled = true) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchProfile = useCallback(async (sym) => {
    if (!sym) return;

    // Check cache first
    const cached = getCachedProfile(sym);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3001/api/quotes/${sym}/profile`,
        {
          credentials: 'include',
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();

      // Cache the result
      setCachedProfile(sym, data);
      setProfile(data);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !symbol) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile(symbol);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbol, enabled, fetchProfile]);

  // Format market cap for display
  const formatMarketCap = useCallback((marketCap) => {
    if (!marketCap) return null;
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    }
    if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    }
    if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  }, []);

  // Format volume for display
  const formatVolume = useCallback((volume) => {
    if (!volume) return null;
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(2)}B`;
    }
    if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(2)}M`;
    }
    if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(1)}K`;
    }
    return volume.toLocaleString();
  }, []);

  return {
    profile,
    loading,
    error,
    formatMarketCap,
    formatVolume,
  };
}
