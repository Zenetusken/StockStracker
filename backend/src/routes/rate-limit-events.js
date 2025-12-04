import { Router } from 'express';
import rateLimitEvents from '../services/api-keys/RateLimitEventEmitter.js';

const router = Router();

// Store active SSE connections
const clients = new Set();

/**
 * SSE endpoint for rate limit events
 * GET /api/rate-limits/stream
 *
 * Streams rate limit events to connected clients:
 * - usage_warning: When usage reaches 80%
 * - rate_limit_hit: When rate limit is reached
 * - rate_limit_recovered: When service is available again
 */
router.get('/stream', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to rate limit events' })}\n\n`);

  // Add this client to the set
  clients.add(res);
  console.log(`[SSE] Client connected. Total clients: ${clients.size}`);

  // Send keepalive every 30 seconds
  const keepalive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepalive);
    clients.delete(res);
    console.log(`[SSE] Client disconnected. Total clients: ${clients.size}`);
  });
});

/**
 * Broadcast event to all connected clients
 */
function broadcastEvent(event) {
  const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) {
    try {
      client.write(eventData);
    } catch (error) {
      console.error('[SSE] Error sending to client:', error.message);
      clients.delete(client);
    }
  }
}

// Subscribe to rate limit events
rateLimitEvents.on('rate_limit_event', (event) => {
  broadcastEvent(event);
});

/**
 * Manual test endpoint - trigger a test event
 * POST /api/rate-limits/test
 * Body: { type: 'warning' | 'hit' | 'recovered', service: 'finnhub' | 'yahoo' }
 */
router.post('/test', (req, res) => {
  const { type = 'warning', service = 'finnhub' } = req.body;

  switch (type) {
    case 'warning':
      rateLimitEvents.emitUsageWarning(service, 48, 60, 'per_minute');
      break;
    case 'hit':
      rateLimitEvents.emitRateLimitHit(service, 60, 'per_minute');
      break;
    case 'recovered':
      rateLimitEvents.emitRateLimitRecovered(service);
      break;
    default:
      return res.status(400).json({ error: 'Invalid type. Use: warning, hit, or recovered' });
  }

  res.json({ success: true, type, service });
});

/**
 * Get current connection count
 * GET /api/rate-limits/connections
 */
router.get('/connections', (req, res) => {
  res.json({ connections: clients.size });
});

export default router;
