/**
 * Format a date as a relative time string (e.g., "2 minutes ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatDistanceToNow(date) {
  if (!date) return 'Unknown';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) {
    return seconds <= 5 ? 'just now' : `${seconds} seconds ago`;
  }
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (days < 7) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Format a date to a localized short date/time string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateTime(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {string} ISO date string
 */
export function toISODateString(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Get start of day for a date
 * @param {Date} date - Date
 * @returns {Date} Start of day
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day for a date
 * @param {Date} date - Date
 * @returns {Date} End of day
 */
export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
