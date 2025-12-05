import { useToastStore } from '../stores/toastStore';

/**
 * Error Handler Utility (M4 fix)
 * Centralized error handling for API errors with user-friendly toast notifications
 */

/**
 * Handle API errors consistently across the app
 * @param {Error} error - The error object
 * @param {string} context - Context describing the operation (e.g., "Loading watchlist")
 * @param {Object} options - Additional options
 * @param {boolean} options.silent - If true, only log to console (no toast)
 * @param {string} options.service - Service identifier for toast deduplication
 */
export function handleApiError(error, context = 'Operation', options = {}) {
  const { silent = false, service = null } = options;

  // Extract error message
  const message = error?.message || error?.error || 'An unexpected error occurred';

  // Log to console for debugging
  console.error(`[${context}]`, error);

  // Don't show toast if silent mode
  if (silent) return;

  // Get toast store (works outside React components)
  const toast = useToastStore.getState();

  // Determine toast type and title based on error
  let type = 'error';
  let title = `${context} Failed`;

  // Handle specific error cases
  if (error?.status === 401 || message.toLowerCase().includes('unauthorized')) {
    title = 'Authentication Required';
    type = 'warning';
  } else if (error?.status === 403 || message.toLowerCase().includes('forbidden')) {
    title = 'Access Denied';
  } else if (error?.status === 404 || message.toLowerCase().includes('not found')) {
    title = 'Not Found';
    type = 'warning';
  } else if (error?.status === 429 || message.toLowerCase().includes('rate limit')) {
    title = 'Too Many Requests';
    type = 'warning';
  } else if (error?.name === 'AbortError') {
    // Request was cancelled - don't show toast
    return;
  } else if (!navigator.onLine || message.toLowerCase().includes('network')) {
    title = 'Network Error';
  }

  toast.addToast({
    type,
    title,
    message,
    service: service || context.toLowerCase().replace(/\s+/g, '-'),
  });
}

/**
 * Create an error handler for a specific context
 * Useful for creating consistent error handlers for specific features
 * @param {string} context - The context/feature name
 * @param {Object} defaultOptions - Default options for this handler
 * @returns {Function} Error handler function
 */
export function createErrorHandler(context, defaultOptions = {}) {
  return (error, overrideOptions = {}) => {
    handleApiError(error, context, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error messages
 * @param {Object} options - Error handler options
 * @returns {Function} Wrapped function that catches and handles errors
 */
export function withErrorHandling(fn, context, options = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleApiError(error, context, options);
      throw error; // Re-throw for caller to handle if needed
    }
  };
}

export default handleApiError;
