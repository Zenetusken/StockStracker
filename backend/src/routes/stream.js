import express from 'express';
import { getEnrichedQuote } from '../services/finnhub.js';

const router = express.Router();

// Store active connections
const connections = new Map();

// SSE endpoint for streaming quotes
router.get('/quotes', async (req, res) => {
  // Require authentication
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', symbols })}\n\n`);

  // Create connection ID
  const connectionId = `${req.session.userId}_${Date.now()}`;

  // Store connection
  connections.set(connectionId, {
    res,
    symbols,
    userId: req.session.userId,
  });

  // Function to send quote updates
  const sendQuoteUpdate = async () => {
    const connection = connections.get(connectionId);
    if (!connection) return;

    try {
      // Fetch quotes for all symbols
      const quotes = await Promise.all(
        connection.symbols.map(async (symbol) => {
          try {
            const quote = await getEnrichedQuote(symbol);
            return { symbol, quote, error: null };
          } catch (err) {
            return { symbol, quote: null, error: err.message };
          }
        })
      );

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

  // Set up interval to send updates every 5 seconds
  const interval = setInterval(sendQuoteUpdate, 5000);

  // Clean up on connection close
  req.on('close', () => {
    console.log(`[SSE] Connection closed: ${connectionId}`);
    clearInterval(interval);
    connections.delete(connectionId);
    res.end();
  });
});

// Endpoint to get active connections (for debugging)
router.get('/status', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const activeConnections = Array.from(connections.entries()).map(
    ([id, conn]) => ({
      id,
      symbols: conn.symbols,
      userId: conn.userId,
    })
  );

  res.json({
    activeConnections: activeConnections.length,
    connections: activeConnections,
  });
});

export default router;
