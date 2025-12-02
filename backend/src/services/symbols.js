import db from '../database.js';
import finnhub from './finnhub.js';

/**
 * Well-known symbols with high market cap that should be boosted in results.
 * These are major US companies that users commonly search for.
 */
const WELL_KNOWN_SYMBOLS = new Set([
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA',
  // Major tech
  'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM', 'QCOM',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'AXP', 'BRK.A', 'BRK.B',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT',
  // Consumer
  'WMT', 'HD', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'NKE', 'SBUX', 'DIS',
  // Energy & Industrial
  'XOM', 'CVX', 'BA', 'CAT', 'GE', 'UPS', 'HON',
  // ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'EFA', 'AGG',
]);

/**
 * Symbol Service
 * Manages the local symbol database for fast offline-first search.
 */
class SymbolService {
  constructor() {
    this.prepareStatements();
  }

  /**
   * Prepare SQL statements for better performance
   */
  prepareStatements() {
    // Insert/update symbol
    this.insertSymbol = db.prepare(`
      INSERT INTO symbols (symbol, display_symbol, description, type, exchange, mic, figi, currency, search_text, popularity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        display_symbol = excluded.display_symbol,
        description = excluded.description,
        type = excluded.type,
        exchange = excluded.exchange,
        mic = excluded.mic,
        figi = excluded.figi,
        currency = excluded.currency,
        search_text = excluded.search_text,
        popularity_score = excluded.popularity_score,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Search symbols (fast local search)
    this.searchSymbols = db.prepare(`
      SELECT symbol, display_symbol, description, type, exchange, popularity_score
      FROM symbols
      WHERE is_active = 1
        AND (type = 'Common Stock' OR type = 'ETP')
        AND (
          symbol LIKE ? COLLATE NOCASE
          OR search_text LIKE ? COLLATE NOCASE
        )
      ORDER BY
        CASE WHEN symbol = ? COLLATE NOCASE THEN 0 ELSE 1 END,
        CASE WHEN symbol LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,
        popularity_score DESC,
        LENGTH(symbol),
        symbol
      LIMIT ?
    `);

    // Get symbol count
    this.getSymbolCount = db.prepare(`
      SELECT COUNT(*) as count FROM symbols WHERE is_active = 1
    `);

    // Get symbols by type count
    this.getSymbolsByType = db.prepare(`
      SELECT type, COUNT(*) as count FROM symbols WHERE is_active = 1 GROUP BY type
    `);

    // Update sync metadata
    this.updateSyncMeta = db.prepare(`
      INSERT INTO symbol_sync_meta (exchange, last_sync_at, symbol_count, sync_status, error_message)
      VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)
      ON CONFLICT(exchange) DO UPDATE SET
        last_sync_at = CURRENT_TIMESTAMP,
        symbol_count = excluded.symbol_count,
        sync_status = excluded.sync_status,
        error_message = excluded.error_message,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Get sync status
    this.getSyncStatus = db.prepare(`
      SELECT * FROM symbol_sync_meta ORDER BY exchange
    `);

    // Delete all symbols (for full refresh)
    this.deleteAllSymbols = db.prepare(`DELETE FROM symbols`);

    // Get symbol by exact match
    this.getSymbolExact = db.prepare(`
      SELECT symbol, display_symbol, description, type, exchange
      FROM symbols
      WHERE symbol = ? COLLATE NOCASE AND is_active = 1
    `);

    // FTS5 full-text search (keyword search)
    this.searchFTS = db.prepare(`
      SELECT s.symbol, s.display_symbol, s.description, s.type, s.exchange, s.popularity_score,
             bm25(symbols_fts) as rank
      FROM symbols_fts
      JOIN symbols s ON symbols_fts.rowid = s.id
      WHERE symbols_fts MATCH ?
        AND s.is_active = 1
      ORDER BY rank, s.popularity_score DESC, LENGTH(s.symbol)
      LIMIT ?
    `);

    // FTS5 search with type filter
    this.searchFTSWithType = db.prepare(`
      SELECT s.symbol, s.display_symbol, s.description, s.type, s.exchange, s.popularity_score,
             bm25(symbols_fts) as rank
      FROM symbols_fts
      JOIN symbols s ON symbols_fts.rowid = s.id
      WHERE symbols_fts MATCH ?
        AND s.is_active = 1
        AND s.type = ?
      ORDER BY rank, s.popularity_score DESC, LENGTH(s.symbol)
      LIMIT ?
    `);

    // Search with filters (type and/or keywords)
    this.searchWithFilters = db.prepare(`
      SELECT symbol, display_symbol, description, type, exchange, popularity_score
      FROM symbols
      WHERE is_active = 1
        AND (type = ? OR ? = '')
        AND (
          symbol LIKE ? COLLATE NOCASE
          OR search_text LIKE ? COLLATE NOCASE
        )
      ORDER BY
        CASE WHEN symbol = ? COLLATE NOCASE THEN 0 ELSE 1 END,
        CASE WHEN symbol LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,
        popularity_score DESC,
        LENGTH(symbol),
        symbol
      LIMIT ?
    `);

    // Get suggestions (top symbols starting with prefix)
    this.getSuggestions = db.prepare(`
      SELECT symbol, display_symbol, description, type, popularity_score
      FROM symbols
      WHERE is_active = 1
        AND (type = 'Common Stock' OR type = 'ETP')
        AND symbol LIKE ? COLLATE NOCASE
      ORDER BY popularity_score DESC, LENGTH(symbol), symbol
      LIMIT ?
    `);

    // Get popular symbols (for empty search)
    this.getPopularSymbols = db.prepare(`
      SELECT symbol, display_symbol, description, type, exchange, popularity_score
      FROM symbols
      WHERE is_active = 1
        AND (type = 'Common Stock' OR type = 'ETP')
        AND popularity_score > 0
      ORDER BY popularity_score DESC, symbol
      LIMIT ?
    `);
  }

