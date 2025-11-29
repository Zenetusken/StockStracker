import express from 'express';
import cors from 'cors';
import session from 'express-session';
import db, { initializeDatabase } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'stocktracker-pro-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/watchlists', watchlistRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'StockTracker Pro API',
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
  console.log('║         StockTracker Pro - Backend API Server                 ║');
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
