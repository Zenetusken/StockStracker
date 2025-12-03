import express from 'express';
import finnhub from '../services/finnhub.js';

const router = express.Router();

/**
 * GET /api/news/:symbol
 * Get company-specific news articles
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
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
    console.error('Error fetching company news:', error);
    res.status(500).json({ error: 'Failed to fetch company news' });
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
