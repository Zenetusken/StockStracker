import express from 'express';
import finnhub from '../services/finnhub.js';

const router = express.Router();

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
 * Get quotes for multiple symbols at once
 * Body: { symbols: ['AAPL', 'GOOGL', 'MSFT'] }
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

    const quotes = await finnhub.getQuotes(symbols);

    // Enrich each quote
    const enrichedQuotes = {};
    Object.entries(quotes).forEach(([symbol, quoteData]) => {
      const enriched = finnhub.enrichQuote(symbol, quoteData);
      if (enriched) {
        enrichedQuotes[symbol] = enriched;
      }
    });

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

    const profiles = {};
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const profile = await finnhub.getCompanyProfile(symbol);
          if (profile && profile.name) {
            profiles[symbol.toUpperCase()] = profile;
          }
        } catch (err) {
          console.log(`Could not fetch profile for ${symbol}:`, err.message);
        }
      })
    );

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

export default router;
