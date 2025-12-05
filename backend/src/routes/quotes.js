import express from 'express';
import finnhub from '../services/finnhub.js';
import yahooFinanceService from '../services/yahoo.js';
import { requireAuth } from '../middleware/auth.js';
import { quoteLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// H6: Apply authentication to all quote endpoints to prevent unauthorized data access
router.use(requireAuth);

// M8: Rate limit quote endpoints to prevent API abuse
router.use(quoteLimiter);

/**
 * GET /api/quotes/:symbol
 * Get real-time quote for a specific symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const quote = await finnhub.getEnrichedQuote(symbol);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found or invalid symbol' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote data' });
  }
});

/**
 * POST /api/quotes/batch
 * Get quotes for multiple symbols at once using TRUE batching
 * Body: { symbols: ['AAPL', 'GOOGL', 'MSFT'] }
 *
 * Uses Yahoo Finance spark endpoint for efficient batching (1 API call per 20 symbols)
 * Falls back to Finnhub individual calls for any missing symbols
 */
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    if (symbols.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols allowed' });
    }

    console.log(`[Quotes] Batch fetching ${symbols.length} symbols...`);

    // PRIMARY: Use Yahoo Finance batch (TRUE batching - 1 API call per 20 symbols)
    let batchQuotes = {};
    try {
      batchQuotes = await yahooFinanceService.getBatchQuotes(symbols);
      console.log(`[Quotes] Yahoo batch returned ${Object.keys(batchQuotes).length}/${symbols.length} quotes`);
    } catch (error) {
      console.log(`[Quotes] Yahoo batch failed: ${error.message}, falling back to individual quotes`);
    }

    // FALLBACK: For any missing symbols, use Finnhub individual calls
    const missingSymbols = symbols.filter(s => !batchQuotes[s.toUpperCase()]);
    if (missingSymbols.length > 0) {
      console.log(`[Quotes] Fetching ${missingSymbols.length} missing symbols via Finnhub fallback`);
      const fallbackQuotes = await finnhub.getQuotes(missingSymbols);
      Object.assign(batchQuotes, fallbackQuotes);
    }

    // Enrich all quotes (normalizes format regardless of source)
    const enrichedQuotes = {};
    for (const [symbol, quoteData] of Object.entries(batchQuotes)) {
      const enriched = finnhub.enrichQuote(symbol, quoteData);
      if (enriched) {
        enrichedQuotes[symbol] = enriched;
      }
    }

    console.log(`[Quotes] Returning ${Object.keys(enrichedQuotes).length} enriched quotes`);
    res.json(enrichedQuotes);
  } catch (error) {
    console.error('Error fetching batch quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

/**
 * POST /api/quotes/profiles
 * Get profiles for multiple symbols at once
 * Body: { symbols: ['AAPL', 'GOOGL', 'MSFT'] }
 *
 * OPTIMIZED: Uses sequential batching with delays to respect Finnhub rate limit (60/min)
 * Processes 5 profiles at a time with 100ms delays between batches
 */
router.post('/profiles', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    if (symbols.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols allowed' });
    }

    console.log(`[Quotes] Batch fetching ${symbols.length} profiles...`);

    // Sequential batching: 5 profiles at a time with 100ms delays
    // Prevents overwhelming Finnhub's 60 calls/minute rate limit
    const BATCH_SIZE = 5;
    const DELAY_MS = 100;
    const profiles = {};

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      // Fetch batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const profile = await finnhub.getCompanyProfile(symbol);
            return { symbol, profile };
          } catch (err) {
            console.log(`[Quotes] Could not fetch profile for ${symbol}:`, err.message);
            return { symbol, profile: null };
          }
        })
      );

      // Add valid profiles to result
      for (const { symbol, profile } of batchResults) {
        if (profile && profile.name) {
          profiles[symbol.toUpperCase()] = profile;
        }
      }

      // Small delay between batches (except for last batch)
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`[Quotes] Returning ${Object.keys(profiles).length}/${symbols.length} profiles`);
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching batch profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

/**
 * GET /api/quotes/:symbol/profile
 * Get company profile for a symbol
 */
router.get('/:symbol/profile', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const profile = await finnhub.getCompanyProfile(symbol);

    if (!profile || Object.keys(profile).length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

/**
 * GET /api/quotes/:symbol/candles
 * Get historical candle data
 * Query params: resolution (1, 5, 15, 30, 60, D, W, M), from (unix timestamp), to (unix timestamp)
 */
router.get('/:symbol/candles', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { resolution = 'D', from, to } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to timestamps are required' });
    }

    const candles = await finnhub.getCandles(symbol, resolution, from, to);

    if (!candles || candles.s !== 'ok') {
      return res.status(404).json({ error: 'No candle data found for the specified period' });
    }

    res.json(candles);
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: 'Failed to fetch candle data' });
  }
});

/**
 * GET /api/quotes/:symbol/news
 * Get company news
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
router.get('/:symbol/news', async (req, res) => {
  try {
    const { symbol } = req.params;
    let { from, to } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Default to last 7 days if not provided
    if (!to) {
      to = new Date().toISOString().split('T')[0];
    }
    if (!from) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      from = sevenDaysAgo.toISOString().split('T')[0];
    }

    const news = await finnhub.getCompanyNews(symbol, from, to);

    res.json(news || []);
  } catch (error) {
    console.error('Error fetching company news:', error);
    res.status(500).json({ error: 'Failed to fetch company news' });
  }
});

/**
 * GET /api/quotes/:symbol/analysts
 * Get analyst ratings and recommendations via Yahoo Finance
 * Returns: { recommendations, trend, upgrades }
 */
router.get('/:symbol/analysts', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const ratings = await yahooFinanceService.getAnalystRatings(symbol.toUpperCase());

    if (!ratings) {
      return res.status(404).json({ error: 'Analyst ratings not found' });
    }

    res.json(ratings);
  } catch (error) {
    console.error('Error fetching analyst ratings:', error);
    res.status(500).json({ error: 'Failed to fetch analyst ratings' });
  }
});

/**
 * GET /api/quotes/:symbol/insiders
 * Get insider activity and institutional ownership via Yahoo Finance
 * Returns: { transactions, institutions, breakdown }
 */
router.get('/:symbol/insiders', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const insiders = await yahooFinanceService.getInsiderActivity(symbol.toUpperCase());

    if (!insiders) {
      return res.status(404).json({ error: 'Insider activity not found' });
    }

    res.json(insiders);
  } catch (error) {
    console.error('Error fetching insider activity:', error);
    res.status(500).json({ error: 'Failed to fetch insider activity' });
  }
});

export default router;