  /**
   * Search for symbols in local database
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Array} Matching symbols
   */
  search(query, limit = 20) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const q = query.trim();
    const likePattern = `%${q}%`;
    const prefixPattern = `${q}%`;

    const results = this.searchSymbols.all(
      likePattern,     // symbol LIKE
      likePattern,     // search_text LIKE
      q,               // exact match check
      prefixPattern,   // prefix match check
      limit
    );

    // Format results to match Finnhub API response structure
    return results.map(row => ({
      symbol: row.symbol,
      displaySymbol: row.display_symbol || row.symbol,
      description: row.description,
      type: row.type,
      exchange: row.exchange,
      _source: 'local',
    }));
  }

  /**
   * Full-text search using FTS5
   * Supports keyword queries like "technology", "bank", "energy"
   * @param {string} query - Search keywords
   * @param {Object} options - Search options
   * @param {string} options.type - Filter by type (e.g., 'Common Stock', 'ETP')
   * @param {number} options.limit - Max results
   * @returns {Array} Matching symbols
   */
  searchKeywords(query, { type = null, limit = 20 } = {}) {
    if (!query || query.trim().length === 0) {
      return this.getPopular(limit);
    }

    const q = query.trim();

    // Escape special FTS5 characters and prepare query
    const ftsQuery = this.prepareFTSQuery(q);

    let results;
    try {
      if (type) {
        results = this.searchFTSWithType.all(ftsQuery, type, limit);
      } else {
        results = this.searchFTS.all(ftsQuery, limit);
      }
    } catch (err) {
      // FTS query failed (e.g., syntax error), fall back to LIKE search
      console.warn(`[SymbolService] FTS search failed, falling back to LIKE:`, err.message);
      return this.searchWithType(q, type, limit);
    }

    return this.formatResults(results);
  }

  /**
   * Search with type filter using LIKE
   * @param {string} query - Search query
   * @param {string} type - Type filter (or null for all)
   * @param {number} limit - Max results
   */
  searchWithType(query, type = null, limit = 20) {
    if (!query || query.trim().length === 0) {
      return this.getPopular(limit);
    }

    const q = query.trim();
    const likePattern = `%${q}%`;
    const prefixPattern = `${q}%`;

    const results = this.searchWithFilters.all(
      type || '',      // type filter (empty string = no filter)
      type || '',      // type filter check
      likePattern,     // symbol LIKE
      likePattern,     // search_text LIKE
      q,               // exact match check
      prefixPattern,   // prefix match check
      limit
    );

    return this.formatResults(results);
  }

  /**
   * Get suggestions for autocomplete (symbols starting with prefix)
   * @param {string} prefix - Symbol prefix
   * @param {number} limit - Max results
   */
  getSuggestionsByPrefix(prefix, limit = 10) {
    if (!prefix || prefix.trim().length === 0) {
      return [];
    }

    const prefixPattern = `${prefix.trim().toUpperCase()}%`;
    const results = this.getSuggestions.all(prefixPattern, limit);

    return results.map(row => ({
      symbol: row.symbol,
      displaySymbol: row.display_symbol || row.symbol,
      description: row.description,
      type: row.type,
      _source: 'local',
    }));
  }

  /**
   * Get popular symbols (for empty search or landing page)
   * @param {number} limit - Max results
   */
  getPopular(limit = 20) {
    const results = this.getPopularSymbols.all(limit);
    return this.formatResults(results);
  }

  /**
   * Prepare FTS5 query from user input
   * Handles special characters and creates prefix matching
   */
  prepareFTSQuery(query) {
    // Remove special FTS5 characters that could cause syntax errors
    let clean = query.replace(/['"(){}[\]:*^~]/g, ' ').trim();

    // Split into words and create prefix matching for last word
    const words = clean.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) return '';

    // Add prefix matching (*) to the last word for autocomplete behavior
    // Join other words with AND for multi-word queries
    if (words.length === 1) {
      return `${words[0]}*`;
    }

    // Multiple words: exact match on all but last, prefix match on last
    const lastWord = words.pop();
    return words.map(w => `"${w}"`).join(' AND ') + ` AND ${lastWord}*`;
  }

  /**
   * Format database results to API response structure
   */
  formatResults(results) {
    return results.map(row => ({
      symbol: row.symbol,
      displaySymbol: row.display_symbol || row.symbol,
      description: row.description,
      type: row.type,
      exchange: row.exchange,
      _source: 'local',
    }));
  }

  /**
   * Rebuild FTS index from existing symbols
   * Run this after importing data or if index is out of sync
   */
  rebuildFTSIndex() {
    console.log('[SymbolService] Rebuilding FTS index...');

    try {
      // Try simple rebuild first
      db.exec(`DELETE FROM symbols_fts`);
      db.exec(`
        INSERT INTO symbols_fts(rowid, symbol, description, type)
        SELECT id, symbol, description, type FROM symbols WHERE is_active = 1
      `);
    } catch (err) {
      // If corrupted, drop and recreate the entire FTS table
      console.log('[SymbolService] FTS table corrupted, recreating...');

      // Drop triggers first
      db.exec(`DROP TRIGGER IF EXISTS symbols_ai`);
      db.exec(`DROP TRIGGER IF EXISTS symbols_ad`);
      db.exec(`DROP TRIGGER IF EXISTS symbols_au`);

      // Drop and recreate FTS table
      db.exec(`DROP TABLE IF EXISTS symbols_fts`);
      db.exec(`
        CREATE VIRTUAL TABLE symbols_fts USING fts5(
          symbol,
          description,
          type,
          content='symbols',
          content_rowid='id',
          tokenize='porter unicode61'
        )
      `);

      // Recreate triggers
      db.exec(`
        CREATE TRIGGER symbols_ai AFTER INSERT ON symbols BEGIN
          INSERT INTO symbols_fts(rowid, symbol, description, type)
          VALUES (new.id, new.symbol, new.description, new.type);
        END
      `);

      db.exec(`
        CREATE TRIGGER symbols_ad AFTER DELETE ON symbols BEGIN
          INSERT INTO symbols_fts(symbols_fts, rowid, symbol, description, type)
          VALUES('delete', old.id, old.symbol, old.description, old.type);
        END
      `);

      db.exec(`
        CREATE TRIGGER symbols_au AFTER UPDATE ON symbols BEGIN
          INSERT INTO symbols_fts(symbols_fts, rowid, symbol, description, type)
          VALUES('delete', old.id, old.symbol, old.description, old.type);
          INSERT INTO symbols_fts(rowid, symbol, description, type)
          VALUES (new.id, new.symbol, new.description, new.type);
        END
      `);

      // Now populate
      db.exec(`
        INSERT INTO symbols_fts(rowid, symbol, description, type)
        SELECT id, symbol, description, type FROM symbols WHERE is_active = 1
      `);
    }

    const count = db.prepare(`SELECT COUNT(*) as count FROM symbols_fts`).get().count;
    console.log(`[SymbolService] FTS index rebuilt with ${count} entries`);

    return count;
  }

  /**
   * Get available types for filter dropdown
   */
  getAvailableTypes() {
    const rows = this.getSymbolsByType.all();
    return rows.map(r => ({ type: r.type, count: r.count }));
  }

  /**
   * Get total symbol count in database
   */
  getCount() {
    return this.getSymbolCount.get().count;
  }

  /**
   * Get symbol counts by type
   */
  getCountsByType() {
    const rows = this.getSymbolsByType.all();
    const counts = {};
    for (const row of rows) {
      counts[row.type] = row.count;
    }
    return counts;
  }

  /**
   * Get sync status for all exchanges
   */
  getSyncInfo() {
    return this.getSyncStatus.all();
  }

  /**
   * Check if database has been synced
   */
  hasSyncedData() {
    return this.getCount() > 0;
  }

  /**
   * Get symbol by exact match
   */
  getBySymbol(symbol) {
    return this.getSymbolExact.get(symbol);
  }

  /**
   * Sync symbols from Finnhub API for a specific exchange
   * @param {string} exchange - Exchange code (e.g., 'US')
   * @returns {Object} Sync result
   */
  async syncExchange(exchange = 'US') {
    console.log(`[SymbolService] Starting sync for exchange: ${exchange}`);

    try {
      // Update status to 'syncing'
      this.updateSyncMeta.run(exchange, 0, 'syncing', null);

      // Fetch symbols from Finnhub
      const symbols = await finnhub.request('/stock/symbol', { exchange });

      if (!symbols || !Array.isArray(symbols)) {
        throw new Error('Invalid response from Finnhub API');
      }

      console.log(`[SymbolService] Received ${symbols.length} symbols from Finnhub`);

      // Filter for stocks and ETPs only
      const filteredSymbols = symbols.filter(s =>
        s.type === 'Common Stock' || s.type === 'ETP'
      );

      console.log(`[SymbolService] Filtered to ${filteredSymbols.length} stocks/ETPs`);

      // Batch insert symbols
      const batchSize = 500;
      const insertMany = db.transaction((symbolBatch) => {
        for (const sym of symbolBatch) {
          const searchText = `${sym.symbol} ${sym.description || ''}`.toLowerCase();
          const popularityScore = WELL_KNOWN_SYMBOLS.has(sym.symbol) ? 100 : 0;

          this.insertSymbol.run(
            sym.symbol,
            sym.displaySymbol || sym.symbol,
            sym.description || '',
            sym.type || 'Unknown',
            exchange,
            sym.mic || null,
            sym.figi || null,
            sym.currency || 'USD',
            searchText,
            popularityScore
          );
        }
      });

      // Process in batches
      for (let i = 0; i < filteredSymbols.length; i += batchSize) {
        const batch = filteredSymbols.slice(i, i + batchSize);
        insertMany(batch);
        console.log(`[SymbolService] Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filteredSymbols.length / batchSize)}`);
      }

      // Update sync metadata
      this.updateSyncMeta.run(exchange, filteredSymbols.length, 'completed', null);

      console.log(`[SymbolService] Sync completed for ${exchange}: ${filteredSymbols.length} symbols`);

      return {
        success: true,
        exchange,
        symbolCount: filteredSymbols.length,
        message: `Successfully synced ${filteredSymbols.length} symbols`,
      };
    } catch (error) {
      console.error(`[SymbolService] Sync failed for ${exchange}:`, error.message);

      this.updateSyncMeta.run(exchange, 0, 'failed', error.message);

      return {
        success: false,
        exchange,
        symbolCount: 0,
        error: error.message,
      };
    }
  }

  /**
   * Full sync of US symbols
   */
  async fullSync() {
    return this.syncExchange('US');
  }

  /**
   * Clear all symbols and sync fresh
   */
  async refreshSync() {
    console.log('[SymbolService] Clearing all symbols for fresh sync...');
    this.deleteAllSymbols.run();
    return this.fullSync();
  }

  /**
   * Calculate relevance score for a search result
   * (Used when combining local and API results)
   */
  calculateRelevanceScore(item, query) {
    const queryLower = query.toLowerCase().trim();
    const symbolLower = item.symbol.toLowerCase();
    const descLower = (item.description || '').toLowerCase();

    let score = 0;

    // Symbol matching (highest priority)
    if (symbolLower === queryLower) {
      score += 1000; // Exact match
    } else if (symbolLower.startsWith(queryLower)) {
      score += 500; // Prefix match
    } else if (symbolLower.includes(queryLower)) {
      score += 200; // Contains match
    }

    // Description matching
    if (descLower.startsWith(queryLower)) {
      score += 150;
    } else {
      const words = descLower.split(/\s+/);
      const hasWordMatch = words.some(word => word.startsWith(queryLower));
      if (hasWordMatch) {
        score += 100;
      } else if (descLower.includes(queryLower)) {
        score += 50;
      }
    }

    // Type prioritization
    if (item.type === 'Common Stock') {
      score += 30;
    }

    // Well-known symbol boost
    if (WELL_KNOWN_SYMBOLS.has(item.symbol.toUpperCase())) {
      score += 25;
    }

    // Shorter symbols are often more recognizable
    if (item.symbol.length < 5) {
      score += (5 - item.symbol.length) * 10;
    }

    // Bonus for local source (instant results)
    if (item._source === 'local') {
      score += 5;
    }

    return score;
  }
}

// Export singleton instance
const symbolService = new SymbolService();
export default symbolService;
