/**
 * Rate limiting middleware for security
 * Protects against brute force and DoS attacks
 */
import rateLimit from 'express-rate-limit';

// Development mode has more lenient rate limits for testing
const isDev = process.env.NODE_ENV !== 'production';

/**
 * General API rate limiter
 * Applies to all API routes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: isDev ? 1000 : 100,   // 1000 in dev, 100 in production
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,       // Disable `X-RateLimit-*` headers
});

/**
 * Strict limiter for authentication endpoints
 * Protects against brute force login attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: isDev ? 100 : 5,      // 100 in dev, 5 in production
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // Don't count successful logins
});

/**
 * Very strict limiter for password operations
 * Protects against password guessing attacks
 */
export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,                     // 3 attempts per hour
  message: { error: 'Too many password attempts, please try again in an hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * MFA-specific rate limiter
 * Protects against brute force MFA code enumeration
 * - Limits to 3 failed attempts per 15 minutes
 * - Uses pendingMfaUserId for per-user limiting (falls back to IP)
 * - More strict than authLimiter because MFA codes are time-limited
 */
export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: isDev ? 50 : 3,       // 50 in dev, 3 in production
  keyGenerator: (req) => {
    // Primary: Key by pending MFA user ID (more secure than IP)
    // Fallback: Use 'anonymous-mfa' prefix + IP for requests without session
    if (req.session?.pendingMfaUserId) {
      return `mfa-user-${req.session.pendingMfaUserId}`;
    }
    // Fallback key that doesn't use raw IP
    return `mfa-anon-${req.ip || 'unknown'}`;
  },
  message: {
    error: 'Too many MFA attempts',
    message: 'Account temporarily locked due to too many failed MFA attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // Don't count successful MFA verifications
  // Disable IPv6 validation since we prefix our keys and use userId when available
  validate: { keyGeneratorIpFallback: false },
});

/**
 * Quote endpoint rate limiter (M8)
 * Protects against API abuse for stock quote lookups
 * - Per-user limiting when authenticated, falls back to IP
 * - 60 requests per minute in production
 */
export const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: isDev ? 300 : 60,  // 300 in dev, 60 in production
  keyGenerator: (req) => {
    // Prefer user ID for accurate per-user limiting
    if (req.session?.userId) {
      return `quote-user-${req.session.userId}`;
    }
    return `quote-ip-${req.ip || 'unknown'}`;
  },
  message: { error: 'Too many quote requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable IPv6 validation since we prefix our keys and use userId when available
  validate: { keyGeneratorIpFallback: false },
});
