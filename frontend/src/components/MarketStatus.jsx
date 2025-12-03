import { useState, useEffect, useCallback } from 'react';
import { Clock, Sun, Moon, Coffee } from 'lucide-react';
import api from '../api/client';

/**
 * Market Status Component
 * #121: Market status (open/closed) with countdown
 */

// Status configurations
const STATUS_CONFIG = {
  'open': {
    label: 'Market Open',
    color: 'bg-gain',
    textColor: 'text-gain',
    icon: Sun,
    description: 'Regular trading hours',
  },
  'pre-market': {
    label: 'Pre-Market',
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    icon: Coffee,
    description: 'Extended hours trading',
  },
  'after-hours': {
    label: 'After Hours',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: Moon,
    description: 'Extended hours trading',
  },
  'closed': {
    label: 'Market Closed',
    color: 'bg-loss',
    textColor: 'text-loss',
    icon: Moon,
    description: 'Trading resumes',
  },
};

const NEXT_EVENT_LABELS = {
  'market-open': 'Opens in',
  'market-close': 'Closes in',
  'pre-market-open': 'Pre-market in',
  'after-hours-close': 'After hours ends in',
};

function MarketStatus() {
  const [status, setStatus] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await api.get('/market/status');
      setStatus(result);
      setCountdown(result.countdown);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch market status:', err);
      setError('Unable to load market status');
    }
  }, []);

  useEffect(() => {
    // Initial fetch - use setTimeout to avoid synchronous setState in effect
    const initialFetch = setTimeout(fetchStatus, 0);
    // Refresh every minute
    const interval = setInterval(fetchStatus, 60000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  // Local countdown timer
  useEffect(() => {
    if (!countdown) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (!prev || prev.totalMinutes <= 0) return prev;
        const newTotal = prev.totalMinutes - 1;
        return {
          ...prev,
          totalMinutes: newTotal,
          hours: Math.floor(newTotal / 60),
          minutes: newTotal % 60,
          formatted: `${Math.floor(newTotal / 60)}h ${newTotal % 60}m`,
        };
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [countdown?.totalMinutes]);

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-4">
        <div className="text-text-muted text-sm">{error}</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-card rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-page-bg rounded w-24 mb-2"></div>
          <div className="h-6 bg-page-bg rounded w-32"></div>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[status.status] || STATUS_CONFIG['closed'];
  const Icon = config.icon;
  const nextEventLabel = NEXT_EVENT_LABELS[status.nextEvent] || 'Next';

  return (
    <div className="bg-card rounded-lg shadow p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`}></span>
            <span className={`text-sm font-semibold ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          <div className="text-xs text-text-muted mb-3">
            {status.currentTime?.day}, {status.currentTime?.time}
          </div>

          {countdown && countdown.totalMinutes > 0 && (
            <div>
              <div className="text-xs text-text-muted mb-1">{nextEventLabel}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-text-primary">
                  {countdown.hours}
                </span>
                <span className="text-sm text-text-muted">h</span>
                <span className="text-2xl font-bold text-text-primary ml-1">
                  {countdown.minutes}
                </span>
                <span className="text-sm text-text-muted">m</span>
              </div>
            </div>
          )}
        </div>

        <div className={`p-2 rounded-lg bg-page-bg ${config.textColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {status.isWeekend && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Markets reopen Monday 9:30 AM ET
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketStatus;
