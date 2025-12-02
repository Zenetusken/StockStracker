import db from '../../database.js';
import KeyRotator from './KeyRotator.js';
import RateLimiter from './RateLimiter.js';
import UsageTracker from './UsageTracker.js';

/**
 * KeyProviderService - Singleton service for managing API keys
 *
 * Provides:
 * - Key retrieval with automatic rotation
 * - Rate limit awareness
 * - Usage tracking
 * - Fallback chain support
 */
class KeyProviderService {
  constructor() {
    this.keyRotator = new KeyRotator();
    this.rateLimiter = new RateLimiter();
    this.usageTracker = new UsageTracker();
    this._initialized = false;
  }

  /**
   * Initialize the service (lazy initialization)
   */
  initialize() {
    if (this._initialized) return;
    this._initialized = true;
    console.log('[KeyProvider] Service initialized');
  }

  /**
   * Check if the service is available
   */
  isAvailable() {
    return true;
  }

  /**
   * Get an API key for a service
   * @param {string} serviceName - Service name (e.g., 'finnhub', 'alphavantage')
   * @param {Object} options - Options
   * @param {Function} options.fallbackLoader - Fallback function to load key if none in DB
   * @param {string} options.endpoint - Optional endpoint for granular rate limiting
   * @returns {string|null} API key or null
   */
  getKey(serviceName, options = {}) {
    this.initialize();

    try {
      // Try to get key from database with rotation
      const key = this.keyRotator.getNextKey(serviceName, options.endpoint);
      if (key) {
        return key.key_value;
      }
    } catch (error) {
      console.log(`[KeyProvider] No keys available for ${serviceName}: ${error.message}`);
    }

    // Fallback to custom loader if provided
    if (options.fallbackLoader) {
      return options.fallbackLoader();
    }

    return null;
  }

  /**
   * Record a successful API call
   * @param {string} serviceName - Service name
   * @param {string} keyValue - The key that was used
   * @param {string} endpoint - Optional endpoint
   */
  recordCall(serviceName, keyValue, endpoint = null) {
    this.usageTracker.recordCall(serviceName, keyValue, endpoint);
  }

  /**
   * Record a rate limit hit (429 response)
   * @param {string} serviceName - Service name
   * @param {string} keyValue - The key that was rate limited
   * @param {number} retryAfter - Seconds until rate limit resets (optional)
   */
  recordRateLimit(serviceName, keyValue, retryAfter = 60) {
    this.rateLimiter.markRateLimited(serviceName, keyValue, retryAfter);
  }

