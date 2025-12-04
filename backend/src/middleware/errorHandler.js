/**
 * Error handling middleware for security
 * Sanitizes error responses to prevent information disclosure
 */

/**
 * Central error handler middleware
 * - Logs full error details for debugging
 * - Returns sanitized error response to client
 * - Hides internal server error details in production
 */
export function errorHandler(err, req, res, next) {
  // Log full error for debugging
  console.error('[Error]', err);

  // Determine status code from error
  const statusCode = err.statusCode || err.status || 500;

  // Sanitize response - hide internal errors in production
  const response = {
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.message
    })
  };

  res.status(statusCode).json(response);
}

export default errorHandler;
