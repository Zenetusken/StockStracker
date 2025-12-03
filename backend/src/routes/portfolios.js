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
 * GET /api/portfolios/:id/holdings/:symbol/tax-lots
 * Get tax lots for a specific holding
 */
router.get('/:id/holdings/:symbol/tax-lots', (req, res) => {
  try {
    const { id, symbol } = req.params;

    // Verify ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const taxLots = db.prepare(`
      SELECT tl.*, t.executed_at as purchase_date, t.notes
      FROM tax_lots tl
      LEFT JOIN transactions t ON tl.transaction_id = t.id
      WHERE tl.portfolio_id = ? AND tl.symbol = ?
      ORDER BY tl.purchase_date ASC
    `).all(id, symbol.toUpperCase());

    res.json(taxLots);
  } catch (error) {
    console.error('[Portfolios] Error fetching tax lots:', error);
    res.status(500).json({ error: 'Failed to fetch tax lots' });
  }
});

/**
 * GET /api/portfolios/:id/value-history
 * Get portfolio value history over time for charting
 */
router.get('/:id/value-history', (req, res) => {
  try {
    const { id } = req.params;
    const { period = '1M' } = req.query; // 1W, 1M, 3M, 6M, 1Y, ALL

    // Verify ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get all transactions ordered by date
    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE portfolio_id = ?
      ORDER BY executed_at ASC
    `).all(id);

    // Calculate value history based on transactions
    // This is a simplified approach that tracks cash + cost basis over time
    const history = [];
    let runningCash = portfolio.cash_balance;
    let holdingsValue = 0;

    // Get current holdings and their values
    const holdings = db.prepare(`
      SELECT * FROM portfolio_holdings WHERE portfolio_id = ?
    `).all(id);

    // Calculate current total cost basis
    const totalCostBasis = holdings.reduce((sum, h) => sum + (h.total_shares * h.average_cost), 0);

    // Determine date range based on period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '1W': startDate.setDate(now.getDate() - 7); break;
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case 'ALL': startDate = new Date(0); break;
      default: startDate.setMonth(now.getMonth() - 1);
    }

    // Group transactions by date and calculate cumulative value
    const txByDate = {};
    let cumulativeCash = 0;
    let cumulativeHoldings = {};

    transactions.forEach(tx => {
      const date = tx.executed_at.split('T')[0];
      if (!txByDate[date]) {
        txByDate[date] = { cash: 0, holdings: {} };
      }

      const txValue = tx.shares * tx.price;
      if (tx.type === 'buy') {
        txByDate[date].cash -= txValue;
        txByDate[date].holdings[tx.symbol] = (txByDate[date].holdings[tx.symbol] || 0) + tx.shares;
      } else if (tx.type === 'sell') {
        txByDate[date].cash += txValue;
        txByDate[date].holdings[tx.symbol] = (txByDate[date].holdings[tx.symbol] || 0) - tx.shares;
      } else if (tx.type === 'dividend') {
        txByDate[date].cash += txValue;
      }
    });

    // Build daily value series
    const dates = Object.keys(txByDate).sort();

    if (dates.length === 0) {
      // No transactions - return current value as single point
      history.push({
        time: now.toISOString().split('T')[0],
        value: portfolio.cash_balance
      });
    } else {
      // Track cumulative state
      let runningCashBalance = portfolio.cash_balance;
      let runningHoldingsValue = 0;

      // Work backwards from current state
      // For simplicity, show value at each transaction date
      const sortedDates = dates.filter(d => new Date(d) >= startDate);

      // Add transaction dates with estimated value
      sortedDates.forEach(date => {
        const dayTx = txByDate[date];
        // Estimate value change based on transaction (this is simplified)
        history.push({
          time: date,
          value: runningCashBalance + totalCostBasis // Simplified: use current cost basis
        });
      });

      // Add current date
      const today = now.toISOString().split('T')[0];
      if (!sortedDates.includes(today)) {
        history.push({
          time: today,
          value: portfolio.cash_balance + totalCostBasis
        });
      }
    }

    // Sort by date
    history.sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({
      history,
      period,
      currentValue: portfolio.cash_balance + totalCostBasis
    });
  } catch (error) {
    console.error('[Portfolios] Error fetching value history:', error);
    res.status(500).json({ error: 'Failed to fetch value history' });
  }
});

