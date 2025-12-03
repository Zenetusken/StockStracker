import express from 'express';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/alerts
 * Get all alerts for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const alerts = db.prepare(`
      SELECT * FROM alerts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.session.userId);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/alerts/:id
 * Get a specific alert
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const alert = db.prepare(`
      SELECT * FROM alerts
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

/**
 * POST /api/alerts
 * Create a new alert
 */
router.post('/', (req, res) => {
  try {
    const { symbol, name, type, target_price, is_recurring } = req.body;

    // Validate required fields
    if (!symbol || !type || target_price === undefined) {
      return res.status(400).json({ error: 'Symbol, type, and target_price are required' });
    }

    // Validate type
    const validTypes = ['price_above', 'price_below', 'percent_change'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    const result = db.prepare(`
      INSERT INTO alerts (user_id, symbol, name, type, target_price, is_recurring, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      req.session.userId,
      symbol.toUpperCase(),
      name || `${type === 'price_above' ? 'Above' : type === 'price_below' ? 'Below' : 'Change'} ${target_price}`,
      type,
      target_price,
      is_recurring ? 1 : 0
    );

    const newAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newAlert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

/**
 * PUT /api/alerts/:id
 * Update an alert
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, name, type, target_price, is_recurring, is_active } = req.body;

    // Verify ownership
    const existingAlert = db.prepare(`
      SELECT * FROM alerts WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existingAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (symbol !== undefined) {
      updates.push('symbol = ?');
      values.push(symbol.toUpperCase());
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (type !== undefined) {
      const validTypes = ['price_above', 'price_below', 'percent_change'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
      }
      updates.push('type = ?');
      values.push(type);
    }
    if (target_price !== undefined) {
      updates.push('target_price = ?');
      values.push(target_price);
    }
    if (is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(is_recurring ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE alerts SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    const updatedAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);

    res.json(updatedAlert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existingAlert = db.prepare(`
      SELECT * FROM alerts WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existingAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    db.prepare('DELETE FROM alerts WHERE id = ?').run(id);

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

/**
 * GET /api/alerts/history
 * Get alert trigger history
 */
router.get('/history/all', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM alert_history
      WHERE user_id = ?
      ORDER BY triggered_at DESC
      LIMIT 50
    `).all(req.session.userId);

    res.json(history);
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

export default router;
