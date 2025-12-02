import { useState, useEffect, useMemo, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { useApiKeysStore } from '../../stores/apiKeysStore';

export default function RateLimitBar({
  serviceName,
  limitType,
  max,
  description,
  windowSeconds = 60,
  className = '',
  // Optional: pass calls directly if already available
  initialCalls = null
}) {
  const { fetchDetailedUsage, getCalls, fetchBurstEvents, getBurstEventCount } = useApiKeysStore();

  // For very short windows (< 5s), don't track real-time - it's a burst limit
  const isBurstLimit = windowSeconds < 5;

  // Local state for current count and calls
  const [calls, setCalls] = useState(initialCalls || []);
  const [currentCount, setCurrentCount] = useState(initialCalls?.length || 0);

  // Fetch detailed usage on mount and set up polling (skip for burst limits)
  useEffect(() => {
    if (isBurstLimit) return; // Don't poll for burst limits

    let isMounted = true;

    const fetchUsage = async () => {
      try {
        await fetchDetailedUsage(serviceName);
        if (isMounted) {
          const fetchedCalls = getCalls(serviceName, limitType);
          setCalls(fetchedCalls);
          setCurrentCount(fetchedCalls.length);
        }
      } catch (error) {
        console.error(`Error fetching usage for ${serviceName}:`, error);
      }
    };

    // Initial fetch
    fetchUsage();

    // Poll every 5 seconds for new calls from backend
    const pollInterval = setInterval(fetchUsage, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [serviceName, limitType, fetchDetailedUsage, getCalls, isBurstLimit]);

  // Local timer to decrement counter as calls expire (runs every second, skip for burst limits)
  useEffect(() => {
    if (isBurstLimit) return; // Don't run timer for burst limits

    const timer = setInterval(() => {
      const now = Date.now();
      const activeCalls = calls.filter((c) => c.expiresAt > now);

      if (activeCalls.length !== currentCount) {
        setCurrentCount(activeCalls.length);
        setCalls(activeCalls);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calls, currentCount, isBurstLimit]);

  // Calculate next expiration countdown
  const nextExpirySeconds = useMemo(() => {
    if (calls.length === 0) return null;

    // eslint-disable-next-line react-hooks/purity -- Date.now() is intentional for countdown calculation
    const now = Date.now();
    // Find the call that will expire soonest
    const sortedCalls = [...calls].sort((a, b) => a.expiresAt - b.expiresAt);
    const nextCall = sortedCalls.find((c) => c.expiresAt > now);

    if (!nextCall) return null;
    return Math.max(0, Math.ceil((nextCall.expiresAt - now) / 1000));
  }, [calls]);

  // Format time for display
  const formatTime = useCallback((seconds) => {
    if (seconds === null) return null;
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, []);

  // Calculate percentage and colors
  const { percentage, color, bgColor } = useMemo(() => {
    const pct = Math.min(100, (currentCount / max) * 100);
    let clr, bgClr;

    if (pct > 90) {
      clr = 'bg-red-500';
      bgClr = 'bg-red-100 dark:bg-red-900/30';
    } else if (pct > 70) {
      clr = 'bg-amber-500';
      bgClr = 'bg-amber-100 dark:bg-amber-900/30';
    } else {
      clr = 'bg-green-500';
      bgClr = 'bg-green-100 dark:bg-green-900/30';
    }

    return { percentage: pct, color: clr, bgColor: bgClr };
  }, [currentCount, max]);

  // State for burst limit hit count
  const [burstHitCount, setBurstHitCount] = useState(0);

  // Fetch burst events for burst limits
  useEffect(() => {
    if (!isBurstLimit) return;

    let isMounted = true;

    const fetchBurst = async () => {
      try {
        await fetchBurstEvents(serviceName);
        if (isMounted) {
          const count = getBurstEventCount(serviceName, limitType);
          setBurstHitCount(count);
        }
      } catch (error) {
        console.error(`Error fetching burst events for ${serviceName}:`, error);
      }
    };

    // Initial fetch
    fetchBurst();

    // Poll every 30 seconds (less frequent since it's just event counts)
    const pollInterval = setInterval(fetchBurst, 30000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [serviceName, limitType, fetchBurstEvents, getBurstEventCount, isBurstLimit]);

  // For burst limits, show hit counter instead of progress bar
  if (isBurstLimit) {
    return (
      <div className={className}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-text-muted">
            {description || 'Burst limit'}
          </span>
          <span className="text-xs font-medium text-text-primary">
            {max}/s max
          </span>
        </div>
        <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700">
          <Zap className={`w-4 h-4 ${burstHitCount > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          <span className={`text-sm font-medium ${burstHitCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
            {burstHitCount > 0 ? (
              <>Hit {burstHitCount} time{burstHitCount !== 1 ? 's' : ''} today</>
            ) : (
              'No hits today'
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-text-muted dark:text-gray-400">
          {description || 'Usage'}
        </span>
        <span className="text-xs font-medium text-text-primary dark:text-gray-300">
          {currentCount} / {max}
        </span>
      </div>
      <div className={`h-2 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs text-text-muted">
          {currentCount > 0 && nextExpirySeconds !== null
            ? `Next slot in ${formatTime(nextExpirySeconds)}`
            : ''}
        </span>
        <span className="text-xs text-text-muted">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
