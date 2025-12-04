import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../database/stocktracker.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  console.log('[Database] Initializing schema...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      is_active INTEGER DEFAULT 1,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL,
      last_failed_login DATETIME DEFAULT NULL,
      password_changed_at DATETIME DEFAULT NULL
    );
  `);

  // Add account lockout columns to existing users table if they don't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN locked_until DATETIME DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_failed_login DATETIME DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_changed_at DATETIME DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }

  // MFA columns
  try {
    db.exec(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN mfa_secret TEXT DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN mfa_enabled_at DATETIME DEFAULT NULL`);
  } catch (e) { /* Column already exists */ }

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // User preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id),
      theme TEXT DEFAULT 'system',
      default_chart_type TEXT DEFAULT 'candle',
      default_timeframe TEXT DEFAULT '1D',
      decimal_places INTEGER DEFAULT 2,
      notifications_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Watchlists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT 'star',
      position INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Watchlist items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      notes TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(watchlist_id, symbol)
    );
  `);

  // Portfolios table
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      cash_balance REAL DEFAULT 0,
      is_paper_trading INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Portfolio holdings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      total_shares REAL NOT NULL,
      average_cost REAL NOT NULL,
      first_purchase_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(portfolio_id, symbol)
    );
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'dividend', 'split')),
      shares REAL NOT NULL,
      price REAL NOT NULL,
      fees REAL DEFAULT 0,
      notes TEXT,
      executed_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tax lots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      purchase_date DATE NOT NULL,
      shares_remaining REAL NOT NULL,
      cost_per_share REAL NOT NULL,
      transaction_id INTEGER REFERENCES transactions(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Lot sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lot_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_lot_id INTEGER NOT NULL REFERENCES tax_lots(id),
      sell_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      shares_sold REAL NOT NULL,
      sale_price REAL NOT NULL,
      realized_gain REAL NOT NULL,
      is_short_term INTEGER NOT NULL,
      sale_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT,
      type TEXT NOT NULL CHECK(type IN ('price_above', 'price_below', 'percent_change')),
      target_price REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_recurring INTEGER DEFAULT 0,
      triggered_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Alert history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      trigger_price REAL NOT NULL,
      message TEXT,
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Saved screeners table
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_screeners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Quote cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_cache (
      symbol TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ═══════════════════════════════════════════════════════════════
  // Symbol Database Tables (for offline-first search)
  // ═══════════════════════════════════════════════════════════════

  // Symbols table - local cache of all tradeable symbols
  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      display_symbol TEXT,
      description TEXT,
      type TEXT,
      exchange TEXT,
      mic TEXT,
      figi TEXT,
      currency TEXT DEFAULT 'USD',
      is_active INTEGER DEFAULT 1,
      popularity_score INTEGER DEFAULT 0,
      search_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Symbol sync metadata table - tracks sync status
  db.exec(`
    CREATE TABLE IF NOT EXISTS symbol_sync_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT UNIQUE NOT NULL,
      last_sync_at DATETIME,
      symbol_count INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // FTS5 virtual table for fast full-text search on symbols
  // This enables keyword search like "electric vehicle" or "technology bank"
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
      symbol,
      description,
      type,
      content='symbols',
      content_rowid='id',
      tokenize='porter unicode61'
    );
  `);

  // Triggers to keep FTS index in sync with symbols table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
      INSERT INTO symbols_fts(rowid, symbol, description, type)
      VALUES (new.id, new.symbol, new.description, new.type);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
      INSERT INTO symbols_fts(symbols_fts, rowid, symbol, description, type)
      VALUES ('delete', old.id, old.symbol, old.description, old.type);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS symbols_au AFTER UPDATE ON symbols BEGIN
      INSERT INTO symbols_fts(symbols_fts, rowid, symbol, description, type)
      VALUES ('delete', old.id, old.symbol, old.description, old.type);
      INSERT INTO symbols_fts(rowid, symbol, description, type)
      VALUES (new.id, new.symbol, new.description, new.type);
    END;
  `);

  // ═══════════════════════════════════════════════════════════════
  // API Keys Manager Tables
  // ═══════════════════════════════════════════════════════════════

  // API Services table - defines available API providers
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      docs_url TEXT,
      signup_url TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // API Keys table - stores API keys for each service
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES api_services(id) ON DELETE CASCADE,
      key_value TEXT NOT NULL,
      key_name TEXT,
      is_active INTEGER DEFAULT 1,
      is_rate_limited INTEGER DEFAULT 0,
      rate_limited_until DATETIME,
      last_used_at DATETIME,
      total_calls INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_id, key_value)
    );
  `);

  // API Rate Limits table - defines rate limits per service
  // Note: endpoint_pattern uses empty string '' instead of NULL for global limits
  // This ensures the UNIQUE constraint works properly (NULL != NULL in SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES api_services(id) ON DELETE CASCADE,
      limit_type TEXT NOT NULL,
      endpoint_pattern TEXT NOT NULL DEFAULT '',
      max_calls INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL,
      window_type TEXT DEFAULT 'sliding',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_id, limit_type, endpoint_pattern)
    );
  `);

  // Clean up any existing duplicate rate limits and NULL endpoint_patterns
  cleanupDuplicateRateLimits();

  // API Usage Windows table - tracks usage per key per window
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_usage_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      rate_limit_id INTEGER NOT NULL REFERENCES api_rate_limits(id) ON DELETE CASCADE,
      window_start DATETIME NOT NULL,
      call_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(key_id, rate_limit_id, window_start)
    );
  `);

  // API Call Timestamps table - tracks individual API calls for true sliding window rate limiting
  // Each call is stored with its timestamp and expiration time (timestamp + window_seconds * 1000)
  // This enables accurate sliding window calculations instead of fixed bucket approximations
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_call_timestamps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      rate_limit_id INTEGER NOT NULL REFERENCES api_rate_limits(id) ON DELETE CASCADE,
      call_timestamp INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  // API Burst Events table - tracks when burst rate limits (per-second) are hit
  // Used to show "Hit X times today" instead of meaningless real-time tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_burst_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES api_services(id) ON DELETE CASCADE,
      rate_limit_id INTEGER NOT NULL REFERENCES api_rate_limits(id) ON DELETE CASCADE,
      event_date TEXT NOT NULL,
      hit_count INTEGER DEFAULT 0,
      last_hit_at INTEGER,
      UNIQUE(service_id, rate_limit_id, event_date)
    );
  `);

  // Seed default API services
  seedApiServices();

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
    CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);
    CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_portfolio_id ON portfolio_holdings(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_symbol ON portfolio_holdings(symbol);
    CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
    CREATE INDEX IF NOT EXISTS idx_tax_lots_portfolio_id ON tax_lots(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_tax_lots_symbol ON tax_lots(symbol);
    CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
    CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_service_id ON api_keys(service_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
    CREATE INDEX IF NOT EXISTS idx_api_rate_limits_service_id ON api_rate_limits(service_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_windows_key_id ON api_usage_windows(key_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_windows_window_start ON api_usage_windows(window_start);
    CREATE INDEX IF NOT EXISTS idx_api_call_timestamps_expiry ON api_call_timestamps(key_id, rate_limit_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_symbols_symbol ON symbols(symbol);
    CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);
    CREATE INDEX IF NOT EXISTS idx_symbols_exchange ON symbols(exchange);
    CREATE INDEX IF NOT EXISTS idx_symbols_search_text ON symbols(search_text);
    CREATE INDEX IF NOT EXISTS idx_symbols_popularity ON symbols(popularity_score DESC);
  `);

  console.log('[Database] Schema initialized successfully');
}

/**
 * Clean up duplicate rate limits and migrate old types
 * This runs on every startup to ensure data integrity
 *
 * Strategy:
 * 1. Migrate old 'global' type to 'per_minute' for consistency
 * 2. Delete true duplicates (keeping newest by MAX(id) for better descriptions)
 * 3. Convert remaining NULL endpoint_patterns to empty string
 */
function cleanupDuplicateRateLimits() {
  try {
    // Step 1: If we have both 'global' and 'per_minute' for same service, delete the old 'global'
    // (We renamed 'global' to 'per_minute' for clarity)
    const obsoleteGlobals = db.prepare(`
      SELECT g.id FROM api_rate_limits g
      WHERE g.limit_type = 'global'
      AND EXISTS (
        SELECT 1 FROM api_rate_limits p
        WHERE p.service_id = g.service_id
        AND p.limit_type = 'per_minute'
        AND IFNULL(p.endpoint_pattern, '') = IFNULL(g.endpoint_pattern, '')
      )
    `).all();

    if (obsoleteGlobals.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM api_rate_limits WHERE id = ?');
      for (const row of obsoleteGlobals) {
        deleteStmt.run(row.id);
      }
      console.log(`[Database] Removed ${obsoleteGlobals.length} obsolete 'global' rate limit(s) (replaced by 'per_minute')`);
    }

    // Step 2: Find and remove true duplicates (same service, type, pattern)
    // Keep the NEWEST entry (MAX id) as it has better descriptions
    const duplicates = db.prepare(`
      SELECT rl.id FROM api_rate_limits rl
      WHERE rl.id NOT IN (
        SELECT MAX(sub.id) FROM api_rate_limits sub
        GROUP BY sub.service_id, sub.limit_type, IFNULL(sub.endpoint_pattern, '')
      )
    `).all();

    if (duplicates.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM api_rate_limits WHERE id = ?');
      const deleteMany = db.transaction((ids) => {
        for (const row of ids) {
          deleteStmt.run(row.id);
        }
      });
      deleteMany(duplicates);
      console.log(`[Database] Cleaned up ${duplicates.length} duplicate rate limit entries`);
    }

    // Step 3: AFTER duplicates are removed, safely convert NULL to empty string
    const updated = db.prepare(`
      UPDATE api_rate_limits SET endpoint_pattern = '' WHERE endpoint_pattern IS NULL
    `).run();

    if (updated.changes > 0) {
      console.log(`[Database] Normalized ${updated.changes} NULL endpoint_pattern(s) to empty string`);
    }
  } catch (error) {
    console.warn('[Database] Rate limit cleanup warning:', error.message);
  }
}

/**
 * Seed default API services and their rate limits
 */
function seedApiServices() {
  // Rate limit data sourced from official API documentation (researched Nov 2025)
  // Finnhub: https://finnhub.io/docs/api/rate-limit
  // Alpha Vantage: https://www.alphavantage.co/premium/
  const services = [
    {
      name: 'finnhub',
      displayName: 'Finnhub',
      baseUrl: 'https://finnhub.io/api/v1',
      docsUrl: 'https://finnhub.io/docs/api/rate-limit',
      signupUrl: 'https://finnhub.io/register',
      priority: 2,
      // Finnhub uses HTTP 429 for rate limiting
      // Free tier: 60 calls/min + 30 calls/sec burst limit (applies to all tiers)
      config: JSON.stringify({
        rateLimitHttpCode: 429,
        rateLimitErrorKey: 'error',
        retryStrategy: 'exponential_backoff',
        retryBaseDelay: 2000,
        retryMaxDelay: 30000,
        tier: 'free'
      }),
      rateLimits: [
        { type: 'per_minute', endpointPattern: '', maxCalls: 60, windowSeconds: 60, windowType: 'sliding', description: 'Free tier: 60 calls/minute' },
        { type: 'per_second', endpointPattern: '', maxCalls: 30, windowSeconds: 1, windowType: 'sliding', description: 'Burst limit: 30 calls/second (all tiers)' }
      ]
    },
    {
      name: 'alphavantage',
      displayName: 'Alpha Vantage',
      baseUrl: 'https://www.alphavantage.co/query',
      docsUrl: 'https://www.alphavantage.co/documentation/',
      signupUrl: 'https://www.alphavantage.co/support/#api-key',
      priority: 1,
      // Alpha Vantage returns HTTP 200 with "Note" or "Information" key when rate limited
      // Free tier: 25 calls/day + 5 calls/min, daily resets at UTC midnight
      config: JSON.stringify({
        rateLimitHttpCode: 200,
        rateLimitErrorKey: 'Note',
        rateLimitErrorKeyAlt: 'Information',
        retryStrategy: 'fixed_delay',
        retryBaseDelay: 12000,
        dailyResetTime: '00:00 UTC',
        tier: 'free'
      }),
      rateLimits: [
        { type: 'daily', endpointPattern: '', maxCalls: 25, windowSeconds: 86400, windowType: 'daily', description: 'Free tier: 25 calls/day (resets UTC midnight)' },
        { type: 'per_minute', endpointPattern: '', maxCalls: 5, windowSeconds: 60, windowType: 'sliding', description: 'Free tier: 5 calls/minute (12sec spacing recommended)' }
      ]
    },
    {
      name: 'yahoo',
      displayName: 'Yahoo Finance',
      baseUrl: 'https://query1.finance.yahoo.com',
      docsUrl: null,
      signupUrl: null,
      priority: 0,
      // Yahoo Finance is an unofficial API - no key required, undocumented rate limits
      // We track calls for visibility but don't enforce limits since they're unknown
      config: JSON.stringify({
        keyRequired: false,
        description: 'Free unofficial API - no key needed',
        rateLimitHttpCode: 429,
        rateLimitErrorKey: 'error',
        retryStrategy: 'exponential_backoff',
        retryBaseDelay: 5000,
        retryMaxDelay: 60000,
        tier: 'free'
      }),
      rateLimits: [
        { type: 'per_minute', endpointPattern: '', maxCalls: 100, windowSeconds: 60, windowType: 'sliding', description: 'Estimated limit - Yahoo has no documented limits' }
      ],
      // Virtual key for tracking (no actual API key needed)
      virtualKey: {
        keyValue: 'yahoo-default',
        keyName: 'Default (No Key Required)',
        source: 'system'
      }
    }
  ];

  const insertService = db.prepare(`
    INSERT OR IGNORE INTO api_services (name, display_name, base_url, docs_url, signup_url, priority, config)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Update existing services with new config data and priority
  const updateServiceConfig = db.prepare(`
    UPDATE api_services SET config = ?, docs_url = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?
  `);

  // Use explicit check before insert to handle edge cases
  const checkRateLimitExists = db.prepare(`
    SELECT id FROM api_rate_limits
    WHERE service_id = ? AND limit_type = ? AND endpoint_pattern = ?
  `);

  const insertRateLimit = db.prepare(`
    INSERT INTO api_rate_limits (service_id, limit_type, endpoint_pattern, max_calls, window_seconds, window_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const getServiceId = db.prepare('SELECT id FROM api_services WHERE name = ?');

  // Prepare statement for inserting virtual keys (for services that don't require API keys)
  const insertVirtualKey = db.prepare(`
    INSERT OR IGNORE INTO api_keys (service_id, key_value, key_name, source, is_active, priority)
    VALUES (?, ?, ?, ?, 1, 100)
  `);

  for (const service of services) {
    // Try to insert new service (will be ignored if exists due to unique constraint)
    insertService.run(
      service.name,
      service.displayName,
      service.baseUrl,
      service.docsUrl,
      service.signupUrl,
      service.priority,
      service.config || null
    );

    // Always update config and priority for existing services (ensures latest config is applied)
    updateServiceConfig.run(service.config || null, service.docsUrl, service.priority, service.name);

    const row = getServiceId.get(service.name);
    if (row) {
      for (const limit of service.rateLimits) {
        // Explicit existence check before insert (belt and suspenders)
        const existing = checkRateLimitExists.get(row.id, limit.type, limit.endpointPattern);
        if (!existing) {
          insertRateLimit.run(
            row.id,
            limit.type,
            limit.endpointPattern,
            limit.maxCalls,
            limit.windowSeconds,
            limit.windowType,
            limit.description
          );
        }
      }

      // Insert virtual key if service has one (for services that don't require API keys)
      if (service.virtualKey) {
        insertVirtualKey.run(
          row.id,
          service.virtualKey.keyValue,
          service.virtualKey.keyName,
          service.virtualKey.source
        );
      }
    }
  }

  // Migrate existing API keys from environment variables
  migrateEnvApiKeys();
}

/**
 * Migrate API keys from environment variables to database
 */
function migrateEnvApiKeys() {
  const insertKey = db.prepare(`
    INSERT OR IGNORE INTO api_keys (service_id, key_value, key_name, source)
    SELECT id, ?, ?, 'env' FROM api_services WHERE name = ?
  `);

  // Migrate Finnhub key
  if (process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY !== 'demo') {
    const key = process.env.FINNHUB_API_KEY.trim();
    if (key && key !== 'your_finnhub_api_key_here') {
      insertKey.run(key, 'Environment Key', 'finnhub');
      console.log('[Database] Migrated Finnhub API key from environment');
    }
  }

  // Migrate Alpha Vantage key
  if (process.env.ALPHAVANTAGE_API_KEY) {
    const key = process.env.ALPHAVANTAGE_API_KEY.trim();
    if (key && key !== 'your_alphavantage_api_key_here') {
      insertKey.run(key, 'Environment Key', 'alphavantage');
      console.log('[Database] Migrated Alpha Vantage API key from environment');
    }
  }
}

export default db;
