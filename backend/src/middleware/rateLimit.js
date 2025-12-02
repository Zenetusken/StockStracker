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
