/**
 * Rate limiting middleware for security
 * Protects against brute force and DoS attacks
 */
import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Applies to all API routes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
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
  max: 5,                     // 5 attempts per window
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
