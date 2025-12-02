import express from 'express';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';
import { watchlistValidators } from '../middleware/validation.js';

const router = express.Router();

// All watchlist routes require authentication
router.use(requireAuth);

/**
 * GET /api/watchlists
 * Get all watchlists for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const watchlists = db.prepare(`
      SELECT
        w.*,
        COUNT(wi.id) as item_count
      FROM watchlists w
      LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
      WHERE w.user_id = ?
      GROUP BY w.id
      ORDER BY w.position ASC, w.created_at ASC
    `).all(req.session.userId);

    res.json(watchlists);
  } catch (error) {
    console.error('[Watchlists] Error fetching watchlists:', error);
    res.status(500).json({ error: 'Failed to fetch watchlists' });
  }
});

/**
 * GET /api/watchlists/:id
 * Get a specific watchlist with its items
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get watchlist
    const watchlist = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Get watchlist items
    const items = db.prepare(`
      SELECT * FROM watchlist_items
      WHERE watchlist_id = ?
      ORDER BY position ASC, added_at ASC
    `).all(id);

    res.json({
      ...watchlist,
      items
    });
  } catch (error) {
    console.error('[Watchlists] Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * POST /api/watchlists
 * Create a new watchlist
 */
router.post('/', watchlistValidators.create, (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Watchlist name is required' });
    }

    // Get current max position
    const maxPosition = db.prepare(`
      SELECT COALESCE(MAX(position), -1) as max_pos
      FROM watchlists
      WHERE user_id = ?
    `).get(req.session.userId);

    const result = db.prepare(`
      INSERT INTO watchlists (user_id, name, color, icon, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.session.userId,
      name.trim(),
      color || '#3B82F6',
      icon || 'star',
      maxPosition.max_pos + 1
    );

    const watchlist = db.prepare(`
      SELECT * FROM watchlists WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(watchlist);
  } catch (error) {
    console.error('[Watchlists] Error creating watchlist:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
});

/**
 * PUT /api/watchlists/:id
 * Update a watchlist
 */
router.put('/:id', watchlistValidators.update, (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    // Verify ownership
    const existing = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    db.prepare(`
      UPDATE watchlists
      SET name = COALESCE(?, name),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, color, icon, id);

    const updated = db.prepare(`
      SELECT * FROM watchlists WHERE id = ?
    `).get(id);

    res.json(updated);
  } catch (error) {
    console.error('[Watchlists] Error updating watchlist:', error);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

/**
 * DELETE /api/watchlists/:id
 * Delete a watchlist
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Prevent deleting default watchlist
    if (existing.is_default === 1) {
      return res.status(400).json({ error: 'Cannot delete default watchlist' });
    }

    // Delete watchlist (cascade will delete items)
    db.prepare(`
      DELETE FROM watchlists WHERE id = ?
    `).run(id);

    res.json({ success: true, message: 'Watchlist deleted' });
  } catch (error) {
    console.error('[Watchlists] Error deleting watchlist:', error);
    res.status(500).json({ error: 'Failed to delete watchlist' });
  }
});

/**
 * POST /api/watchlists/:id/items
 * Add a symbol to a watchlist
 */
router.post('/:id/items', watchlistValidators.addSymbol, (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, notes } = req.body;

    if (!symbol || symbol.trim() === '') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Verify watchlist ownership
    const watchlist = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Check if symbol already exists in this watchlist
    const existing = db.prepare(`
      SELECT * FROM watchlist_items
      WHERE watchlist_id = ? AND symbol = ?
    `).get(id, symbol.toUpperCase());

    if (existing) {
      return res.status(409).json({ error: 'Symbol already in watchlist' });
    }

    // Get current max position
    const maxPosition = db.prepare(`
      SELECT COALESCE(MAX(position), -1) as max_pos
      FROM watchlist_items
      WHERE watchlist_id = ?
    `).get(id);

    const result = db.prepare(`
      INSERT INTO watchlist_items (watchlist_id, symbol, position, notes)
      VALUES (?, ?, ?, ?)
    `).run(id, symbol.toUpperCase(), maxPosition.max_pos + 1, notes || null);

    const item = db.prepare(`
      SELECT * FROM watchlist_items WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(item);
  } catch (error) {
    console.error('[Watchlists] Error adding item:', error);
    res.status(500).json({ error: 'Failed to add symbol to watchlist' });
  }
});

/**
 * DELETE /api/watchlists/:id/items/:symbol
 * Remove a symbol from a watchlist
 */
router.delete('/:id/items/:symbol', watchlistValidators.removeSymbol, (req, res) => {
  try {
    const { id, symbol } = req.params;

    // Verify watchlist ownership
    const watchlist = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const result = db.prepare(`
      DELETE FROM watchlist_items
      WHERE watchlist_id = ? AND symbol = ?
    `).run(id, symbol.toUpperCase());

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Symbol not found in watchlist' });
    }

    res.json({ success: true, message: 'Symbol removed from watchlist' });
  } catch (error) {
    console.error('[Watchlists] Error removing item:', error);
    res.status(500).json({ error: 'Failed to remove symbol from watchlist' });
  }
});

/**
 * PUT /api/watchlists/:id/items/reorder
 * Reorder items in a watchlist
 */
router.put('/:id/items/reorder', watchlistValidators.reorder, (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // Array of { symbol, position }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Verify watchlist ownership
    const watchlist = db.prepare(`
      SELECT * FROM watchlists
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Update positions in a transaction
    const updatePosition = db.prepare(`
      UPDATE watchlist_items
      SET position = ?
      WHERE watchlist_id = ? AND symbol = ?
    `);

    const transaction = db.transaction((itemsToUpdate) => {
      for (const item of itemsToUpdate) {
        updatePosition.run(item.position, id, item.symbol);
      }
    });

    transaction(items);

    res.json({ success: true, message: 'Watchlist items reordered' });
  } catch (error) {
    console.error('[Watchlists] Error reordering items:', error);
    res.status(500).json({ error: 'Failed to reorder watchlist items' });
  }
});

/**
 * Helper function to create default watchlist for a user
 */
export function createDefaultWatchlist(userId) {
  try {
    const result = db.prepare(`
      INSERT INTO watchlists (user_id, name, color, icon, position, is_default)
      VALUES (?, 'My Watchlist', '#3B82F6', 'star', 0, 1)
    `).run(userId);

    return result.lastInsertRowid;
  } catch (error) {
    console.error('[Watchlists] Error creating default watchlist:', error);
    throw error;
  }
}

export default router;
