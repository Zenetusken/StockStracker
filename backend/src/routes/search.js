import express from 'express';
import finnhub from '../services/finnhub.js';
import yahoo from '../services/yahoo.js';
import symbolService from '../services/symbols.js';

const router = express.Router();

/**
 * Calculate relevance score for a search result.
 * Higher score = more relevant result.
 *
 * Scoring factors:
 * - Exact symbol match: +1000
 * - Symbol prefix match: +500
 * - Symbol contains query: +200
 * - Description starts with query: +150
 * - Description word match: +100
 * - Description contains query: +50
 * - Common Stock type: +30
 * - Shorter symbol (more recognizable): +10 * (10 - length)
 */
function calculateRelevanceScore(item, query) {
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
    score += 150; // Description starts with query
  } else {
    // Check for word boundary match in description
    const words = descLower.split(/\s+/);
    const hasWordMatch = words.some(word => word.startsWith(queryLower));
    if (hasWordMatch) {
      score += 100; // Word match
    } else if (descLower.includes(queryLower)) {
      score += 50; // Contains match
    }
  }

  // Type prioritization
  if (item.type === 'Common Stock') {
    score += 30;
  }
  // ETP (ETFs) get no bonus but aren't penalized

  // Shorter symbols are often more recognizable
  // Bonus: +10 for each character under 5
  if (item.symbol.length < 5) {
    score += (5 - item.symbol.length) * 10;
  }

  return score;
}

/**
 * GET /api/search
 * Search for stock symbols and companies
 * Query params:
 *   - q (search query)
 *   - mode ('symbol' for symbol/name search, 'keyword' for FTS keyword search - default 'symbol')
 *   - type (filter by type: 'Common Stock', 'ETP', or empty for all)
 *   - includeQuotes (boolean, fetch real-time quotes for results)
 *   - limit (number, max results to return, default 20)
 *   - source (string, 'local', 'api', or 'auto' - default 'auto')
 *
 * Search Strategy (when source='auto'):
 * 1. If local symbol database has data, search locally first (instant, <5ms)
 * 2. If local search returns no results OR local DB is empty, fall back to Finnhub API
 * 3. Response includes 'source' field indicating where results came from
 *
 * Search Modes:
 * - 'symbol': Traditional search matching symbol or company name (default)
 * - 'keyword': Full-text search matching keywords in description (e.g., "technology", "bank", "energy")
 */
