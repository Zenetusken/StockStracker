import db from '../../database.js';
import rateLimitEvents from './RateLimitEventEmitter.js';

/**
 * RateLimiter - Tracks rate limit status for API keys
 *
 * Handles:
 * - Marking keys as rate limited
 * - Clearing rate limit flags when time expires
 * - Providing rate limit status information
 * - Emitting events for rate limit state changes
 */
class RateLimiter {
  constructor() {
    // In-memory cache for quick checks
    this.rateLimitedKeys = new Map();

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Mark a key as rate limited
   * @param {string} serviceName - Service name
   * @param {string} keyValue - The key value that was rate limited
   * @param {number} retryAfter - Seconds until rate limit resets
   */
  markRateLimited(serviceName, keyValue, retryAfter = 60) {
    const key = db.prepare(`
      SELECT k.id FROM api_keys k
      JOIN api_services s ON k.service_id = s.id
      WHERE s.name = ? AND k.key_value = ?
    `).get(serviceName, keyValue);

    if (!key) {
      console.warn(`[RateLimiter] Key not found for ${serviceName}`);
      return;
    }

    const rateLimitedUntil = new Date(Date.now() + retryAfter * 1000);

    db.prepare(`
      UPDATE api_keys
      SET is_rate_limited = 1, rate_limited_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rateLimitedUntil.toISOString(), key.id);

    // Update in-memory cache
    this.rateLimitedKeys.set(key.id, rateLimitedUntil);

    console.log(`[RateLimiter] Marked key ${key.id} as rate limited until ${rateLimitedUntil.toISOString()}`);

    // Emit rate limit hit event for toast notifications
    rateLimitEvents.emitRateLimitHit(serviceName, retryAfter, 'per_minute');
  }

  /**
   * Check if a key is currently rate limited
   */
  isRateLimited(keyId) {
    const cached = this.rateLimitedKeys.get(keyId);
    if (cached) {
      if (new Date() < cached) {
        return true;
      }
      // Rate limit has expired, remove from cache
      this.rateLimitedKeys.delete(keyId);
    }

    // Check database
    const key = db.prepare(`
      SELECT is_rate_limited, rate_limited_until FROM api_keys WHERE id = ?
    `).get(keyId);

    if (!key || !key.is_rate_limited) {
      return false;
    }

    if (key.rate_limited_until && new Date(key.rate_limited_until) > new Date()) {
      return true;
    }

    // Rate limit has expired, clear the flag
    this.clearRateLimit(keyId);
    return false;
  }

  /**
   * Clear rate limit flag for a key
   */
  clearRateLimit(keyId) {
    // Get service name before clearing for the event
    const keyInfo = db.prepare(`
      SELECT s.name as service_name FROM api_keys k
      JOIN api_services s ON k.service_id = s.id
      WHERE k.id = ?
    `).get(keyId);

    db.prepare(`
      UPDATE api_keys
      SET is_rate_limited = 0, rate_limited_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(keyId);

    this.rateLimitedKeys.delete(keyId);

    // Emit rate limit recovered event for toast notifications
    if (keyInfo?.service_name) {
      rateLimitEvents.emitRateLimitRecovered(keyInfo.service_name);
    }
  }

  /**
   * Get rate limit status for a service
   */
  getRateLimitStatus(serviceName) {
    const result = db.prepare(`
      SELECT
        k.id,
        k.key_name,
        k.is_rate_limited,
        k.rate_limited_until
      FROM api_keys k
      JOIN api_services s ON k.service_id = s.id
      WHERE s.name = ? AND k.is_active = 1
    `).all(serviceName);

    return result.map(key => ({
      ...key,
      isCurrentlyLimited: key.is_rate_limited &&
        key.rate_limited_until &&
        new Date(key.rate_limited_until) > new Date(),
      timeRemaining: key.rate_limited_until
        ? Math.max(0, new Date(key.rate_limited_until) - new Date()) / 1000
        : 0
    }));
  }

  /**
   * Cleanup expired rate limits
   */
  cleanup() {
    // Clear expired rate limits in database
    // Use datetime() to parse ISO format timestamps (with 'T' and 'Z')
    // This handles both '2025-11-30T23:07:35.803Z' and '2025-11-30 23:07:35' formats
    db.prepare(`
      UPDATE api_keys
      SET is_rate_limited = 0, rate_limited_until = NULL
      WHERE is_rate_limited = 1 AND datetime(rate_limited_until) < datetime('now')
    `).run();

    // Clear in-memory cache
    const now = new Date();
    for (const [keyId, expiry] of this.rateLimitedKeys.entries()) {
      if (expiry < now) {
        this.rateLimitedKeys.delete(keyId);
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default RateLimiter;
