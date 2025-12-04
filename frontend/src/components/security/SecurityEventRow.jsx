import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import EventTypeIcon from './EventTypeIcon';
import { formatDistanceToNow, formatDateTime } from '../../utils/dateUtils';

/**
 * SecurityEventRow - A single row in the security event table
 * @param {Object} props
 * @param {Object} props.event - The security event object
 */
function SecurityEventRow({ event }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const details = parseDetails(event.details);
  const hasDetails = details && Object.keys(details).length > 0;

  return (
    <>
      <tr
        className={`border-b border-border hover:bg-page-bg/50 cursor-pointer transition-colors ${
          isExpanded ? 'bg-page-bg/30' : ''
        }`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        data-testid="event-row"
        role="row"
        aria-expanded={hasDetails ? isExpanded : undefined}
      >
        <td className="px-4 py-3">
          <SeverityBadge severity={event.severity} size="sm" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <EventTypeIcon eventType={event.event_type} size="sm" />
            <span className="text-sm font-medium text-text-primary">
              {formatEventType(event.event_type)}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-text-secondary font-mono">
            {event.ip_address || '-'}
          </span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <span
            className="text-sm text-text-muted truncate max-w-xs block"
            title={event.user_agent}
          >
            {truncateUserAgent(event.user_agent)}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className="text-sm text-text-muted"
            title={formatDateTime(event.created_at)}
            data-testid="event-timestamp"
          >
            {formatDistanceToNow(event.created_at)}
          </span>
        </td>
        <td className="px-4 py-3 w-10">
          {hasDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 text-text-muted hover:text-text-primary rounded"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </td>
      </tr>

      {/* Expanded details row */}
      {isExpanded && hasDetails && (
        <tr className="bg-page-bg/50">
          <td colSpan={6} className="px-4 py-3">
            <div
              className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm"
              data-testid="event-details"
            >
              <h4 className="font-medium text-text-primary mb-2">Event Details</h4>
              <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
              {event.user_email && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-text-muted">User: </span>
                  <span className="text-text-primary">{event.user_email}</span>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-border text-xs text-text-muted">
                Event ID: {event.id} | Full timestamp: {formatDateTime(event.created_at)}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Parse event details (may be string or object)
 */
function parseDetails(details) {
  if (!details) return null;
  if (typeof details === 'object') return details;
  try {
    return JSON.parse(details);
  } catch {
    return { raw: details };
  }
}

/**
 * Format event type for display
 */
function formatEventType(eventType) {
  if (!eventType) return 'Unknown';
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Truncate user agent string
 */
function truncateUserAgent(userAgent) {
  if (!userAgent) return '-';
  // Extract browser info
  const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  if (match) return match[0];
  return userAgent.length > 30 ? userAgent.substring(0, 30) + '...' : userAgent;
}

export default SecurityEventRow;
