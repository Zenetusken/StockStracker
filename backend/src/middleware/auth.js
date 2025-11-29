/**
 * Authentication middleware
 * Protects routes that require a logged-in user
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  next();
}

/**
 * Optional authentication middleware
 * Adds user info to request if logged in, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  // User info is available in req.session.userId if logged in
  next();
}
