import { useState, useEffect, useCallback } from 'react';
import { useProfileStore } from '../stores/profileStore';

/**
 * useSearchPreview Hook
 * Fetches company profile and additional data for search preview panel.
 * Uses centralized profileStore which handles caching and API calls.
 */

export default function useSearchPreview(symbol, enabled = true) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Use profileStore for profile data (already has caching)
  // Extract profile.data since store stores { data, timestamp }
  const profile = useProfileStore((state) => {
    const entry = state.profiles[symbol?.toUpperCase()];
    return entry?.data || null;
  });
  const fetchProfile = useProfileStore((state) => state.fetchProfile);

  const loadProfile = useCallback(async (sym) => {
    if (!sym) return;

    // Check if profile already exists in store (cached)
    const upperSym = sym.toUpperCase();
    const existingEntry = useProfileStore.getState().profiles[upperSym];
    if (existingEntry?.data) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await fetchProfile(upperSym);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!enabled || !symbol) {
      setLoading(false);
      return;
    }

    // Debounce preview loading by 300ms to prevent API explosion on rapid hovers
    const timeoutId = setTimeout(() => {
      loadProfile(symbol);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [symbol, enabled, loadProfile]);

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
