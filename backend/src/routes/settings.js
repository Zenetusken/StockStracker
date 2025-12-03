import express from 'express';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import {
  logSecurityEvent,
  SecurityEventType,
  getClientIp,
} from '../services/securityLogger.js';

const router = express.Router();

/**
 * GET /api/settings
 * Get user preferences (#123)
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;

    const preferences = db.prepare(`
      SELECT theme, default_chart_type, default_timeframe,
             decimal_places, notifications_enabled
      FROM user_preferences
      WHERE user_id = ?
    `).get(userId);

    if (!preferences) {
      // Create default preferences if missing
      db.prepare(`
        INSERT INTO user_preferences (user_id)
        VALUES (?)
      `).run(userId);

      return res.json({
        theme: 'system',
        defaultChartType: 'candle',
        defaultTimeframe: '1D',
        decimalPlaces: 2,
        notificationsEnabled: true,
      });
    }

    res.json({
      theme: preferences.theme,
      defaultChartType: preferences.default_chart_type,
      defaultTimeframe: preferences.default_timeframe,
      decimalPlaces: preferences.decimal_places,
      notificationsEnabled: preferences.notifications_enabled === 1,
    });
  } catch (error) {
    console.error('[Settings] Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/settings
 * Update user preferences (#123)
 */
router.put('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      theme,
      defaultChartType,
      defaultTimeframe,
      decimalPlaces,
      notificationsEnabled,
    } = req.body;

    // Validate inputs
    const validThemes = ['light', 'dark', 'system'];
    const validChartTypes = ['candle', 'line', 'area'];
    const validTimeframes = ['1D', '1W', '1M', '3M', '1Y', '5Y', 'MAX'];

    if (theme && !validThemes.includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    if (defaultChartType && !validChartTypes.includes(defaultChartType)) {
      return res.status(400).json({ error: 'Invalid chart type' });
    }
    if (defaultTimeframe && !validTimeframes.includes(defaultTimeframe)) {
      return res.status(400).json({ error: 'Invalid timeframe' });
    }
    if (decimalPlaces !== undefined && (decimalPlaces < 0 || decimalPlaces > 8)) {
      return res.status(400).json({ error: 'Decimal places must be 0-8' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (theme !== undefined) {
      updates.push('theme = ?');
      values.push(theme);
    }
    if (defaultChartType !== undefined) {
      updates.push('default_chart_type = ?');
      values.push(defaultChartType);
    }
    if (defaultTimeframe !== undefined) {
      updates.push('default_timeframe = ?');
      values.push(defaultTimeframe);
    }
    if (decimalPlaces !== undefined) {
      updates.push('decimal_places = ?');
      values.push(decimalPlaces);
    }
    if (notificationsEnabled !== undefined) {
      updates.push('notifications_enabled = ?');
      values.push(notificationsEnabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const sql = `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`;
    const result = db.prepare(sql).run(...values);

    if (result.changes === 0) {
      // Try inserting if no row exists
      db.prepare(`
        INSERT INTO user_preferences (user_id, theme, default_chart_type, default_timeframe, decimal_places, notifications_enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        theme || 'system',
        defaultChartType || 'candle',
        defaultTimeframe || '1D',
        decimalPlaces ?? 2,
        notificationsEnabled !== false ? 1 : 0
      );
    }

    console.log(`[Settings] Updated preferences for user ${userId}`);

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('[Settings] Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * GET /api/settings/export
 * Export all user data as JSON backup (#125)
 */
router.get('/export', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;

    // Get user info (without sensitive data)
    const user = db.prepare(`
      SELECT id, email, name, created_at
      FROM users WHERE id = ?
    `).get(userId);

    // Get preferences
    const preferences = db.prepare(`
      SELECT theme, default_chart_type, default_timeframe, decimal_places, notifications_enabled
      FROM user_preferences WHERE user_id = ?
    `).get(userId);

    // Get watchlists with items
    const watchlists = db.prepare(`
      SELECT id, name, color, icon, position, is_default, created_at
      FROM watchlists WHERE user_id = ?
    `).all(userId);

    for (const watchlist of watchlists) {
      watchlist.items = db.prepare(`
        SELECT symbol, added_at FROM watchlist_items WHERE watchlist_id = ?
      `).all(watchlist.id);
    }

    // Get portfolios with holdings and transactions
    const portfolios = db.prepare(`
      SELECT id, name, description, cash_balance, is_default, is_paper, created_at
      FROM portfolios WHERE user_id = ?
    `).all(userId);

    for (const portfolio of portfolios) {
      portfolio.holdings = db.prepare(`
        SELECT symbol, total_shares, average_cost
        FROM portfolio_holdings WHERE portfolio_id = ?
      `).all(portfolio.id);

      portfolio.transactions = db.prepare(`
        SELECT type, symbol, shares, price, fees, notes, executed_at
        FROM transactions WHERE portfolio_id = ?
        ORDER BY executed_at DESC
      `).all(portfolio.id);
    }

    // Get alerts
    const alerts = db.prepare(`
      SELECT symbol, alert_type, threshold, is_active, created_at
      FROM alerts WHERE user_id = ?
    `).all(userId);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
      },
      preferences,
      watchlists,
      portfolios,
      alerts,
    };

    logSecurityEvent(SecurityEventType.DATA_EXPORTED, {
      userId,
      userEmail: user.email,
      ipAddress: getClientIp(req),
      details: {
        watchlistCount: watchlists.length,
        portfolioCount: portfolios.length,
        alertCount: alerts.length,
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=stocktracker-backup-${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('[Settings] Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * POST /api/settings/import
 * Import user data from JSON backup (#126)
 */
router.post('/import', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const { data, options } = req.body;

    if (!data || !data.version) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const importOptions = {
      watchlists: options?.watchlists !== false,
      portfolios: options?.portfolios !== false,
      alerts: options?.alerts !== false,
      preferences: options?.preferences !== false,
      mergeMode: options?.mergeMode || 'merge', // 'merge' or 'replace'
    };

    const stats = {
      watchlistsImported: 0,
      portfoliosImported: 0,
      alertsImported: 0,
      preferencesUpdated: false,
    };

    // Import within a transaction
    db.exec('BEGIN TRANSACTION');

    try {
      // Import preferences
      if (importOptions.preferences && data.preferences) {
        db.prepare(`
          UPDATE user_preferences
          SET theme = ?, default_chart_type = ?, default_timeframe = ?,
              decimal_places = ?, notifications_enabled = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          data.preferences.theme || 'system',
          data.preferences.default_chart_type || 'candle',
          data.preferences.default_timeframe || '1D',
          data.preferences.decimal_places ?? 2,
          data.preferences.notifications_enabled ?? 1,
          userId
        );
        stats.preferencesUpdated = true;
      }

      // Import watchlists
      if (importOptions.watchlists && data.watchlists) {
        for (const watchlist of data.watchlists) {
          // Check if watchlist with same name exists
          const existing = db.prepare(`
            SELECT id FROM watchlists WHERE user_id = ? AND name = ?
          `).get(userId, watchlist.name);

          let watchlistId;
          if (existing && importOptions.mergeMode === 'merge') {
            watchlistId = existing.id;
          } else {
            const result = db.prepare(`
              INSERT INTO watchlists (user_id, name, color, icon, position, is_default)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, watchlist.name, watchlist.color || '#3B82F6', watchlist.icon || 'star', watchlist.position || 0, 0);
            watchlistId = result.lastInsertRowid;
            stats.watchlistsImported++;
          }

          // Import items
          if (watchlist.items) {
            for (const item of watchlist.items) {
              const existingItem = db.prepare(`
                SELECT id FROM watchlist_items WHERE watchlist_id = ? AND symbol = ?
              `).get(watchlistId, item.symbol);

              if (!existingItem) {
                db.prepare(`
                  INSERT INTO watchlist_items (watchlist_id, symbol)
                  VALUES (?, ?)
                `).run(watchlistId, item.symbol);
              }
            }
          }
        }
      }

      // Import portfolios
      if (importOptions.portfolios && data.portfolios) {
        for (const portfolio of data.portfolios) {
          // Check if portfolio with same name exists
          const existing = db.prepare(`
            SELECT id FROM portfolios WHERE user_id = ? AND name = ?
          `).get(userId, portfolio.name);

          let portfolioId;
          if (existing && importOptions.mergeMode === 'merge') {
            portfolioId = existing.id;
          } else {
            const result = db.prepare(`
              INSERT INTO portfolios (user_id, name, description, cash_balance, is_paper)
              VALUES (?, ?, ?, ?, ?)
            `).run(userId, portfolio.name, portfolio.description || '', portfolio.cash_balance || 0, portfolio.is_paper || 0);
            portfolioId = result.lastInsertRowid;
            stats.portfoliosImported++;
          }

          // Note: Transactions and holdings are complex - we only import new portfolios
          // to avoid data inconsistencies
        }
      }

      // Import alerts
      if (importOptions.alerts && data.alerts) {
        for (const alert of data.alerts) {
          const existing = db.prepare(`
            SELECT id FROM alerts WHERE user_id = ? AND symbol = ? AND alert_type = ? AND threshold = ?
          `).get(userId, alert.symbol, alert.alert_type, alert.threshold);

          if (!existing) {
            db.prepare(`
              INSERT INTO alerts (user_id, symbol, alert_type, threshold, is_active)
              VALUES (?, ?, ?, ?, ?)
            `).run(userId, alert.symbol, alert.alert_type, alert.threshold, alert.is_active ?? 1);
            stats.alertsImported++;
          }
        }
      }

      db.exec('COMMIT');

      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);

      logSecurityEvent(SecurityEventType.DATA_IMPORTED, {
        userId,
        userEmail: user.email,
        ipAddress: getClientIp(req),
        details: stats,
      });

      console.log(`[Settings] Import completed for user ${userId}:`, stats);

      res.json({
        message: 'Data imported successfully',
        stats,
      });
    } catch (importError) {
      db.exec('ROLLBACK');
      throw importError;
    }
  } catch (error) {
    console.error('[Settings] Import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

/**
 * DELETE /api/settings/account
 * Delete user account and all data (#127)
 */
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Please type DELETE to confirm account deletion',
      });
    }

    // Verify password
    const user = db.prepare('SELECT email, password_hash FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Delete all user data in a transaction
    db.exec('BEGIN TRANSACTION');

    try {
      // Delete watchlist items
      db.prepare(`
        DELETE FROM watchlist_items
        WHERE watchlist_id IN (SELECT id FROM watchlists WHERE user_id = ?)
      `).run(userId);

      // Delete watchlists
      db.prepare('DELETE FROM watchlists WHERE user_id = ?').run(userId);

      // Delete lot_sales
      db.prepare(`
        DELETE FROM lot_sales
        WHERE tax_lot_id IN (
          SELECT tl.id FROM tax_lots tl
          JOIN portfolios p ON tl.portfolio_id = p.id
          WHERE p.user_id = ?
        )
      `).run(userId);

      // Delete tax_lots
      db.prepare(`
        DELETE FROM tax_lots
        WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ?)
      `).run(userId);

      // Delete transactions
      db.prepare(`
        DELETE FROM transactions
        WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ?)
      `).run(userId);

      // Delete holdings
      db.prepare(`
        DELETE FROM portfolio_holdings
        WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ?)
      `).run(userId);

      // Delete portfolios
      db.prepare('DELETE FROM portfolios WHERE user_id = ?').run(userId);

      // Delete alerts
      db.prepare('DELETE FROM alerts WHERE user_id = ?').run(userId);

      // Delete preferences
      db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);

      // Delete user
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      db.exec('COMMIT');

      logSecurityEvent(SecurityEventType.ACCOUNT_DELETED, {
        userId,
        userEmail: user.email,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });

      console.log(`[Settings] Account deleted for user ${userId}`);

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('[Settings] Session destroy error:', err);
        }
        res.clearCookie('stocktracker.sid');
        res.json({ message: 'Account deleted successfully' });
      });
    } catch (deleteError) {
      db.exec('ROLLBACK');
      throw deleteError;
    }
  } catch (error) {
    console.error('[Settings] Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
