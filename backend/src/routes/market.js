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
        volume: quote.v || 0,
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

/**
 * Movers Universe - Popular stocks to track for gainers/losers/active
 * Using a subset of the screener universe for faster response
 */
const MOVERS_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  'CRM', 'AMD', 'INTC', 'CSCO', 'IBM', 'QCOM', 'TXN', 'NOW', 'INTU', 'AMAT',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BLK', 'SCHW', 'USB',
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT',
];

// Movers cache (longer TTL since it's computationally expensive)
let moversCache = null;
let moversCacheTime = 0;
const MOVERS_CACHE_TTL = 60000; // 1 minute

/**
 * GET /api/market/movers
 * Get top gainers, losers, and most active stocks (#118, #119, #120)
 */
router.get('/movers', async (req, res) => {
  try {
    console.log('[Market] Fetching market movers...');

    // Check cache
    if (moversCache && Date.now() - moversCacheTime < MOVERS_CACHE_TTL) {
      console.log('[Market] Returning cached movers');
      return res.json(moversCache);
    }

    // Fetch quotes for all movers universe using shared cache
    const quotes = await Promise.all(
      MOVERS_UNIVERSE.map(async (symbol) => {
        try {
          // Use getCachedQuote instead of finnhub.getQuote directly
          // This leverages the 30-second market cache, reducing API calls significantly
          const quote = await getCachedQuote(symbol);
          if (quote && quote.price) {
            return {
              symbol,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume || 0,
            };
          }
        } catch {
          // Skip failed symbols
        }
        return null;
      })
    );

    const validQuotes = quotes.filter(q => q !== null);

    // Sort for gainers (highest % change)
    const gainers = [...validQuotes]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10);

    // Sort for losers (lowest % change)
    const losers = [...validQuotes]
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 10);

    // Sort for most active (highest volume)
    const mostActive = [...validQuotes]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    const result = {
      timestamp: Date.now(),
      gainers,
      losers,
      mostActive,
    };

    // Update cache
    moversCache = result;
    moversCacheTime = Date.now();

    console.log(`[Market] Returning movers: ${gainers.length} gainers, ${losers.length} losers, ${mostActive.length} active`);
    res.json(result);
  } catch (error) {
    console.error('[Market] Movers error:', error);
    res.status(500).json({ error: 'Failed to fetch market movers' });
  }
});

/**
 * GET /api/market/status
 * Get market status (open/closed) with countdown (#121)
 */
router.get('/status', (req, res) => {
  try {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = nyTime.getDay();
    const hours = nyTime.getHours();
    const minutes = nyTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    // Market hours: 9:30 AM - 4:00 PM ET
    const marketOpen = 9 * 60 + 30;  // 9:30 AM
    const marketClose = 16 * 60;      // 4:00 PM

    // Pre-market: 4:00 AM - 9:30 AM
    const preMarketOpen = 4 * 60;
    // After-hours: 4:00 PM - 8:00 PM
    const afterHoursClose = 20 * 60;

    let status = 'closed';
    let nextEvent = null;
    let minutesUntil = 0;
    let isWeekend = false;

    if (day === 0 || day === 6) {
      // Weekend
      isWeekend = true;
      status = 'closed';
      // Calculate minutes until Monday 9:30 AM
      const daysUntilMonday = day === 0 ? 1 : 2;
      minutesUntil = (daysUntilMonday * 24 * 60) + (marketOpen - currentMinutes);
      nextEvent = 'market-open';
    } else if (currentMinutes >= preMarketOpen && currentMinutes < marketOpen) {
      // Pre-market
      status = 'pre-market';
      minutesUntil = marketOpen - currentMinutes;
      nextEvent = 'market-open';
    } else if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
      // Market open
      status = 'open';
      minutesUntil = marketClose - currentMinutes;
      nextEvent = 'market-close';
    } else if (currentMinutes >= marketClose && currentMinutes < afterHoursClose) {
      // After hours
      status = 'after-hours';
      minutesUntil = afterHoursClose - currentMinutes;
      nextEvent = 'after-hours-close';
    } else {
      // Closed (before pre-market or after after-hours)
      status = 'closed';
      if (currentMinutes < preMarketOpen) {
        minutesUntil = preMarketOpen - currentMinutes;
        nextEvent = 'pre-market-open';
      } else {
        // After 8 PM, calculate to next day
        minutesUntil = (24 * 60 - currentMinutes) + preMarketOpen;
        nextEvent = 'pre-market-open';
        // If Friday after hours, skip to Monday
        if (day === 5 && currentMinutes >= afterHoursClose) {
          minutesUntil += 2 * 24 * 60;
        }
      }
    }

    // Format countdown
    const hoursUntil = Math.floor(minutesUntil / 60);
    const minsUntil = minutesUntil % 60;

    res.json({
      timestamp: Date.now(),
      status,
      isWeekend,
      nextEvent,
      countdown: {
        hours: hoursUntil,
        minutes: minsUntil,
        totalMinutes: minutesUntil,
        formatted: `${hoursUntil}h ${minsUntil}m`,
      },
      currentTime: {
        nyTime: nyTime.toISOString(),
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ET`,
      },
    });
  } catch (error) {
    console.error('[Market] Status error:', error);
    res.status(500).json({ error: 'Failed to get market status' });
  }
});

/**
 * GET /api/market/calendar
 * Get economic calendar highlights (#122)
 * Note: Using static data since Finnhub free tier doesn't include economic calendar
 */
router.get('/calendar', (req, res) => {
  try {
    // Get current week dates
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    // Mock economic calendar data (in production, this would come from an API)
    const events = [
      {
        id: 1,
        date: getDateString(weekStart, 1),
        time: '10:00 AM ET',
        event: 'ISM Manufacturing PMI',
        importance: 'high',
        previous: '48.7',
        forecast: '49.0',
      },
      {
        id: 2,
        date: getDateString(weekStart, 2),
        time: '8:30 AM ET',
        event: 'ADP Employment Change',
        importance: 'high',
        previous: '146K',
        forecast: '150K',
      },
      {
        id: 3,
        date: getDateString(weekStart, 3),
        time: '10:00 AM ET',
        event: 'ISM Services PMI',
        importance: 'medium',
        previous: '52.1',
        forecast: '52.5',
      },
      {
        id: 4,
        date: getDateString(weekStart, 4),
        time: '8:30 AM ET',
        event: 'Initial Jobless Claims',
        importance: 'medium',
        previous: '215K',
        forecast: '218K',
      },
      {
        id: 5,
        date: getDateString(weekStart, 5),
        time: '8:30 AM ET',
        event: 'Non-Farm Payrolls',
        importance: 'high',
        previous: '254K',
        forecast: '200K',
      },
      {
        id: 6,
        date: getDateString(weekStart, 5),
        time: '8:30 AM ET',
        event: 'Unemployment Rate',
        importance: 'high',
        previous: '4.1%',
        forecast: '4.1%',
      },
    ];

    res.json({
      timestamp: Date.now(),
      weekStart: weekStart.toISOString().split('T')[0],
      events,
    });
  } catch (error) {
    console.error('[Market] Calendar error:', error);
    res.status(500).json({ error: 'Failed to get economic calendar' });
  }
});

/**
 * Helper to get date string for a day offset from start
 */
function getDateString(weekStart, dayOffset) {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

export default router;
