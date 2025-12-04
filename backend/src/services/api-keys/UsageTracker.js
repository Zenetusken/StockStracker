import db from '../../database.js';

/**
 * UsageTracker - Tracks API usage with true sliding window rate limiting
 *
 * Features:
 * - Individual call timestamp tracking for accurate sliding windows
 * - Per-call expiration times based on rate limit window
 * - Real-time usage counts that automatically decrease as calls expire
 * - Detailed call info with TTL for frontend countdown displays
 * - Periodic cleanup of expired calls
 */
class UsageTracker {
  constructor() {
    // Cache for quick lookups
    this.usageCache = new Map();
    this.cacheTTL = 2000; // 2 seconds (shorter for more accurate real-time tracking)

    // Start cleanup job (every 30 seconds)
    this.cleanupTimer = setInterval(() => this.cleanupExpiredCalls(), 30000);
  }

  /**
   * Record an API call with individual timestamp tracking
   * @param {string} serviceName - Service name
   * @param {string} keyValue - The key that was used
   * @param {string} endpoint - Optional endpoint
   */
  recordCall(serviceName, keyValue, endpoint = null) {
    // Get key and rate limit info (including max_calls and service_id for burst tracking)
    const keyInfo = db.prepare(`
      SELECT k.id as key_id, k.service_id, rl.id as rate_limit_id, rl.window_type,
             rl.window_seconds, rl.limit_type, rl.max_calls
      FROM api_keys k
      JOIN api_services s ON k.service_id = s.id
      JOIN api_rate_limits rl ON rl.service_id = s.id
      WHERE s.name = ? AND k.key_value = ?
    `).all(serviceName, keyValue);

    if (keyInfo.length === 0) {
      console.warn(`[UsageTracker] Key not found for ${serviceName}`);
      return;
    }

    const now = Date.now();
    let keyIdToUpdate = null;
    let serviceId = null;

    // Insert a call timestamp for each rate limit type
    const insertStmt = db.prepare(`
      INSERT INTO api_call_timestamps (key_id, rate_limit_id, call_timestamp, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const info of keyInfo) {
        // Calculate expiration time: now + window_seconds * 1000
        const expiresAt = now + (info.window_seconds * 1000);

        insertStmt.run(info.key_id, info.rate_limit_id, now, expiresAt);
        keyIdToUpdate = info.key_id;
        serviceId = info.service_id;
      }

      // Update total calls ONCE per recordCall
      if (keyIdToUpdate !== null) {
        db.prepare(`
          UPDATE api_keys SET total_calls = total_calls + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(keyIdToUpdate);
      }
    });

    try {
      transaction();

      // After recording, check for burst limit hits (windows < 5 seconds)
      for (const info of keyInfo) {
        if (info.window_seconds < 5) {
          // Check current usage for this burst limit
          const currentUsage = this.getCurrentUsage(keyIdToUpdate, info.rate_limit_id);

          // If we've hit or exceeded the limit, record a burst event
          if (currentUsage >= info.max_calls) {
            this.recordBurstEvent(serviceId, info.rate_limit_id, now);
          }
        }
      }
    } catch (error) {
      console.error('[UsageTracker] Error recording call:', error);
    }

    // Clear cache to ensure fresh data
    this.usageCache.delete(serviceName);
  }

  /**
   * Record a burst limit hit event
   * @param {number} serviceId - Service ID
   * @param {number} rateLimitId - Rate limit ID
   * @param {number} timestamp - When the event occurred
   */
  recordBurstEvent(serviceId, rateLimitId, timestamp) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      db.prepare(`
        INSERT INTO api_burst_events (service_id, rate_limit_id, event_date, hit_count, last_hit_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(service_id, rate_limit_id, event_date) DO UPDATE SET
          hit_count = hit_count + 1,
          last_hit_at = excluded.last_hit_at
      `).run(serviceId, rateLimitId, today, timestamp);
    } catch (error) {
      console.error('[UsageTracker] Error recording burst event:', error);
    }
  }

  /**
   * Get burst event count for a service's burst limits
   * @param {string} serviceName - Service name
   * @returns {Object} Map of limitType -> { hitCount, lastHitAt }
   */
  getBurstEvents(serviceName) {
    const today = new Date().toISOString().split('T')[0];

    const results = db.prepare(`
      SELECT rl.limit_type, be.hit_count, be.last_hit_at
      FROM api_burst_events be
      JOIN api_rate_limits rl ON be.rate_limit_id = rl.id
      JOIN api_services s ON be.service_id = s.id
      WHERE s.name = ? AND be.event_date = ?
    `).all(serviceName, today);

    const events = {};
    for (const row of results) {
      events[row.limit_type] = {
        hitCount: row.hit_count,
        lastHitAt: row.last_hit_at
      };
    }
    return events;
  }

  /**
   * Get current usage count for a specific rate limit (true sliding window)
   * @param {number} keyId - Key ID
   * @param {number} rateLimitId - Rate limit ID
   * @returns {number} Current count of non-expired calls
   */
  getCurrentUsage(keyId, rateLimitId) {
    const now = Date.now();

    const result = db.prepare(`
      SELECT COUNT(*) as count FROM api_call_timestamps
      WHERE key_id = ? AND rate_limit_id = ? AND expires_at > ?
    `).get(keyId, rateLimitId, now);

    return result?.count || 0;
  }

  /**
   * Get detailed call information for a specific rate limit
   * Returns individual calls with their expiration times and TTLs
   * @param {number} keyId - Key ID
   * @param {number} rateLimitId - Rate limit ID
   * @returns {Array} Array of call details with timestamps, expiration, and TTL
   */
  getCallDetails(keyId, rateLimitId) {
    const now = Date.now();

    return db.prepare(`
      SELECT
        id,
        call_timestamp as callTimestamp,
        expires_at as expiresAt,
        (expires_at - ?) as ttlMs
      FROM api_call_timestamps
      WHERE key_id = ? AND rate_limit_id = ? AND expires_at > ?
      ORDER BY expires_at ASC
    `).all(now, keyId, rateLimitId, now);
  }

  /**
   * Get usage statistics for a service with detailed call info
   */
  getUsageForService(serviceName) {
    // Check cache (shorter TTL for more real-time accuracy)
    const cached = this.usageCache.get(serviceName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const service = db.prepare(`
      SELECT id FROM api_services WHERE name = ?
    `).get(serviceName);

    if (!service) return null;

    // Get rate limits for this service
    const rateLimits = db.prepare(`
      SELECT * FROM api_rate_limits WHERE service_id = ?
    `).all(service.id);

    // Get all active keys for this service
    const keys = db.prepare(`
      SELECT id FROM api_keys WHERE service_id = ? AND is_active = 1
    `).all(service.id);

    const now = Date.now();
    const usage = {};

    for (const limit of rateLimits) {
      // Get total usage across all keys for this rate limit
      let totalCurrent = 0;
      let allCalls = [];

      for (const key of keys) {
        const count = this.getCurrentUsage(key.id, limit.id);
        totalCurrent += count;

        const calls = this.getCallDetails(key.id, limit.id);
        allCalls = allCalls.concat(calls.map(c => ({
          ...c,
          keyId: key.id
        })));
      }

      // Sort all calls by expiration time
      allCalls.sort((a, b) => a.expiresAt - b.expiresAt);

      // Calculate next expiration (when the count will decrease)
      const nextExpiration = allCalls.length > 0 ? allCalls[0].expiresAt : null;
      const nextExpirySeconds = nextExpiration ? Math.max(0, Math.ceil((nextExpiration - now) / 1000)) : null;

      usage[limit.limit_type] = {
        current: totalCurrent,
        max: limit.max_calls,
        percentUsed: Math.min(100, (totalCurrent / limit.max_calls) * 100),
        windowSeconds: limit.window_seconds,
        windowType: limit.window_type,
        description: limit.description,
        // New fields for sliding window UI
        calls: allCalls.map(c => ({
          timestamp: c.callTimestamp,
          expiresAt: c.expiresAt,
          ttlSeconds: Math.max(0, Math.ceil(c.ttlMs / 1000))
        })),
        nextExpirySeconds
      };
    }

    // Calculate overall percent used (worst case)
    const percentages = Object.values(usage).map(u => u.percentUsed);
    const overallPercentUsed = percentages.length > 0 ? Math.max(...percentages) : 0;

    const data = {
      byLimit: usage,
      percentUsed: overallPercentUsed,
      status: overallPercentUsed > 90 ? 'critical' : overallPercentUsed > 70 ? 'warning' : 'healthy'
    };

    // Cache the result
    this.usageCache.set(serviceName, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Check if usage has exceeded any rate limit for a service
   * Used for preventive rate limiting (before 429 is received)
   * @param {string} serviceName - Service name
   * @returns {Object} { exceeded: boolean, limitType?, current?, max?, windowType? }
   */
  isUsageExceeded(serviceName) {
    const usage = this.getUsageForService(serviceName);
    if (!usage || !usage.byLimit) return { exceeded: false };

    // Check if ANY rate limit type is exceeded
    for (const [type, limit] of Object.entries(usage.byLimit)) {
      if (limit.current >= limit.max) {
        return {
          exceeded: true,
          limitType: type,
          current: limit.current,
          max: limit.max,
          windowType: limit.windowType,
          windowSeconds: limit.windowSeconds
        };
      }
    }
    return { exceeded: false };
  }

  /**
   * Get detailed usage with individual call timestamps for real-time UI
   * @param {string} serviceName - Service name
   * @returns {Object} Detailed usage data with per-call expiration times
   */
  getDetailedUsage(serviceName) {
    const service = db.prepare(`
      SELECT id FROM api_services WHERE name = ?
    `).get(serviceName);

    if (!service) return null;

    const rateLimits = db.prepare(`
      SELECT * FROM api_rate_limits WHERE service_id = ?
    `).all(service.id);

    const keys = db.prepare(`
      SELECT id, key_value, key_name FROM api_keys WHERE service_id = ? AND is_active = 1
    `).all(service.id);

    const now = Date.now();
    const limits = [];

    for (const limit of rateLimits) {
      let totalCurrent = 0;
      let allCalls = [];

      for (const key of keys) {
        const calls = this.getCallDetails(key.id, limit.id);
        totalCurrent += calls.length;
        allCalls = allCalls.concat(calls.map(c => ({
          timestamp: c.callTimestamp,
          expiresAt: c.expiresAt,
          ttlSeconds: Math.max(0, Math.ceil(c.ttlMs / 1000)),
          keyId: key.id
        })));
      }

      // Sort by expiration
      allCalls.sort((a, b) => a.expiresAt - b.expiresAt);

      limits.push({
        type: limit.limit_type,
        max: limit.max_calls,
        current: totalCurrent,
        percentUsed: Math.min(100, (totalCurrent / limit.max_calls) * 100),
        windowSeconds: limit.window_seconds,
        calls: allCalls
      });
    }

    return {
      service: serviceName,
      timestamp: now,
      limits
    };
  }

  /**
   * Get usage history for charts
   * Note: This still uses the old api_usage_windows table for historical data
   */
  getUsageHistory(serviceName, hours = 24) {
    const service = db.prepare(`
      SELECT id FROM api_services WHERE name = ?
    `).get(serviceName);

    if (!service) return [];

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return db.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00:00', uw.window_start) as hour,
        SUM(uw.call_count) as calls
      FROM api_usage_windows uw
      JOIN api_keys k ON uw.key_id = k.id
      WHERE k.service_id = ? AND uw.window_start >= ?
      GROUP BY hour
      ORDER BY hour ASC
    `).all(service.id, since.toISOString());
  }

  /**
   * Cleanup expired call timestamps
   * Called automatically every 30 seconds
   */
  cleanupExpiredCalls() {
    const now = Date.now();

    try {
      const result = db.prepare(`
        DELETE FROM api_call_timestamps WHERE expires_at <= ?
      `).run(now);

      if (result.changes > 0) {
        console.log(`[UsageTracker] Cleaned up ${result.changes} expired call timestamps`);
      }
    } catch (error) {
      console.error('[UsageTracker] Error cleaning up expired calls:', error);
    }
  }

  /**
   * Cleanup old usage window data (historical)
   */
  cleanup(daysToKeep = 7) {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    db.prepare(`
      DELETE FROM api_usage_windows WHERE window_start < ?
    `).run(cutoff.toISOString());
  }

  /**
   * Stop the cleanup interval
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

export default UsageTracker;
