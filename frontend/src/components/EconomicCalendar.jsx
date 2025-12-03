import { useState, useEffect, useCallback } from 'react';
import { Calendar, AlertCircle, Clock } from 'lucide-react';
import api from '../api/client';

/**
 * Economic Calendar Component
 * #122: Economic calendar highlights
 */

// Importance color mapping
const IMPORTANCE_COLORS = {
  high: 'bg-loss/10 text-loss border-loss/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

function EconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalendar = useCallback(async () => {
    try {
      const result = await api.get('/market/calendar');
      setEvents(result.events || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch economic calendar:', err);
      setError('Unable to load calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-brand" />
          <h3 className="font-semibold text-text-primary">Economic Calendar</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-page-bg rounded"></div>
          <div className="h-10 bg-page-bg rounded"></div>
          <div className="h-10 bg-page-bg rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-brand" />
          <h3 className="font-semibold text-text-primary">Economic Calendar</h3>
        </div>
        <div className="text-text-muted text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Calendar className="w-5 h-5 text-brand" />
        <h3 className="font-semibold text-text-primary">Economic Calendar</h3>
      </div>

      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center text-text-muted py-4">
            No upcoming events
          </div>
        ) : (
          Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                {formatDate(date)}
              </div>
              <div className="space-y-2">
                {dateEvents.map(event => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border ${IMPORTANCE_COLORS[event.importance] || IMPORTANCE_COLORS.low}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{event.event}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs opacity-75">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </div>
                      </div>
                      {event.importance === 'high' && (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                    </div>
                    {(event.previous || event.forecast) && (
                      <div className="flex gap-4 mt-2 text-xs">
                        {event.previous && (
                          <div>
                            <span className="opacity-75">Prev: </span>
                            <span className="font-medium">{event.previous}</span>
                          </div>
                        )}
                        {event.forecast && (
                          <div>
                            <span className="opacity-75">Forecast: </span>
                            <span className="font-medium">{event.forecast}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EconomicCalendar;