/**
 * GET /api/portfolios/:id/lot-sales
 * Get all realized gains (lot sales) for a portfolio with short-term/long-term classification
 */
router.get('/:id/lot-sales', (req, res) => {
  try {
    const { id } = req.params;
    const { year, symbol } = req.query;

    // Verify ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Build query with optional filters
    let query = `
      SELECT
        ls.*,
        tl.symbol,
        tl.cost_per_share,
        tl.purchase_date as lot_purchase_date,
        t.executed_at as sale_executed_at,
        t.notes as sale_notes
      FROM lot_sales ls
      JOIN tax_lots tl ON ls.tax_lot_id = tl.id
      JOIN transactions t ON ls.sell_transaction_id = t.id
      WHERE tl.portfolio_id = ?
    `;
    const params = [id];

    // Filter by year if provided
    if (year) {
      query += ` AND strftime('%Y', ls.sale_date) = ?`;
      params.push(year);
    }

    // Filter by symbol if provided
    if (symbol) {
      query += ` AND tl.symbol = ?`;
      params.push(symbol.toUpperCase());
    }

    query += ` ORDER BY ls.sale_date DESC, tl.symbol ASC`;

    const lotSales = db.prepare(query).all(...params);

    // Calculate summary statistics
    const summary = {
      totalRealizedGain: 0,
      shortTermGain: 0,
      longTermGain: 0,
      shortTermLoss: 0,
      longTermLoss: 0,
      totalShortTerm: 0,
      totalLongTerm: 0
    };

    lotSales.forEach(sale => {
      summary.totalRealizedGain += sale.realized_gain;
      if (sale.is_short_term) {
        summary.totalShortTerm += sale.realized_gain;
        if (sale.realized_gain >= 0) {
          summary.shortTermGain += sale.realized_gain;
        } else {
          summary.shortTermLoss += sale.realized_gain;
        }
      } else {
        summary.totalLongTerm += sale.realized_gain;
        if (sale.realized_gain >= 0) {
          summary.longTermGain += sale.realized_gain;
        } else {
          summary.longTermLoss += sale.realized_gain;
        }
      }
    });

    res.json({
      lotSales,
      summary,
      filters: { year, symbol }
    });
  } catch (error) {
    console.error('[Portfolios] Error fetching lot sales:', error);
    res.status(500).json({ error: 'Failed to fetch lot sales' });
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
 * POST /api/portfolios/:id/transactions
 * Add a transaction to a portfolio (buy, sell, dividend, split)
 */
router.post('/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, type, shares, price, fees = 0, notes, executed_at } = req.body;

    // Validation
    if (!symbol || !type || !shares || !price) {
      return res.status(400).json({ error: 'Symbol, type, shares, and price are required' });
    }

    if (!['buy', 'sell', 'dividend', 'split'].includes(type)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    if (shares <= 0) {
      return res.status(400).json({ error: 'Shares must be greater than 0' });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    // Verify portfolio ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const upperSymbol = symbol.toUpperCase().trim();
    const execDate = executed_at || new Date().toISOString();
    const totalCost = (shares * price) + (fees || 0);

    // For buy transactions, check if sufficient cash
    if (type === 'buy' && portfolio.cash_balance < totalCost) {
      return res.status(400).json({
        error: 'Insufficient cash balance',
        required: totalCost,
        available: portfolio.cash_balance
      });
    }

    // For sell transactions, check if sufficient shares
    if (type === 'sell') {
      const holding = db.prepare(`
        SELECT * FROM portfolio_holdings
        WHERE portfolio_id = ? AND symbol = ?
      `).get(id, upperSymbol);

      if (!holding || holding.total_shares < shares) {
        return res.status(400).json({
          error: 'Insufficient shares',
          required: shares,
          available: holding?.total_shares || 0
        });
      }
    }

    // Create transaction record
    const txResult = db.prepare(`
      INSERT INTO transactions (portfolio_id, symbol, type, shares, price, fees, notes, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, upperSymbol, type, shares, price, fees || 0, notes || null, execDate);

    const transactionId = txResult.lastInsertRowid;

    // Update holdings and cash based on transaction type
    if (type === 'buy') {
      // Check if holding exists
      const existingHolding = db.prepare(`
        SELECT * FROM portfolio_holdings
        WHERE portfolio_id = ? AND symbol = ?
      `).get(id, upperSymbol);

      if (existingHolding) {
        // Update existing holding with weighted average cost
        const newTotalShares = existingHolding.total_shares + shares;
        const newTotalCost = (existingHolding.total_shares * existingHolding.average_cost) + (shares * price);
        const newAverageCost = newTotalCost / newTotalShares;

        db.prepare(`
          UPDATE portfolio_holdings
          SET total_shares = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newTotalShares, newAverageCost, existingHolding.id);
      } else {
        // Create new holding
        db.prepare(`
          INSERT INTO portfolio_holdings (portfolio_id, symbol, total_shares, average_cost, first_purchase_date)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, upperSymbol, shares, price, execDate.split('T')[0]);
      }

      // Create tax lot
      db.prepare(`
        INSERT INTO tax_lots (portfolio_id, symbol, purchase_date, shares_remaining, cost_per_share, transaction_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, upperSymbol, execDate.split('T')[0], shares, price, transactionId);

      // Decrease cash balance
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(totalCost, id);

    } else if (type === 'sell') {
      // Update holding
      const existingHolding = db.prepare(`
        SELECT * FROM portfolio_holdings
        WHERE portfolio_id = ? AND symbol = ?
      `).get(id, upperSymbol);

      const newTotalShares = existingHolding.total_shares - shares;

      if (newTotalShares <= 0) {
        // Remove holding entirely
        db.prepare(`DELETE FROM portfolio_holdings WHERE id = ?`).run(existingHolding.id);
      } else {
        // Update shares (average cost stays the same)
        db.prepare(`
          UPDATE portfolio_holdings
          SET total_shares = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newTotalShares, existingHolding.id);
      }

      // FIFO lot sales - sell from oldest lots first
      let sharesToSell = shares;
      const lots = db.prepare(`
        SELECT * FROM tax_lots
        WHERE portfolio_id = ? AND symbol = ? AND shares_remaining > 0
        ORDER BY purchase_date ASC
      `).all(id, upperSymbol);

      for (const lot of lots) {
        if (sharesToSell <= 0) break;

        const sellFromLot = Math.min(lot.shares_remaining, sharesToSell);
        const realizedGain = sellFromLot * (price - lot.cost_per_share);
        const purchaseDate = new Date(lot.purchase_date);
        const saleDate = new Date(execDate);
        const holdingDays = (saleDate - purchaseDate) / (1000 * 60 * 60 * 24);
        const isShortTerm = holdingDays < 365 ? 1 : 0;

        // Record lot sale
        db.prepare(`
          INSERT INTO lot_sales (tax_lot_id, sell_transaction_id, shares_sold, sale_price, realized_gain, is_short_term, sale_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(lot.id, transactionId, sellFromLot, price, realizedGain, isShortTerm, execDate.split('T')[0]);

        // Update lot
        const newRemaining = lot.shares_remaining - sellFromLot;
        db.prepare(`
          UPDATE tax_lots
          SET shares_remaining = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newRemaining, lot.id);

        sharesToSell -= sellFromLot;
      }

      // Increase cash balance (minus fees)
      const saleProceeds = (shares * price) - (fees || 0);
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(saleProceeds, id);

    } else if (type === 'dividend') {
      // Dividend: price = dividend per share, shares = number of shares
      // Total dividend = shares * price
      const dividendAmount = shares * price;
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(dividendAmount, id);

    } else if (type === 'split') {
      // Stock split: shares = new ratio numerator, price = old ratio denominator
      // e.g., 2:1 split means shares=2, price=1, ratio=2 (shares double, cost halves)
      // e.g., 1:2 reverse split means shares=1, price=2, ratio=0.5 (shares halve, cost doubles)
      const splitRatio = shares / price;

      const existingHolding = db.prepare(`
        SELECT * FROM portfolio_holdings
        WHERE portfolio_id = ? AND symbol = ?
      `).get(id, upperSymbol);

      if (existingHolding) {
        const newTotalShares = existingHolding.total_shares * splitRatio;
        const newAverageCost = existingHolding.average_cost / splitRatio;

        db.prepare(`
          UPDATE portfolio_holdings
          SET total_shares = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newTotalShares, newAverageCost, existingHolding.id);

        // Update all tax lots for this symbol
        db.prepare(`
          UPDATE tax_lots
          SET shares_remaining = shares_remaining * ?,
              cost_per_share = cost_per_share / ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE portfolio_id = ? AND symbol = ? AND shares_remaining > 0
        `).run(splitRatio, splitRatio, id, upperSymbol);
      }
    }

    // Fetch the created transaction
    const transaction = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(transactionId);

    // Fetch updated holding
    const updatedHolding = db.prepare(`
      SELECT * FROM portfolio_holdings
      WHERE portfolio_id = ? AND symbol = ?
    `).get(id, upperSymbol);

    // Fetch updated portfolio
    const updatedPortfolio = db.prepare(`SELECT * FROM portfolios WHERE id = ?`).get(id);

    res.status(201).json({
      transaction,
      holding: updatedHolding,
      portfolio: {
        id: updatedPortfolio.id,
        cash_balance: updatedPortfolio.cash_balance
      }
    });
  } catch (error) {
    console.error('[Portfolios] Error adding transaction:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

/**
 * PUT /api/portfolios/:id/transactions/:txId
 * Edit an existing transaction (updates holdings and tax lots)
 */
router.put('/:id/transactions/:txId', (req, res) => {
  try {
    const { id, txId } = req.params;
    const { price, shares, fees, notes } = req.body;

    // Verify portfolio ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get the existing transaction
    const existingTx = db.prepare(`
      SELECT * FROM transactions
      WHERE id = ? AND portfolio_id = ?
    `).get(txId, id);

    if (!existingTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const newPrice = price !== undefined ? price : existingTx.price;
    const newShares = shares !== undefined ? shares : existingTx.shares;
    const newFees = fees !== undefined ? fees : existingTx.fees;
    const newNotes = notes !== undefined ? notes : existingTx.notes;

    // Update the transaction
    db.prepare(`
      UPDATE transactions
      SET price = ?, shares = ?, fees = ?, notes = ?
      WHERE id = ?
    `).run(newPrice, newShares, newFees, newNotes, txId);

    // Recalculate holdings for this symbol (simplified: recalculate average cost from all buy transactions)
    if (existingTx.type === 'buy') {
      // Get all buy transactions for this symbol
      const buyTxs = db.prepare(`
        SELECT * FROM transactions
        WHERE portfolio_id = ? AND symbol = ? AND type = 'buy'
        ORDER BY executed_at ASC
      `).all(id, existingTx.symbol);

      // Calculate total shares and weighted average cost
      let totalShares = 0;
      let totalCost = 0;
      for (const tx of buyTxs) {
        totalShares += tx.shares;
        totalCost += tx.shares * tx.price;
      }

      // Get sell transactions to subtract shares sold
      const sellTxs = db.prepare(`
        SELECT COALESCE(SUM(shares), 0) as sold FROM transactions
        WHERE portfolio_id = ? AND symbol = ? AND type = 'sell'
      `).get(id, existingTx.symbol);

      const remainingShares = totalShares - (sellTxs?.sold || 0);
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

      // Update holdings
      if (remainingShares > 0) {
        db.prepare(`
          UPDATE portfolio_holdings
          SET total_shares = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP
          WHERE portfolio_id = ? AND symbol = ?
        `).run(remainingShares, avgCost, id, existingTx.symbol);
      }

      // Update tax lots for this transaction
      db.prepare(`
        UPDATE tax_lots
        SET cost_per_share = ?, shares_remaining = ?, updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(newPrice, newShares, txId);
    } else if (existingTx.type === 'sell') {
      // Sell transaction edit: recalculate lot_sales and holdings

      // Get old lot_sales to restore shares to tax lots
      const oldLotSales = db.prepare(`
        SELECT * FROM lot_sales WHERE sell_transaction_id = ?
      `).all(txId);

      // Restore shares to tax lots that were previously sold
      for (const sale of oldLotSales) {
        db.prepare(`
          UPDATE tax_lots SET shares_remaining = shares_remaining + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(sale.shares_sold, sale.tax_lot_id);
      }

      // Delete old lot_sales
      db.prepare(`DELETE FROM lot_sales WHERE sell_transaction_id = ?`).run(txId);

      // Re-apply FIFO sell with updated shares/price
      const lots = db.prepare(`
        SELECT * FROM tax_lots
        WHERE portfolio_id = ? AND symbol = ? AND shares_remaining > 0
        ORDER BY purchase_date ASC
      `).all(id, existingTx.symbol);

      let sharesToSell = newShares;
      for (const lot of lots) {
        if (sharesToSell <= 0) break;
        const sellFromLot = Math.min(sharesToSell, lot.shares_remaining);
        const realizedGain = sellFromLot * (newPrice - lot.cost_per_share);
        const purchaseDate = new Date(lot.purchase_date);
        const saleDate = new Date(existingTx.executed_at);
        const holdingDays = (saleDate - purchaseDate) / (1000 * 60 * 60 * 24);
        const isShortTerm = holdingDays < 365 ? 1 : 0;

        // Record new lot sale with updated price
        db.prepare(`
          INSERT INTO lot_sales (tax_lot_id, sell_transaction_id, shares_sold, sale_price, realized_gain, is_short_term, sale_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(lot.id, txId, sellFromLot, newPrice, realizedGain, isShortTerm, existingTx.executed_at.split('T')[0]);

        // Update lot shares remaining
        db.prepare(`
          UPDATE tax_lots SET shares_remaining = shares_remaining - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(sellFromLot, lot.id);

        sharesToSell -= sellFromLot;
      }

      // Recalculate holdings from tax lots
      const remainingSharesResult = db.prepare(`
        SELECT COALESCE(SUM(shares_remaining), 0) as remaining FROM tax_lots
        WHERE portfolio_id = ? AND symbol = ?
      `).get(id, existingTx.symbol);

      if (remainingSharesResult.remaining > 0) {
        db.prepare(`
          UPDATE portfolio_holdings SET total_shares = ?, updated_at = CURRENT_TIMESTAMP
          WHERE portfolio_id = ? AND symbol = ?
        `).run(remainingSharesResult.remaining, id, existingTx.symbol);
      } else {
        db.prepare(`
          DELETE FROM portfolio_holdings WHERE portfolio_id = ? AND symbol = ?
        `).run(id, existingTx.symbol);
      }
    }

    // Fetch updated transaction
    const updatedTx = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(txId);

    // Fetch updated holding
    const updatedHolding = db.prepare(`
      SELECT * FROM portfolio_holdings
      WHERE portfolio_id = ? AND symbol = ?
    `).get(id, existingTx.symbol);

    res.json({
      transaction: updatedTx,
      holding: updatedHolding
    });
  } catch (error) {
    console.error('[Portfolios] Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

/**
 * DELETE /api/portfolios/:id/transactions/:txId
 * Delete a transaction and recalculate holdings
 */
router.delete('/:id/transactions/:txId', (req, res) => {
  try {
    const { id, txId } = req.params;

    // Verify portfolio ownership
    const portfolio = db.prepare(`
      SELECT * FROM portfolios
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Get the transaction to delete
    const transaction = db.prepare(`
      SELECT * FROM transactions
      WHERE id = ? AND portfolio_id = ?
    `).get(txId, id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get tax lot IDs for this transaction to delete lot_sales first
    const taxLotIds = db.prepare(`SELECT id FROM tax_lots WHERE transaction_id = ?`).all(txId);

    // Delete lot_sales that reference these tax lots (foreign key constraint)
    for (const lot of taxLotIds) {
      db.prepare(`DELETE FROM lot_sales WHERE tax_lot_id = ?`).run(lot.id);
    }

    // Delete lot_sales that reference this transaction as sell_transaction_id
    db.prepare(`DELETE FROM lot_sales WHERE sell_transaction_id = ?`).run(txId);

    // Delete any tax lots that reference this transaction
    db.prepare(`DELETE FROM tax_lots WHERE transaction_id = ?`).run(txId);

    // Delete the transaction
    db.prepare(`DELETE FROM transactions WHERE id = ?`).run(txId);

    // Recalculate holdings for this symbol
    if (transaction.type === 'buy' || transaction.type === 'sell') {
      // Get all remaining buy transactions
      const buyTxs = db.prepare(`
        SELECT * FROM transactions
        WHERE portfolio_id = ? AND symbol = ? AND type = 'buy'
      `).all(id, transaction.symbol);

      // Get all sell transactions
      const sellResult = db.prepare(`
        SELECT COALESCE(SUM(shares), 0) as sold FROM transactions
        WHERE portfolio_id = ? AND symbol = ? AND type = 'sell'
      `).get(id, transaction.symbol);

      // Calculate totals
      let totalShares = 0;
      let totalCost = 0;
      for (const tx of buyTxs) {
        totalShares += tx.shares;
        totalCost += tx.shares * tx.price;
      }

      const remainingShares = totalShares - (sellResult?.sold || 0);
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

      if (remainingShares > 0) {
        // Update holdings
        db.prepare(`
          UPDATE portfolio_holdings
          SET total_shares = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP
          WHERE portfolio_id = ? AND symbol = ?
        `).run(remainingShares, avgCost, id, transaction.symbol);
      } else {
        // Delete holdings if no shares remain
        db.prepare(`
          DELETE FROM portfolio_holdings
          WHERE portfolio_id = ? AND symbol = ?
        `).run(id, transaction.symbol);
      }

      // Delete tax lots for this symbol and recreate based on remaining transactions
      // First, delete all lot_sales that reference these tax_lots (foreign key constraint)
      const allSymbolTaxLots = db.prepare(`SELECT id FROM tax_lots WHERE portfolio_id = ? AND symbol = ?`).all(id, transaction.symbol);
      for (const lot of allSymbolTaxLots) {
        db.prepare(`DELETE FROM lot_sales WHERE tax_lot_id = ?`).run(lot.id);
      }
      db.prepare(`DELETE FROM tax_lots WHERE portfolio_id = ? AND symbol = ?`).run(id, transaction.symbol);

      // Recreate tax lots from buy transactions
      for (const tx of buyTxs) {
        db.prepare(`
          INSERT INTO tax_lots (portfolio_id, symbol, purchase_date, shares_remaining, cost_per_share, transaction_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, transaction.symbol, tx.executed_at, tx.shares, tx.price, tx.id);
      }
    }

    // If it was a dividend, reverse the cash addition
    if (transaction.type === 'dividend') {
      const dividendAmount = transaction.shares * transaction.price;
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(dividendAmount, id);
    }

    // If it was a buy/sell, reverse the cash impact
    if (transaction.type === 'buy') {
      const buyAmount = (transaction.shares * transaction.price) + (transaction.fees || 0);
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(buyAmount, id);
    } else if (transaction.type === 'sell') {
      const sellAmount = (transaction.shares * transaction.price) - (transaction.fees || 0);
      db.prepare(`
        UPDATE portfolios
        SET cash_balance = cash_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sellAmount, id);
    }

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    console.error('[Portfolios] Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
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
