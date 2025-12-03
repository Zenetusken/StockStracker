import express from 'express';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All portfolio routes require authentication
router.use(requireAuth);

/**
 * GET /api/portfolios
 * Get all portfolios for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const portfolios = db.prepare(`
      SELECT
        p.*,
        COUNT(DISTINCT ph.id) as holdings_count,
        COALESCE(SUM(ph.total_shares * ph.average_cost), 0) as total_invested
      FROM portfolios p
      LEFT JOIN portfolio_holdings ph ON p.id = ph.portfolio_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.is_default DESC, p.created_at ASC
    `).all(req.session.userId);

    res.json(portfolios);
  } catch (error) {
    console.error('[Portfolios] Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

/**
 * GET /api/portfolios/:id
 * Get a specific portfolio with its holdings
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get portfolio
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get portfolio holdings
    const holdings = db.prepare(`
      SELECT * FROM portfolio_holdings
      WHERE portfolio_id = ?
      ORDER BY symbol ASC
    `).all(id);

    // Get recent transactions (last 10)
    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE portfolio_id = ?
      ORDER BY executed_at DESC
      LIMIT 10
    `).all(id);

    res.json({
      ...portfolio,
      holdings,
      recent_transactions: transactions
    });
  } catch (error) {
    console.error('[Portfolios] Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

/**
 * POST /api/portfolios
 * Create a new portfolio
 */
router.post('/', (req, res) => {
  try {
    const { name, description, cash_balance, is_paper_trading } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Portfolio name is required' });
    }

    // Check if this is the first portfolio (make it default)
    const existingCount = db.prepare(`
      SELECT COUNT(*) as count FROM portfolios WHERE user_id = ?
    `).get(req.session.userId);

    const isDefault = existingCount.count === 0 ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO portfolios (user_id, name, description, cash_balance, is_paper_trading, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.session.userId,
      name.trim(),
      description?.trim() || null,
      cash_balance || 0,
      is_paper_trading ? 1 : 0,
      isDefault
    );

    const portfolio = db.prepare(`
      SELECT * FROM portfolios WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(portfolio);
  } catch (error) {
    console.error('[Portfolios] Error creating portfolio:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

/**
 * PUT /api/portfolios/:id
 * Update a portfolio
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cash_balance, is_paper_trading } = req.body;

    // Verify ownership
    const existing = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    db.prepare(`
      UPDATE portfolios
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          cash_balance = COALESCE(?, cash_balance),
          is_paper_trading = COALESCE(?, is_paper_trading),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name?.trim() || null,
      description?.trim() || null,
      cash_balance,
      is_paper_trading !== undefined ? (is_paper_trading ? 1 : 0) : null,
      id
    );

    const updated = db.prepare(`
      SELECT * FROM portfolios WHERE id = ?
    `).get(id);

    res.json(updated);
  } catch (error) {
    console.error('[Portfolios] Error updating portfolio:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

/**
 * DELETE /api/portfolios/:id
 * Delete a portfolio
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Prevent deleting default portfolio
    if (existing.is_default === 1) {
      return res.status(400).json({ error: 'Cannot delete default portfolio' });
    }

    // Delete portfolio (this will cascade to holdings, transactions, etc.)
    db.prepare(`DELETE FROM portfolio_holdings WHERE portfolio_id = ?`).run(id);
    db.prepare(`DELETE FROM transactions WHERE portfolio_id = ?`).run(id);
    db.prepare(`DELETE FROM portfolios WHERE id = ?`).run(id);

    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (error) {
    console.error('[Portfolios] Error deleting portfolio:', error);
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

/**
 * GET /api/portfolios/:id/holdings
 * Get all holdings for a portfolio
 */
router.get('/:id/holdings', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const holdings = db.prepare(`
      SELECT * FROM portfolio_holdings
      WHERE portfolio_id = ?
      ORDER BY symbol ASC
    `).all(id);

    res.json(holdings);
  } catch (error) {
    console.error('[Portfolios] Error fetching holdings:', error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

/**
 * GET /api/portfolios/:id/transactions
 * Get all transactions for a portfolio
 */
router.get('/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE portfolio_id = ?
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `).all(id, parseInt(limit), parseInt(offset));

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE portfolio_id = ?
    `).get(id);

    res.json({
      transactions,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[Portfolios] Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * Helper function to create default portfolio for a user
 */
export function createDefaultPortfolio(userId) {
  try {
    const result = db.prepare(`
      INSERT INTO portfolios (user_id, name, description, cash_balance, is_paper_trading, is_default)
      VALUES (?, 'My Portfolio', 'Default portfolio', 0, 0, 1)
    `).run(userId);

    return result.lastInsertRowid;
  } catch (error) {
    console.error('[Portfolios] Error creating default portfolio:', error);
    throw error;
  }
}

export default router;
