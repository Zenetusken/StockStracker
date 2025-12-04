import { EventEmitter } from 'events';
import db from '../../database.js';

/**
 * RateLimitEventEmitter - Singleton EventEmitter for rate limit state changes
 *
 * Events emitted:
 * - 'usage_warning': When usage reaches 80% threshold
 * - 'rate_limit_hit': When rate limit is reached (100%)
 * - 'rate_limit_recovered': When rate limit expires and service is available
 */
class RateLimitEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Track last warning to prevent spam (service -> timestamp)
    this.lastWarnings = new Map();
    // Minimum time between warnings for same service (30 seconds)
    this.warningCooldown = 30000;

    // Service display names
    this.serviceDisplayNames = {
      finnhub: 'Finnhub',
      yahoo: 'Yahoo Finance'
    };
  }

  /**
   * Get display name for a service
   */
  getDisplayName(serviceName) {
    return this.serviceDisplayNames[serviceName] || serviceName;
  }

  /**
   * Get service info from database
   */
  getServiceInfo(serviceName) {
    return db.prepare(`
      SELECT id, name, display_name FROM api_services WHERE name = ?
    `).get(serviceName);
  }

  /**
   * Emit usage warning event (80% threshold)
   */
  emitUsageWarning(serviceName, current, max, limitType) {
    const now = Date.now();
    const lastWarning = this.lastWarnings.get(`${serviceName}:${limitType}`);

    // Check cooldown to prevent spam
    if (lastWarning && (now - lastWarning) < this.warningCooldown) {
      return;
    }

    this.lastWarnings.set(`${serviceName}:${limitType}`, now);

    const percentUsed = Math.round((current / max) * 100);
    const displayName = this.getDisplayName(serviceName);
    const limitDesc = limitType === 'daily' ? 'day' : 'minute';

    const event = {
      type: 'usage_warning',
      service: serviceName,
      displayName,
      timestamp: now,
      percentUsed,
      current,
      max,
      limitType,
      message: `${displayName} at ${percentUsed}% capacity (${current}/${max} calls per ${limitDesc}). Slow down to avoid rate limiting.`
    };

    console.log(`[RateLimitEvents] Emitting usage_warning for ${serviceName}: ${percentUsed}%`);
    this.emit('usage_warning', event);
    this.emit('rate_limit_event', event);
  }

  /**
   * Emit rate limit hit event (100%)
   */
  emitRateLimitHit(serviceName, retryAfter, limitType = 'per_minute') {
    const now = Date.now();
    const displayName = this.getDisplayName(serviceName);
    const limitDesc = limitType === 'daily' ? 'daily limit' : '60/min';

    const event = {
      type: 'rate_limit_hit',
      service: serviceName,
      displayName,
      timestamp: now,
      retryAfter,
      limitType,
      message: `${displayName} rate limit reached (${limitDesc}). Recovering in ${retryAfter}s.`
    };

    console.log(`[RateLimitEvents] Emitting rate_limit_hit for ${serviceName}`);
    this.emit('rate_limit_hit', event);
    this.emit('rate_limit_event', event);
  }

  /**
   * Emit rate limit recovered event
   */
  emitRateLimitRecovered(serviceName) {
    const now = Date.now();
    const displayName = this.getDisplayName(serviceName);

    // Clear warning cooldown for this service
    for (const key of this.lastWarnings.keys()) {
      if (key.startsWith(`${serviceName}:`)) {
        this.lastWarnings.delete(key);
      }
    }

    const event = {
      type: 'rate_limit_recovered',
      service: serviceName,
      displayName,
      timestamp: now,
      message: `${displayName} is now available again.`
    };

    console.log(`[RateLimitEvents] Emitting rate_limit_recovered for ${serviceName}`);
    this.emit('rate_limit_recovered', event);
    this.emit('rate_limit_event', event);
  }
}

// Export singleton instance
const rateLimitEvents = new RateLimitEventEmitter();
export default rateLimitEvents;
