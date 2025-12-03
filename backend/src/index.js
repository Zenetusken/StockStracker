import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from project root (parent of backend directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { apiLimiter } from './middleware/rateLimit.js';
import { csrfTokenEndpoint, csrfProtection } from './middleware/csrf.js';
import db, { initializeDatabase } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Security headers - apply first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https://finnhub.io", "https://www.alphavantage.co"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - environment-based origins
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - Security hardened
const SESSION_SECRET = process.env.SESSION_SECRET;

// Validate session secret in production
if (process.env.NODE_ENV === 'production') {
  if (!SESSION_SECRET || SESSION_SECRET.length < 64) {
    console.error('FATAL: SESSION_SECRET must be set to a secure random string (64+ chars) in production');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
} else if (!SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET not set. Using insecure default for development only.');
}

app.use(session({
  secret: SESSION_SECRET || 'dev-only-insecure-secret-do-not-use-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'stocktracker.sid',  // Custom session cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    httpOnly: true,                                  // Prevent XSS access to cookie
    sameSite: 'strict',                             // CSRF protection
    maxAge: 1000 * 60 * 60 * 24                     // 24 hours (reduced from 7 days)
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Import routes
import authRoutes from './routes/auth.js';
import quotesRoutes from './routes/quotes.js';
import searchRoutes from './routes/search.js';
import streamRoutes from './routes/stream.js';
import watchlistRoutes from './routes/watchlists.js';
import apiKeysRoutes from './routes/api-keys.js';
import symbolsRoutes from './routes/symbols.js';
import rateLimitEventsRoutes from './routes/rate-limit-events.js';
import securityRoutes from './routes/security.js';
import mfaRoutes from './routes/mfa.js';
import portfolioRoutes from './routes/portfolios.js';
import alertsRoutes from './routes/alerts.js';
import newsRoutes from './routes/news.js';
import screenerRoutes from './routes/screener.js';

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// CSRF token endpoint (must be before CSRF protection middleware)
app.get('/api/csrf-token', csrfTokenEndpoint);

// Apply CSRF protection to state-changing routes
// Note: This protects POST, PUT, DELETE, PATCH requests
app.use('/api/auth', csrfProtection);
app.use('/api/watchlists', csrfProtection);
app.use('/api/portfolios', csrfProtection);
app.use('/api/alerts', csrfProtection);
app.use('/api/admin', csrfProtection);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/admin/api-keys', apiKeysRoutes);
app.use('/api/admin/security', securityRoutes);
app.use('/api/mfa', csrfProtection, mfaRoutes);
app.use('/api/symbols', symbolsRoutes);
app.use('/api/rate-limits', rateLimitEventsRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'StockTracker API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      quotes: '/api/quotes',
      watchlists: '/api/watchlists',
      portfolios: '/api/portfolios',
      alerts: '/api/alerts',
      news: '/api/news',
      screener: '/api/screener',
      market: '/api/market'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         StockTracker - Backend API Server                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Database: SQLite (WAL mode enabled)`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  • Health Check:  http://localhost:${PORT}/health`);
  console.log(`  • API Root:      http://localhost:${PORT}/api`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});

export default app;
