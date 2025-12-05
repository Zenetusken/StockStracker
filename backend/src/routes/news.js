import express from 'express';
import finnhub from '../services/finnhub.js';
import yahoo from '../services/yahoo.js';

const router = express.Router();

/**
 * Check if a symbol is a non-US stock (Canadian, etc.)
 * Finnhub has limited support for international stocks
 */
function isNonUSSymbol(symbol) {
  const upperSymbol = symbol.toUpperCase();
  // Canadian exchanges: .TO (TSX), .V (TSXV), .CN (CSE)
  // Other international: .L (London), .PA (Paris), .DE (Frankfurt)
  return /\.(TO|V|CN|L|PA|DE|AX|HK|SS|SZ)$/i.test(upperSymbol);
}

/**
 * GET /api/news/:symbol
 * Get company-specific news articles
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 *
 * Note: Finnhub has limited support for international stocks.
 * For Canadian/international stocks, returns empty array gracefully.
 */
router.get('/:symbol', async (req, res) => {
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

    // For non-US stocks (Canadian, etc.), use Yahoo Finance instead of Finnhub
    // Finnhub has limited support for international stocks
    if (isNonUSSymbol(symbol)) {
      console.log(`[News] Using Yahoo for non-US symbol: ${symbol}`);
      const yahooNews = await yahoo.getCompanyNews(symbol.toUpperCase(), 15);
      return res.json(yahooNews || []);
    }

    const news = await finnhub.getCompanyNews(symbol, from, to);

    // Transform news items to consistent format
    const transformedNews = (news || []).map(item => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image || null,
      datetime: item.datetime,
      related: item.related || symbol.toUpperCase(),
      category: item.category || 'company news',
    })).slice(0, 20); // Limit to 20 articles

    res.json(transformedNews);
  } catch (error) {
    console.error('Error fetching company news:', error.message);
    // Return empty array instead of 500 for graceful degradation
    res.json([]);
  }
});

/**
 * GET /api/news/market/canada
 * Get Canadian market news via Yahoo Finance
 */
router.get('/market/canada', async (req, res) => {
  try {
    const news = await yahoo.getCanadianNews();

    // Transform to standard article format (matching Finnhub structure)
    const transformedNews = (news || []).map(item => ({
      id: item.uuid || `yahoo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      headline: item.title,
      summary: null, // Yahoo search doesn't include summaries
      source: item.publisher,
      url: item.link,
      image: item.thumbnail?.resolutions?.[0]?.url || null,
      datetime: item.providerPublishTime || Math.floor(Date.now() / 1000),
      related: (item.relatedTickers || []).join(','),
      category: 'canada',
    }));

    res.json(transformedNews);
  } catch (error) {
    console.error('Error fetching Canadian news:', error.message);
    res.json([]); // Graceful degradation
  }
});

/**
 * GET /api/news/market/general
 * Get general market news
 * Query params: category (general, forex, crypto, merger)
 */
router.get('/market/general', async (req, res) => {
  try {
    const { category = 'general' } = req.query;

    const news = await finnhub.getMarketNews(category);

    // Transform news items to consistent format
    const transformedNews = (news || []).map(item => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image || null,
      datetime: item.datetime,
      related: item.related || '',
      category: item.category || category,
    })).slice(0, 30); // Limit to 30 articles

    res.json(transformedNews);
  } catch (error) {
    console.error('Error fetching market news:', error);
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

export default router;
