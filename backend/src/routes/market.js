import express from 'express';
import finnhub from '../services/finnhub.js';

const router = express.Router();

/**
 * Major Indices - using ETF proxies since Finnhub free tier doesn't support index symbols
 * #116: Major indices (S&P 500, Dow, Nasdaq) with live updates
 */
const MAJOR_INDICES = [
  { symbol: 'SPY', name: 'S&P 500', displaySymbol: 'SPX' },
  { symbol: 'DIA', name: 'Dow Jones', displaySymbol: 'DJI' },
  { symbol: 'QQQ', name: 'Nasdaq 100', displaySymbol: 'NDX' },
  { symbol: 'IWM', name: 'Russell 2000', displaySymbol: 'RUT' },
  { symbol: 'VIX', name: 'Volatility Index', displaySymbol: 'VIX' },
];

/**
 * Sector ETFs for sector performance heatmap
 * #117: Sector performance heatmap
 */
const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology', color: '#3B82F6' },
  { symbol: 'XLF', name: 'Financials', color: '#10B981' },
  { symbol: 'XLV', name: 'Healthcare', color: '#EC4899' },
  { symbol: 'XLE', name: 'Energy', color: '#F59E0B' },
  { symbol: 'XLI', name: 'Industrials', color: '#6366F1' },
  { symbol: 'XLY', name: 'Consumer Disc.', color: '#8B5CF6' },
  { symbol: 'XLP', name: 'Consumer Staples', color: '#14B8A6' },
  { symbol: 'XLRE', name: 'Real Estate', color: '#F97316' },
  { symbol: 'XLU', name: 'Utilities', color: '#EF4444' },
  { symbol: 'XLB', name: 'Materials', color: '#84CC16' },
  { symbol: 'XLC', name: 'Communication', color: '#06B6D4' },
];

// Cache for market data
const marketCache = new Map();
const CACHE_TTL = 30000; // 30 seconds for market data

/**
 * Get cached market data or fetch fresh
 */
async function getCachedQuote(symbol) {
  const cached = marketCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const quote = await finnhub.getQuote(symbol);
    if (quote && quote.c !== 0) {
      const enriched = {
        symbol,
        price: quote.c,
        change: quote.c - quote.pc,
        changePercent: quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : 0,
        high: quote.h,
        low: quote.l,
        open: quote.o,
        previousClose: quote.pc,
      };
      marketCache.set(symbol, { data: enriched, timestamp: Date.now() });
      return enriched;
    }
  } catch (error) {
    console.log(`[Market] Error fetching ${symbol}:`, error.message);
  }
  return null;
}

/**
 * GET /api/market/indices
 * Get major market indices with live quotes (#116)
 */
router.get('/indices', async (req, res) => {
  try {
    console.log('[Market] Fetching major indices...');

    const indices = await Promise.all(
      MAJOR_INDICES.map(async (index) => {
        const quote = await getCachedQuote(index.symbol);
        return {
          ...index,
          ...quote,
        };
      })
    );

    const validIndices = indices.filter(idx => idx.price != null);
    console.log(`[Market] Returning ${validIndices.length} indices`);

    res.json({
      timestamp: Date.now(),
      indices: validIndices,
    });
  } catch (error) {
    console.error('[Market] Indices error:', error);
    res.status(500).json({ error: 'Failed to fetch market indices' });
  }
});

/**
 * GET /api/market/sectors
 * Get sector performance for heatmap (#117)
 */
router.get('/sectors', async (req, res) => {
  try {
    console.log('[Market] Fetching sector performance...');

    const sectors = await Promise.all(
      SECTOR_ETFS.map(async (sector) => {
        const quote = await getCachedQuote(sector.symbol);
        return {
          ...sector,
          ...quote,
        };
      })
    );

    // Sort by change percent for ranking
    const validSectors = sectors
      .filter(s => s.price != null)
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

    // Calculate market breadth
    const gainers = validSectors.filter(s => s.changePercent > 0).length;
    const losers = validSectors.filter(s => s.changePercent < 0).length;
    const unchanged = validSectors.filter(s => s.changePercent === 0).length;

    console.log(`[Market] Returning ${validSectors.length} sectors`);

    res.json({
      timestamp: Date.now(),
      sectors: validSectors,
      breadth: {
        gainers,
        losers,
        unchanged,
        total: validSectors.length,
      },
    });
  } catch (error) {
    console.error('[Market] Sectors error:', error);
    res.status(500).json({ error: 'Failed to fetch sector performance' });
  }
});

/**
 * GET /api/market/overview
 * Get combined market overview (indices + sectors)
 */
router.get('/overview', async (req, res) => {
  try {
    console.log('[Market] Fetching market overview...');

    // Fetch both in parallel
    const [indices, sectors] = await Promise.all([
      Promise.all(
        MAJOR_INDICES.map(async (index) => {
          const quote = await getCachedQuote(index.symbol);
          return { ...index, ...quote };
        })
      ),
      Promise.all(
        SECTOR_ETFS.map(async (sector) => {
          const quote = await getCachedQuote(sector.symbol);
          return { ...sector, ...quote };
        })
      ),
    ]);

    const validIndices = indices.filter(idx => idx.price != null);
    const validSectors = sectors
      .filter(s => s.price != null)
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

    // Market sentiment (based on index performance)
    const spyChange = validIndices.find(i => i.symbol === 'SPY')?.changePercent || 0;
    let sentiment = 'neutral';
    if (spyChange > 1) sentiment = 'bullish';
    else if (spyChange > 0.3) sentiment = 'slightly-bullish';
    else if (spyChange < -1) sentiment = 'bearish';
    else if (spyChange < -0.3) sentiment = 'slightly-bearish';

    res.json({
      timestamp: Date.now(),
      indices: validIndices,
      sectors: validSectors,
      sentiment,
      breadth: {
        sectorGainers: validSectors.filter(s => s.changePercent > 0).length,
        sectorLosers: validSectors.filter(s => s.changePercent < 0).length,
      },
    });
  } catch (error) {
    console.error('[Market] Overview error:', error);
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

export default router;
