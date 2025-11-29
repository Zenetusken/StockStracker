import express from 'express';
import finnhub from '../services/finnhub.js';

const router = express.Router();

/**
 * GET /api/search
 * Search for stock symbols and companies
 * Query params: q (search query)
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ count: 0, result: [] });
    }

    const searchResults = await finnhub.searchSymbols(q.trim());

    // Filter and format results
    const results = (searchResults.result || [])
      .filter(item => {
        // Filter out unwanted types and ensure US stocks are prioritized
        const isUSStock = item.type === 'Common Stock' || item.type === 'ETP';
        return isUSStock;
      })
      .slice(0, 20) // Limit to 20 results
      .map(item => ({
        symbol: item.symbol,
        displaySymbol: item.displaySymbol,
        description: item.description,
        type: item.type,
      }));

    res.json({
      count: results.length,
      result: results
    });
  } catch (error) {
    console.error('Error searching symbols:', error);
    res.status(500).json({ error: 'Failed to search symbols' });
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

export default router;
