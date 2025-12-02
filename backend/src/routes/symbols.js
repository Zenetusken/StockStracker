import express from 'express';
import symbolService from '../services/symbols.js';

const router = express.Router();

/**
 * GET /api/symbols/status
 * Get symbol database status and sync info
 */
router.get('/status', async (req, res) => {
  try {
    const totalCount = symbolService.getCount();
    const countsByType = symbolService.getCountsByType();
    const syncInfo = symbolService.getSyncInfo();
    const hasSyncedData = symbolService.hasSyncedData();

    res.json({
      hasSyncedData,
      totalCount,
      countsByType,
      syncInfo,
    });
  } catch (error) {
    console.error('Error getting symbol status:', error);
    res.status(500).json({ error: 'Failed to get symbol status' });
  }
});

/**
 * POST /api/symbols/sync
 * Trigger a symbol sync from Finnhub API
 * Query params:
 *   - exchange: Exchange code (default: 'US')
 *   - refresh: If 'true', clear existing data before sync
 */
router.post('/sync', async (req, res) => {
  try {
    const { exchange = 'US', refresh } = req.query;
    const shouldRefresh = refresh === 'true' || refresh === '1';

    console.log(`[Symbols API] Starting sync for ${exchange}, refresh=${shouldRefresh}`);

    let result;
    if (shouldRefresh) {
      result = await symbolService.refreshSync();
    } else {
      result = await symbolService.syncExchange(exchange);
    }

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        exchange: result.exchange,
        symbolCount: result.symbolCount,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        exchange: result.exchange,
      });
    }
  } catch (error) {
    console.error('Error syncing symbols:', error);
    res.status(500).json({ error: 'Failed to sync symbols' });
  }
});

/**
 * GET /api/symbols/lookup/:symbol
 * Look up a specific symbol
 */
router.get('/lookup/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = symbolService.getBySymbol(symbol.toUpperCase());

    if (result) {
      res.json({
        found: true,
        symbol: result,
        source: 'local',
      });
    } else {
      res.json({
        found: false,
        symbol: null,
        source: 'local',
        message: 'Symbol not found in local database. Try syncing first.',
      });
    }
  } catch (error) {
    console.error('Error looking up symbol:', error);
    res.status(500).json({ error: 'Failed to look up symbol' });
  }
});

/**
 * POST /api/symbols/rebuild-fts
 * Rebuild the FTS5 full-text search index
 * Use this if the FTS index gets out of sync with the main symbols table
 */
router.post('/rebuild-fts', async (req, res) => {
  try {
    console.log('[Symbols API] Rebuilding FTS index...');
    const count = symbolService.rebuildFTSIndex();

    res.json({
      success: true,
      message: `FTS index rebuilt with ${count} entries`,
      indexedCount: count,
    });
  } catch (error) {
    console.error('Error rebuilding FTS index:', error);
    res.status(500).json({ error: 'Failed to rebuild FTS index' });
  }
});

export default router;
