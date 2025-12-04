import { AlertTriangle, ExternalLink } from 'lucide-react';
import EventTypeIcon from './EventTypeIcon';
import { formatDistanceToNow } from '../../utils/dateUtils';

/**
 * CriticalEventsList - Displays a list of recent critical security events
 * @param {Object} props
 * @param {Array} props.events - Array of critical event objects
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onViewAll - Callback when "View All" is clicked
 */
function CriticalEventsList({ events = [], loading = false, onViewAll }) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="font-semibold text-text-primary">Critical Events</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-page-bg rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayedEvents = events.slice(0, 5);
  const hasMore = events.length > 5;

  return (
    <div
      className="bg-card rounded-lg border border-red-200 dark:border-red-800 p-4"
      data-testid="critical-events"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="font-semibold text-text-primary">
            Critical Events
            {events.length > 0 && (
              <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                ({events.length})
              </span>
            )}
          </h3>
        </div>
        {hasMore && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-brand hover:underline flex items-center gap-1"
          >
            View all
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {displayedEvents.length === 0 ? (
        <div className="text-center py-6 text-text-muted">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No critical events</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="critical-list">
          {displayedEvents.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/50"
              data-testid="critical-event-item"
            >
              <div className="flex-shrink-0 mt-0.5">
                <EventTypeIcon eventType={event.event_type} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-text-primary">
                    {formatEventType(event.event_type)}
                  </span>
                  {event.isNew && (
                    <span
                      className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full"
                      data-testid="new-indicator"
                    >
                      New
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {event.ip_address && (
                    <span>IP: {event.ip_address}</span>
                  )}
                  {event.user_email && (
                    <span>User: {event.user_email}</span>
                  )}
                  <span>{formatDistanceToNow(event.created_at)}</span>
                </div>
                {event.details && typeof event.details === 'object' && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {getEventSummary(event)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Format event type for display
 */
function formatEventType(eventType) {
  if (!eventType) return 'Unknown Event';
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get a summary string from event details
 */
function getEventSummary(event) {
  const details = typeof event.details === 'string'
    ? JSON.parse(event.details)
    : event.details;

  if (!details) return null;

  if (details.failedAttempts) {
    return `${details.failedAttempts} failed attempts`;
  }
  if (details.reason) {
    return details.reason;
  }
  if (details.message) {
    return details.message;
  }
  return null;
}

export default CriticalEventsList;
