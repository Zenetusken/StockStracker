import db from '../../database.js';

/**
 * KeyRotator - Implements weighted round-robin key selection with rate awareness
 *
 * Algorithm:
 * 1. Fetch active, non-rate-limited keys for service
 * 2. Calculate "headroom" = max_calls - current_usage for each key
 * 3. Filter keys with headroom > 0
 * 4. Sort by: headroom DESC, last_used ASC, priority DESC
 * 5. Select first candidate, update last_used_at
 */
class KeyRotator {
  constructor() {
    // In-memory cache of current window usage
    this.usageCache = new Map();
    this.cacheTimeout = 5000; // 5 seconds
  }

  /**
   * Get the next available key for a service
   * @param {string} serviceName - Service name
   * @param {string} endpoint - Optional endpoint for granular limits
   * @returns {Object} Key object with key_value and metadata
   */
  getNextKey(serviceName, endpoint = null) {
    // Get service and its rate limits
    const service = db.prepare(`
      SELECT id FROM api_services WHERE name = ? AND is_active = 1
    `).get(serviceName);

    if (!service) {
      throw new Error(`Service not found or inactive: ${serviceName}`);
    }

    // Get active, non-rate-limited keys
    // Use datetime() to parse ISO format timestamps (handles both 'T'/'Z' and space formats)
    const keys = db.prepare(`
      SELECT k.*
      FROM api_keys k
      WHERE k.service_id = ?
        AND k.is_active = 1
        AND (k.is_rate_limited = 0 OR datetime(k.rate_limited_until) < datetime('now'))
      ORDER BY k.priority DESC, k.last_used_at ASC NULLS FIRST
    `).all(service.id);

    if (keys.length === 0) {
      throw new Error(`No active keys available for ${serviceName}`);
    }

    // Get rate limits for this service
    const rateLimits = db.prepare(`
      SELECT * FROM api_rate_limits
      WHERE service_id = ?
      ORDER BY window_seconds ASC
    `).all(service.id);

    // Calculate headroom for each key
    const keysWithHeadroom = keys.map(key => {
      const headroom = this.calculateHeadroom(key, rateLimits);
      return { ...key, headroom };
    });

    // Filter keys with positive headroom
    const availableKeys = keysWithHeadroom.filter(k => k.headroom > 0);

    if (availableKeys.length === 0) {
      // All keys are at their limit - find the one that will be available soonest
      const leastUsedKey = keysWithHeadroom.reduce((a, b) =>
        a.headroom > b.headroom ? a : b
      );
      throw new Error(`All keys exhausted for ${serviceName}. Best key has headroom: ${leastUsedKey.headroom}`);
    }

    // Sort by headroom DESC, last_used ASC, priority DESC
    availableKeys.sort((a, b) => {
      if (b.headroom !== a.headroom) return b.headroom - a.headroom;
      if (!a.last_used_at && b.last_used_at) return -1;
      if (a.last_used_at && !b.last_used_at) return 1;
      if (a.last_used_at !== b.last_used_at) {
        return new Date(a.last_used_at) - new Date(b.last_used_at);
      }
      return b.priority - a.priority;
    });

    // Select the best key
    const selectedKey = availableKeys[0];

    // Update last_used_at
    db.prepare(`
      UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?
    `).run(selectedKey.id);

    return selectedKey;
  }

  /**
   * Calculate headroom for a key based on rate limits
   */
  calculateHeadroom(key, rateLimits) {
    if (rateLimits.length === 0) {
      return Infinity; // No limits defined
    }

    let minHeadroom = Infinity;

    for (const limit of rateLimits) {
      const usage = this.getCurrentUsage(key.id, limit);
      const headroom = limit.max_calls - usage;
      minHeadroom = Math.min(minHeadroom, headroom);
    }

    return minHeadroom;
  }

  /**
   * Get current usage for a key within a rate limit window
   */
  getCurrentUsage(keyId, rateLimit) {
    const cacheKey = `${keyId}:${rateLimit.id}`;
    const cached = this.usageCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.count;
    }

    // Calculate window start based on window type
    let windowStart;
    const now = new Date();

    if (rateLimit.window_type === 'daily') {
      // Daily window starts at midnight UTC
      windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    } else {
      // Sliding window
      windowStart = new Date(now.getTime() - rateLimit.window_seconds * 1000);
    }

    // Query usage from database
    const result = db.prepare(`
      SELECT COALESCE(SUM(call_count), 0) as total
      FROM api_usage_windows
      WHERE key_id = ? AND rate_limit_id = ? AND window_start >= ?
    `).get(keyId, rateLimit.id, windowStart.toISOString());

    const count = result?.total || 0;

    // Cache the result
    this.usageCache.set(cacheKey, { count, timestamp: Date.now() });

    return count;
  }

  /**
   * Clear the usage cache
   */
  clearCache() {
    this.usageCache.clear();
  }
}

export default KeyRotator;