  /**
   * Get all services with their status
   */
  getAllServices() {
    // Count rate_limited_keys only for keys where the rate limit hasn't expired
    // Use datetime() to properly parse ISO format timestamps
    const services = db.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM api_keys k WHERE k.service_id = s.id AND k.is_active = 1) as active_keys,
        (SELECT COUNT(*) FROM api_keys k WHERE k.service_id = s.id AND k.is_rate_limited = 1 AND datetime(k.rate_limited_until) > datetime('now')) as rate_limited_keys
      FROM api_services s
      WHERE s.is_active = 1
      ORDER BY s.priority DESC, s.display_name ASC
    `).all();

    return services.map(service => ({
      ...service,
      config: service.config ? JSON.parse(service.config) : null,
      rateLimits: this.getRateLimitsForService(service.id),
      keys: this.getKeysForService(service.id),
      usage: this.usageTracker.getUsageForService(service.name)
    }));
  }

  /**
   * Get a single service by name
   */
  getService(serviceName) {
    const service = db.prepare(`
      SELECT * FROM api_services WHERE name = ?
    `).get(serviceName);

    if (!service) return null;

    return {
      ...service,
      config: service.config ? JSON.parse(service.config) : null,
      rateLimits: this.getRateLimitsForService(service.id),
      keys: this.getKeysForService(service.id),
      usage: this.usageTracker.getUsageForService(serviceName)
    };
  }

  /**
   * Get rate limits for a service
   */
  getRateLimitsForService(serviceId) {
    return db.prepare(`
      SELECT * FROM api_rate_limits WHERE service_id = ?
    `).all(serviceId);
  }

  /**
   * Get keys for a service (masked for security)
   */
  getKeysForService(serviceId) {
    const keys = db.prepare(`
      SELECT
        id, service_id, key_name, is_active, is_rate_limited,
        rate_limited_until, last_used_at, total_calls, priority, source,
        created_at, updated_at,
        key_value
      FROM api_keys
      WHERE service_id = ?
      ORDER BY priority DESC, created_at ASC
    `).all(serviceId);

    return keys.map(key => ({
      ...key,
      key_value_masked: this.maskKey(key.key_value),
      key_value: undefined // Don't expose the actual key in list view
    }));
  }

  /**
   * Mask an API key for display
   */
  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  /**
   * Add a new API key
   */
  addKey(serviceName, keyValue, keyName = null) {
    const service = db.prepare('SELECT id FROM api_services WHERE name = ?').get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    try {
      const result = db.prepare(`
        INSERT INTO api_keys (service_id, key_value, key_name, source)
        VALUES (?, ?, ?, 'manual')
      `).run(service.id, keyValue, keyName);

      return { id: result.lastInsertRowid, success: true };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('This API key already exists for this service');
      }
      throw error;
    }
  }

  /**
   * Update an API key
   */
  updateKey(keyId, updates) {
    const allowedFields = ['key_name', 'is_active', 'priority'];
    const setClause = [];
    const values = [];

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        setClause.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClause.push('updated_at = CURRENT_TIMESTAMP');
    values.push(keyId);

    db.prepare(`
      UPDATE api_keys SET ${setClause.join(', ')} WHERE id = ?
    `).run(...values);

    return { success: true };
  }

  /**
   * Delete an API key
   */
  deleteKey(keyId) {
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId);
    return { success: result.changes > 0 };
  }

  /**
   * Test an API key by making a simple API call
   */
  async testKey(keyId) {
    const key = db.prepare(`
      SELECT k.*, s.name as service_name, s.base_url
      FROM api_keys k
      JOIN api_services s ON k.service_id = s.id
      WHERE k.id = ?
    `).get(keyId);

    if (!key) {
      throw new Error('Key not found');
    }

    try {
      let testUrl;
      let response;

      switch (key.service_name) {
        case 'finnhub':
          testUrl = `${key.base_url}/stock/symbol?exchange=US&token=${key.key_value}`;
          response = await fetch(testUrl);
          break;
        case 'alphavantage':
          testUrl = `${key.base_url}?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=${key.key_value}`;
          response = await fetch(testUrl);
          break;
        default:
          throw new Error(`Unknown service: ${key.service_name}`);
      }

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      }

      if (response.status === 429) {
        return { valid: true, warning: 'Key is valid but rate limited' };
      }

      const data = await response.json();

      // Check for error messages in response
      if (data.error || data['Error Message'] || data.Note?.includes('API call frequency')) {
        return { valid: false, error: data.error || data['Error Message'] || 'Rate limit exceeded' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get detailed usage information for a service
   * Includes individual call timestamps and TTLs for real-time UI display
   * @param {string} serviceName - Service name
   * @returns {Object} Detailed usage data with per-call expiration times
   */
  getDetailedUsage(serviceName) {
    return this.usageTracker.getDetailedUsage(serviceName);
  }

  /**
   * Get burst event counts for a service
   * Tracks how many times burst limits (per-second) have been hit today
   * @param {string} serviceName - Service name
   * @returns {Object} Map of limitType -> { hitCount, lastHitAt }
   */
  getBurstEvents(serviceName) {
    return this.usageTracker.getBurstEvents(serviceName);
  }

  /**
   * Get overall health status
   */
  getOverallStatus() {
    const services = this.getAllServices();

    let status = 'healthy';
    let configuredServices = 0;
    let warningServices = 0;
    let criticalServices = 0;

    for (const service of services) {
      if (service.active_keys === 0) {
        continue; // Not configured
      }

      configuredServices++;
      const usage = service.usage;

      if (usage && usage.percentUsed > 90) {
        criticalServices++;
      } else if (usage && usage.percentUsed > 70) {
        warningServices++;
      }
    }

    if (configuredServices === 0) {
      status = 'not_configured';
    } else if (criticalServices > 0) {
      status = 'critical';
    } else if (warningServices > 0) {
      status = 'warning';
    }

    return {
      status,
      configuredServices,
      totalServices: services.length,
      warningServices,
      criticalServices
    };
  }
}

// Export singleton instance
let instance = null;

export function getKeyProvider() {
  if (!instance) {
    instance = new KeyProviderService();
  }
  return instance;
}

export default KeyProviderService;