router.get('/', async (req, res) => {
  try {
    const { q, mode = 'symbol', type, includeQuotes, limit = 20, source = 'auto' } = req.query;

    // M9: Search query validation to prevent injection attacks
    if (q !== undefined) {
      // Validate query is string
      if (typeof q !== 'string') {
        return res.status(400).json({ error: 'Query must be a string' });
      }

      // Length limit (100 characters max)
      if (q.length > 100) {
        return res.status(400).json({ error: 'Query too long (max 100 characters)' });
      }

      // Character whitelist: alphanumeric, spaces, common punctuation for stock symbols
      // Allows: letters, numbers, spaces, hyphens, periods, ampersands
      if (!/^[a-zA-Z0-9\s\-\.&]*$/.test(q)) {
        return res.status(400).json({ error: 'Invalid characters in query' });
      }
    }

    const shouldIncludeQuotes = includeQuotes === 'true' || includeQuotes === '1';
    const resultLimit = Math.min(parseInt(limit) || 20, 50);
    const searchMode = mode === 'keyword' ? 'keyword' : 'symbol';
    const typeFilter = type && ['Common Stock', 'ETP'].includes(type) ? type : null;

    // For empty queries with local data, return popular symbols
    if (!q || q.trim().length === 0) {
      const hasLocalData = symbolService.hasSyncedData();
      if (hasLocalData) {
        const popular = symbolService.getPopular(resultLimit);
        return res.json({
          count: popular.length,
          results: popular,
          categories: {
            stocks: popular.filter(r => r.type === 'Common Stock').length,
            etps: popular.filter(r => r.type === 'ETP').length,
          },
          source: 'local',
          localDataAvailable: true,
        });
      }
      return res.json({ count: 0, results: [], categories: { stocks: 0, etps: 0 }, source: 'none' });
    }

    const query = q.trim();
    let results = [];
    let searchSource = 'api';
    let categories = { stocks: 0, etps: 0 };
    let totalMatches = 0;

    // Try local database first (if source is 'auto' or 'local')
    const useLocalFirst = source === 'auto' || source === 'local';
    const hasLocalData = symbolService.hasSyncedData();

    if (useLocalFirst && hasLocalData) {
      // Search local database (instant, typically <5ms)
      const localStart = Date.now();

      let localResults;
      if (searchMode === 'keyword') {
        // Use FTS5 full-text search for keyword queries
        localResults = symbolService.searchKeywords(query, { type: typeFilter, limit: resultLimit });
      } else if (typeFilter) {
        // Use LIKE search with type filter
        localResults = symbolService.searchWithType(query, typeFilter, resultLimit);
      } else {
        // Standard symbol/name search
        localResults = symbolService.search(query, resultLimit);
      }

      const localTime = Date.now() - localStart;

      if (localResults.length > 0) {
        results = localResults;
        searchSource = 'local';
        console.log(`[Search] Local ${searchMode} search for "${query}" (type: ${typeFilter || 'all'}): ${results.length} results in ${localTime}ms`);

        // Count by category
        categories = {
          stocks: results.filter(r => r.type === 'Common Stock').length,
          etps: results.filter(r => r.type === 'ETP').length,
        };
        totalMatches = results.length;
      }
    }

    // Fall back to Finnhub API if no local results (or source='api')
    // Note: Finnhub API doesn't support keyword search, so we only fall back for symbol search
    if (results.length === 0 && source !== 'local' && searchMode === 'symbol') {
      const apiStart = Date.now();
      const searchResults = await finnhub.searchSymbols(query);
      const apiTime = Date.now() - apiStart;

      // Filter for US stocks and ETPs, apply type filter if specified
      const filteredResults = (searchResults.result || []).filter(item => {
        const isUSStock = item.type === 'Common Stock' || item.type === 'ETP';
        const matchesType = !typeFilter || item.type === typeFilter;
        return isUSStock && matchesType;
      });

      // Count by category before limiting
      categories = {
        stocks: filteredResults.filter(r => r.type === 'Common Stock').length,
        etps: filteredResults.filter(r => r.type === 'ETP').length,
      };
      totalMatches = filteredResults.length;

      // Calculate relevance scores and sort
      const scoredResults = filteredResults.map(item => ({
        ...item,
        _score: calculateRelevanceScore(item, query),
      }));

      // Sort by score (descending), then alphabetically by symbol for ties
      scoredResults.sort((a, b) => {
        if (b._score !== a._score) {
          return b._score - a._score;
        }
        return a.symbol.localeCompare(b.symbol);
      });

      // Take top results and format
      results = scoredResults
        .slice(0, resultLimit)
        .map(item => ({
          symbol: item.symbol,
          displaySymbol: item.displaySymbol,
          description: item.description,
          type: item.type,
        }));

      searchSource = 'api';
      console.log(`[Search] API search for "${query}": ${results.length} results in ${apiTime}ms`);
    }

    // Optionally fetch quotes for search results (limit to top 5 to respect rate limits)
    if (shouldIncludeQuotes && results.length > 0) {
      const symbolsToQuote = results.slice(0, 5).map(r => r.symbol);

      try {
        const quotes = await finnhub.getQuotes(symbolsToQuote);

        // Enrich results with quote data
        results.forEach(result => {
          const quote = quotes[result.symbol];
          if (quote && quote.c > 0) {
            const change = quote.c - quote.pc;
            const percentChange = (change / quote.pc) * 100;

            result.quote = {
              price: quote.c,
              change: parseFloat(change.toFixed(2)),
              percentChange: parseFloat(percentChange.toFixed(2)),
              high: quote.h,
              low: quote.l,
            };
          }
        });
      } catch (quoteError) {
        // Log but don't fail the search if quotes fail
        console.warn('Failed to fetch quotes for search results:', quoteError.message);
      }
    }

    res.json({
      count: results.length,
      results: results,
      categories: categories,
      totalMatches: totalMatches,
      source: searchSource,
      localDataAvailable: hasLocalData,
      mode: searchMode,
      typeFilter: typeFilter,
    });
  } catch (error) {
    console.error('Error searching symbols:', error);
    res.status(500).json({ error: 'Failed to search symbols' });
  }
});

