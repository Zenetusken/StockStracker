import express from 'express';
import finnhubService from '../services/finnhub.js';
import yahooFinanceService from '../services/yahoo.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Store active connections
const connections = new Map();

/**
 * Check if US stock market is currently open
 * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
 */
function isMarketOpen() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();

  // Closed on weekends (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM - 4:00 PM ET
  const timeInMinutes = hour * 60 + minute;
  return timeInMinutes >= 570 && timeInMinutes < 960; // 9:30=570, 16:00=960
}

/**
 * Get polling interval based on market hours
 * - 10 seconds during market hours (need real-time updates)
 * - 60 seconds after hours (prices don't change as often)
 */
function getPollInterval() {
  return isMarketOpen() ? 10000 : 60000;
}

// L1: Configurable allowed origins for SSE CORS
// Set CORS_ORIGINS env var with comma-separated list for production
// Default: 'http://localhost:5173' for development
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

// CORS middleware for SSE - must run BEFORE any response
const sseCorsMw = (req, res, next) => {
  const origin = req.headers.origin;

  // Only set CORS header if origin is in allowlist
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow no-origin requests in development only (for curl/Postman testing)
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    // In production, no-origin requests get no CORS header (blocked)
  }
  // Disallowed origins also get no CORS header (blocked by browser)

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
};

// Apply CORS to all routes in this router
router.use(sseCorsMw);

/**
 * GET /api/stream/quotes
 * SSE endpoint for streaming stock quotes
 * Uses session-based authentication (cookies)
 */
router.get('/quotes', requireAuth, async (req, res) => {
  // Parse symbols from query parameter
  const symbolsParam = req.query.symbols || '';
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  if (symbols.length === 0) {
    return res.status(400).json({ error: 'No symbols provided' });
  }

  console.log(`[SSE] New connection for symbols: ${symbols.join(', ')}`);

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers immediately for SSE

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', symbols })}\n\n`);

  // Create connection ID using userId (from session)
  const connectionId = `${req.session.userId}_${Date.now()}`;

  // Store connection with user info
  connections.set(connectionId, {
    res,
    symbols,
    userId: req.session.userId,
  });

  // Function to send quote updates
  // Uses Yahoo Finance BATCH as PRIMARY provider (1 API call for all symbols)
  // Falls back to Finnhub individual calls only for missing symbols
  const sendQuoteUpdate = async () => {
    const connection = connections.get(connectionId);
    if (!connection) return;

    try {
      const symbolList = connection.symbols;
      let batchQuotes = {};
      let provider = 'yahoo';

      // PRIMARY: Use Yahoo Finance batch endpoint (1 API call for all symbols)
      if (!yahooFinanceService.isRateLimited()) {
        try {
          batchQuotes = await yahooFinanceService.getBatchQuotes(symbolList);
          console.log(`[SSE] Yahoo batch: ${Object.keys(batchQuotes).length}/${symbolList.length} quotes`);
        } catch (yahooErr) {
          console.log(`[SSE] Yahoo batch failed: ${yahooErr.message}, falling back to Finnhub`);
        }
      }

      // FALLBACK: For any missing symbols, use Finnhub individual calls
      const missingSymbols = symbolList.filter(s => !batchQuotes[s.toUpperCase()]);
      if (missingSymbols.length > 0) {
        provider = 'finnhub';
        console.log(`[SSE] Fetching ${missingSymbols.length} missing symbols from Finnhub`);
        const fallbackQuotes = await finnhubService.getQuotes(missingSymbols);
        Object.assign(batchQuotes, fallbackQuotes);
      }

      // Build quotes array with enriched data
      const quotes = symbolList.map(symbol => {
        const upperSymbol = symbol.toUpperCase();
        const quoteData = batchQuotes[upperSymbol];
        if (!quoteData) {
          return { symbol: upperSymbol, quote: null, error: 'Quote not available' };
        }
        const enriched = finnhubService.enrichQuote(upperSymbol, quoteData);
        return { symbol: upperSymbol, quote: enriched, error: null, _provider: provider };
      });

      // Send update event
      const data = {
        type: 'quote_update',
        timestamp: new Date().toISOString(),
        quotes,
      };

      connection.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`[SSE] Error sending update for ${connectionId}:`, err);
    }
  };

  // Send initial quote data immediately
  await sendQuoteUpdate();

  // Set up interval with adaptive polling based on market hours
  // Market hours: 10 seconds, After hours: 60 seconds
  let currentInterval = getPollInterval();
  let interval = setInterval(sendQuoteUpdate, currentInterval);

  // Check every minute if we need to adjust the interval (market open/close transition)
  const intervalChecker = setInterval(() => {
    const newInterval = getPollInterval();
    if (newInterval !== currentInterval) {
      console.log(`[SSE] Adjusting poll interval from ${currentInterval}ms to ${newInterval}ms (market ${isMarketOpen() ? 'open' : 'closed'})`);
      clearInterval(interval);
      currentInterval = newInterval;
      interval = setInterval(sendQuoteUpdate, currentInterval);
    }
  }, 60000);

  // Clean up on connection close
  req.on('close', () => {
    console.log(`[SSE] Connection closed: ${connectionId}`);
    clearInterval(interval);
    clearInterval(intervalChecker);
    connections.delete(connectionId);
    res.end();
  });
});

/**
 * GET /api/stream/status
 * Get active SSE connections (for debugging/admin)
 * Requires authentication
 */
router.get('/status', requireAuth, (req, res) => {
  const activeConnections = Array.from(connections.entries()).map(
    ([id, conn]) => ({
      id: id.substring(0, 8) + '...',  // Mask full ID for security
      symbols: conn.symbols,
      symbolCount: conn.symbols.length,
    })
  );

  res.json({
    activeConnections: activeConnections.length,
    connections: activeConnections,
  });
});

export default router;
