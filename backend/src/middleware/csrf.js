import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Note: csurf package is deprecated, so we implement our own.
 *
 * How it works:
 * 1. On token request: Generate a random token, store in session, return to client
 * 2. On protected requests: Client sends token in header, we verify against session
 *
 * Combined with sameSite: 'strict' cookies, this provides robust CSRF protection.
 */

// Token configuration
const TOKEN_LENGTH = 32;
const TOKEN_HEADER = 'x-csrf-token';
const TOKEN_BODY_KEY = '_csrf';

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and provide CSRF token
 * Call this on GET /api/csrf-token
 */
export function csrfTokenEndpoint(req, res) {
  // Generate new token and store in session
  const token = generateToken();
  req.session.csrfToken = token;
  req.session.csrfTokenCreatedAt = Date.now();

  res.json({
    csrfToken: token,
    expiresIn: 3600 // Token valid for 1 hour (refreshed on each request)
  });
}

// Paths that are exempt from CSRF protection (stateless, safe operations)
// These are relative paths within the route handler (e.g., /check-password within /api/auth)
const CSRF_EXEMPT_PATHS = [
  '/check-password',  // Password strength checker (stateless, no side effects)
];

/**
 * Middleware to validate CSRF token on state-changing requests
 * Apply this to routes that modify data (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req, res, next) {
  // Skip for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip for exempt paths
  if (CSRF_EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  // Get token from request (header or body)
  const tokenFromRequest =
    req.headers[TOKEN_HEADER] ||
    req.headers[TOKEN_HEADER.toLowerCase()] ||
    req.body?.[TOKEN_BODY_KEY];

  // Get token from session
  const tokenFromSession = req.session?.csrfToken;
  const tokenCreatedAt = req.session?.csrfTokenCreatedAt;

  // Validate token exists
  if (!tokenFromRequest) {
    console.warn('[CSRF] Missing token in request');
    return res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  if (!tokenFromSession) {
    console.warn('[CSRF] No token in session');
    return res.status(403).json({
      error: 'CSRF token invalid - please refresh and try again',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  // Check token expiration (1 hour)
  const TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
  if (tokenCreatedAt && (Date.now() - tokenCreatedAt > TOKEN_MAX_AGE)) {
    console.warn('[CSRF] Token expired');
    // Clear expired token
    delete req.session.csrfToken;
    delete req.session.csrfTokenCreatedAt;
    return res.status(403).json({
      error: 'CSRF token expired - please refresh and try again',
      code: 'CSRF_TOKEN_EXPIRED'
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(
    Buffer.from(tokenFromRequest),
    Buffer.from(tokenFromSession)
  )) {
    console.warn('[CSRF] Token mismatch');
    return res.status(403).json({
      error: 'CSRF token invalid',
      code: 'CSRF_TOKEN_MISMATCH'
    });
  }

  // Token valid - generate new token for next request (token rotation)
  req.session.csrfToken = generateToken();
  req.session.csrfTokenCreatedAt = Date.now();

  next();
}

/**
 * Helper middleware to attach CSRF token to response for SPA convenience
 * Adds token to res.locals for template rendering
 */
export function attachCsrfToken(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateToken();
      req.session.csrfTokenCreatedAt = Date.now();
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

export default {
  csrfTokenEndpoint,
  csrfProtection,
  attachCsrfToken
};
