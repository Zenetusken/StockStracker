import express from 'express';
import { getKeyProvider } from '../services/api-keys/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * API Keys Admin Routes
 * Base path: /api/admin/api-keys
 */

/**
 * GET /services
 * List all API services with their status
 */
router.get('/services', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const services = keyProvider.getAllServices();
    res.json({ services });
  } catch (error) {
    console.error('[API Keys] Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /services/:name
 * Get details for a specific service
 */
router.get('/services/:name', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const service = keyProvider.getService(req.params.name);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service });
  } catch (error) {
    console.error('[API Keys] Error fetching service:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /services/:service/usage
 * Get detailed usage for a service with individual call timestamps
 * Returns per-call expiration times for real-time sliding window UI
 */
router.get('/services/:service/usage', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const usage = keyProvider.getDetailedUsage(req.params.service);

    if (!usage) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(usage);
  } catch (error) {
    console.error('[API Keys] Error fetching detailed usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /services/:service/burst-events
 * Get burst limit hit counts for today
 * Tracks how many times per-second rate limits have been hit
 */
router.get('/services/:service/burst-events', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const events = keyProvider.getBurstEvents(req.params.service);
    res.json({ events });
  } catch (error) {
    console.error('[API Keys] Error fetching burst events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /status
 * Get overall health status
 */
router.get('/status', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const status = keyProvider.getOverallStatus();
    res.json(status);
  } catch (error) {
    console.error('[API Keys] Error fetching status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /keys
 * Add a new API key
 */
router.post('/keys', requireAuth, (req, res) => {
  try {
    const { serviceName, keyValue, keyName } = req.body;

    if (!serviceName || !keyValue) {
      return res.status(400).json({ error: 'serviceName and keyValue are required' });
    }

    const keyProvider = getKeyProvider();
    const result = keyProvider.addKey(serviceName, keyValue, keyName);

    res.status(201).json(result);
  } catch (error) {
    console.error('[API Keys] Error adding key:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
  }
});

/**
 * PUT /keys/:id
 * Update an API key
 */
router.put('/keys/:id', requireAuth, (req, res) => {
  try {
    const keyId = parseInt(req.params.id, 10);
    const updates = req.body;

    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid key ID' });
    }

    const keyProvider = getKeyProvider();
    const result = keyProvider.updateKey(keyId, updates);

    res.json(result);
  } catch (error) {
    console.error('[API Keys] Error updating key:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /keys/:id
 * Delete an API key
 */
router.delete('/keys/:id', requireAuth, (req, res) => {
  try {
    const keyId = parseInt(req.params.id, 10);

    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid key ID' });
    }

    const keyProvider = getKeyProvider();
    const result = keyProvider.deleteKey(keyId);

    if (!result.success) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('[API Keys] Error deleting key:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /keys/:id/test
 * Test/validate an API key
 */
router.post('/keys/:id/test', requireAuth, async (req, res) => {
  try {
    const keyId = parseInt(req.params.id, 10);

    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid key ID' });
    }

    const keyProvider = getKeyProvider();
    const result = await keyProvider.testKey(keyId);

    res.json(result);
  } catch (error) {
    console.error('[API Keys] Error testing key:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

/**
 * GET /usage
 * Get usage statistics
 */
router.get('/usage', requireAuth, (req, res) => {
  try {
    const keyProvider = getKeyProvider();
    const services = keyProvider.getAllServices();

    const usage = services.map(service => ({
      name: service.name,
      displayName: service.display_name,
      usage: service.usage,
      activeKeys: service.active_keys,
      rateLimitedKeys: service.rate_limited_keys
    }));

    res.json({ usage });
  } catch (error) {
    console.error('[API Keys] Error fetching usage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /usage/:serviceName/history
 * Get usage history for charts
 */
router.get('/usage/:serviceName/history', requireAuth, (req, res) => {
  try {
    const hours = parseInt(req.query.hours, 10) || 24;
    const keyProvider = getKeyProvider();
    const history = keyProvider.usageTracker.getUsageHistory(req.params.serviceName, hours);

    res.json({ history });
  } catch (error) {
    console.error('[API Keys] Error fetching usage history:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