/**
 * GET /api/search/suggestions
 * Get autocomplete suggestions for a symbol prefix
 * Query params:
 *   - q (symbol prefix, e.g., "AA" returns AAPL, AAL, etc.)
 *   - limit (number, default 10)
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    const resultLimit = Math.min(parseInt(limit) || 10, 20);

    if (!q || q.trim().length === 0) {
      return res.json({ suggestions: [] });
    }

    const hasLocalData = symbolService.hasSyncedData();
    if (!hasLocalData) {
      return res.json({ suggestions: [], localDataAvailable: false });
    }

    const suggestions = symbolService.getSuggestionsByPrefix(q, resultLimit);

    res.json({
      suggestions,
      localDataAvailable: true,
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

/**
 * GET /api/search/popular
 * Get popular/well-known symbols
 * Query params:
 *   - limit (number, default 20)
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const resultLimit = Math.min(parseInt(limit) || 20, 50);

    const hasLocalData = symbolService.hasSyncedData();
    if (!hasLocalData) {
      return res.json({ results: [], localDataAvailable: false });
    }

    const results = symbolService.getPopular(resultLimit);

    res.json({
      count: results.length,
      results,
      localDataAvailable: true,
    });
  } catch (error) {
    console.error('Error fetching popular symbols:', error);
    res.status(500).json({ error: 'Failed to fetch popular symbols' });
  }
});

/**
 * GET /api/search/types
 * Get available security types for filtering
 */
router.get('/types', async (req, res) => {
  try {
    const hasLocalData = symbolService.hasSyncedData();
    if (!hasLocalData) {
      return res.json({ types: [], localDataAvailable: false });
    }

    const types = symbolService.getAvailableTypes();

    res.json({
      types,
      localDataAvailable: true,
    });
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).json({ error: 'Failed to fetch types' });
  }
});

/**
 * GET /api/search/market-news
 * Get general market news
 * Query params: category (general, forex, crypto, merger)
 */
router.get('/market-news', async (req, res) => {
  try {
    const { category = 'general' } = req.query;

    const news = await finnhub.getMarketNews(category);

    res.json(news || []);
  } catch (error) {
    console.error('Error fetching market news:', error);
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

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

  if (day === 0 || day === 6) return false;
  const timeInMinutes = hour * 60 + minute;
  return timeInMinutes >= 570 && timeInMinutes < 960;
}

/**
 * GET /api/search/trending
 * Get trending stocks from Yahoo Finance (100% dynamic - no hardcoded symbols)
 * Uses Yahoo's trending_tickers screener for real-time trending data
 *
 * Query params:
 *   - limit (number, default 5 per category)
 *   - refresh (boolean, force refresh cache)
 *
 * Response:
 *   - gainers: Top stocks by positive % change
 *   - losers: Top stocks by negative % change
 *   - mostActive: Stocks with highest absolute % change
 *   - timestamp: When data was fetched
 *   - source: 'yahoo' (dynamic)
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const resultLimit = Math.min(parseInt(limit) || 5, 15);

    const now = Date.now();
    const startTime = Date.now();

    console.log(`[Trending] Fetching dynamic trending from Yahoo (market ${isMarketOpen() ? 'open' : 'closed'})...`);

    // Fetch trending tickers with quotes from Yahoo Finance (cached internally)
    const trendingData = await yahoo.getTrendingTickersWithQuotes();
    const fetchTime = Date.now() - startTime;

    if (!trendingData || trendingData.length === 0) {
      console.log('[Trending] No data from Yahoo, returning empty');
      return res.json({
        gainers: [],
        losers: [],
        mostActive: [],
        timestamp: now,
        source: 'yahoo',
        marketOpen: isMarketOpen(),
      });
    }

    // Transform Yahoo data to expected format
    const movers = trendingData.map(stock => ({
      symbol: stock.symbol,
      description: stock.name || stock.symbol,
      price: stock.price,
      change: stock.change,
      percentChange: stock.changePercent,
      volume: stock.volume,
    }));

    // Sort for gainers (highest positive % change)
    const gainers = [...movers]
      .filter(m => m.percentChange > 0)
      .sort((a, b) => b.percentChange - a.percentChange);

    // Sort for losers (most negative % change)
    const losers = [...movers]
      .filter(m => m.percentChange < 0)
      .sort((a, b) => a.percentChange - b.percentChange);

    // Sort for most active (highest absolute % change)
    const mostActive = [...movers]
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    console.log(`[Trending] Found ${gainers.length} gainers, ${losers.length} losers from ${movers.length} trending stocks in ${fetchTime}ms`);

    res.json({
      gainers: gainers.slice(0, resultLimit),
      losers: losers.slice(0, resultLimit),
      mostActive: mostActive.slice(0, resultLimit),
      timestamp: now,
      source: 'yahoo',
      fetchTime,
      marketOpen: isMarketOpen(),
    });
  } catch (error) {
    console.error('Error fetching trending stocks:', error);
    res.status(500).json({ error: 'Failed to fetch trending stocks' });
  }
});

export default router;
