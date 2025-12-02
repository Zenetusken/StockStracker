import express from 'express';
import finnhub from '../services/finnhub.js';
import symbolService from '../services/symbols.js';

const router = express.Router();

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
 * - Well-known symbol: +25
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

  // Well-known symbol boost
  if (WELL_KNOWN_SYMBOLS.has(item.symbol.toUpperCase())) {
    score += 25;
  }

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
 * Trending symbols cache - stores calculated movers with timestamps
 * Adaptive TTL: 2 minutes during market hours, 10 minutes after hours
 */
const trendingCache = {
  data: null,
  timestamp: 0,
  fetching: false, // Prevent concurrent fetches
  getTTL: () => isMarketOpen() ? 2 * 60 * 1000 : 10 * 60 * 1000, // 2min market, 10min after
};

/**
 * Symbols to track for trending/movers
 * Reduced to 15 most-watched symbols to minimize API calls
 * (was 33 symbols = 33 API calls per refresh)
 */
const TRENDING_SYMBOLS = [
  // Mega-cap tech (most watched - 7 symbols)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  // Major sectors (4 symbols)
  'JPM', 'JNJ', 'XOM', 'WMT',
  // ETFs (3 symbols) - broad market coverage
  'SPY', 'QQQ', 'IWM',
  // Additional high-volume (1 symbol)
  'AMD',
];

/**
 * GET /api/search/trending
 * Get trending stocks - top gainers and losers
 * Query params:
 *   - limit (number, default 5 per category)
 *   - refresh (boolean, force refresh cache)
 *
 * Response:
 *   - gainers: Top stocks by positive % change
 *   - losers: Top stocks by negative % change
 *   - mostActive: Stocks with highest absolute % change
 *   - timestamp: When data was fetched
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = 5, refresh } = req.query;
    const resultLimit = Math.min(parseInt(limit) || 5, 10);
    const forceRefresh = refresh === 'true' || refresh === '1';

    const now = Date.now();
    const cacheTTL = trendingCache.getTTL();

    // Check cache - use adaptive TTL based on market hours
    if (!forceRefresh && trendingCache.data && (now - trendingCache.timestamp) < cacheTTL) {
      console.log(`[Trending] Returning cached data (age: ${Math.round((now - trendingCache.timestamp) / 1000)}s, TTL: ${cacheTTL / 1000}s)`);
      const cached = trendingCache.data;
      return res.json({
        gainers: cached.gainers.slice(0, resultLimit),
        losers: cached.losers.slice(0, resultLimit),
        mostActive: cached.mostActive.slice(0, resultLimit),
        timestamp: cached.timestamp,
        cached: true,
        marketOpen: isMarketOpen(),
      });
    }

    // Prevent concurrent fetches - if already fetching, wait and return cache
    if (trendingCache.fetching && trendingCache.data) {
      console.log('[Trending] Already fetching, returning stale cache');
      const cached = trendingCache.data;
      return res.json({
        gainers: cached.gainers.slice(0, resultLimit),
        losers: cached.losers.slice(0, resultLimit),
        mostActive: cached.mostActive.slice(0, resultLimit),
        timestamp: cached.timestamp,
        cached: true,
        stale: true,
      });
    }

    trendingCache.fetching = true;
    console.log(`[Trending] Fetching fresh quotes for ${TRENDING_SYMBOLS.length} symbols (market ${isMarketOpen() ? 'open' : 'closed'})...`);
    const startTime = Date.now();

    // Fetch quotes for all trending symbols
    const quotes = await finnhub.getQuotes(TRENDING_SYMBOLS);
    const fetchTime = Date.now() - startTime;

    // Get symbol details from local database if available
    const hasLocalData = symbolService.hasSyncedData();

    // Calculate % change and build results
    const movers = [];

    for (const symbol of TRENDING_SYMBOLS) {
      const quote = quotes[symbol];
      if (!quote || !quote.c || quote.c <= 0 || !quote.pc || quote.pc <= 0) {
        continue;
      }

      const change = quote.c - quote.pc;
      const percentChange = (change / quote.pc) * 100;

      // Get company name from local database
      let description = symbol;
      if (hasLocalData) {
        const symbolInfo = symbolService.getBySymbol(symbol);
        if (symbolInfo) {
          description = symbolInfo.description;
        }
      }

      movers.push({
        symbol,
        description,
        price: parseFloat(quote.c.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        percentChange: parseFloat(percentChange.toFixed(2)),
        high: quote.h,
        low: quote.l,
        open: quote.o,
        previousClose: quote.pc,
      });
    }

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

    const trendingData = {
      gainers,
      losers,
      mostActive,
      timestamp: now,
      fetchTime,
    };

    // Update cache and reset fetching flag
    trendingCache.data = trendingData;
    trendingCache.timestamp = now;
    trendingCache.fetching = false;

    console.log(`[Trending] Found ${gainers.length} gainers, ${losers.length} losers in ${fetchTime}ms (${TRENDING_SYMBOLS.length} API calls)`);

    res.json({
      gainers: gainers.slice(0, resultLimit),
      losers: losers.slice(0, resultLimit),
      mostActive: mostActive.slice(0, resultLimit),
      timestamp: now,
      cached: false,
      fetchTime,
    });
  } catch (error) {
    trendingCache.fetching = false; // Reset on error
    console.error('Error fetching trending stocks:', error);
    res.status(500).json({ error: 'Failed to fetch trending stocks' });
  }
});

export default router;
