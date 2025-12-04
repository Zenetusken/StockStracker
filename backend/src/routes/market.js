import express from 'express';
import finnhub from '../services/finnhub.js';
import yahooFinanceService from '../services/yahoo.js';

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
// Increased TTL to 90s to reduce API calls while maintaining reasonable freshness
const marketCache = new Map();
const CACHE_TTL = 90000; // 90 seconds for market data (increased from 60s)

// Batch cache for indices and sectors (separate from individual cache)
let batchIndicesCache = null;
let batchIndicesCacheTime = 0;
let batchSectorsCache = null;
let batchSectorsCacheTime = 0;

/**
 * Timeout wrapper to prevent API calls from hanging indefinitely
 */
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}

// Request deduplication for concurrent requests
let pendingOverviewRequest = null;

/**
 * Batch fetch quotes for indices or sectors
 * Uses Yahoo batch endpoint (1 API call for all symbols)
 * @param {string[]} symbols - Array of stock symbols
 * @param {string} cacheKey - 'indices' or 'sectors'
 * @returns {Object} Map of symbol -> enriched quote data
 */
async function getBatchCachedQuotes(symbols, cacheKey) {
  // Check cache first
  const cache = cacheKey === 'indices' ? batchIndicesCache : batchSectorsCache;
  const cacheTime = cacheKey === 'indices' ? batchIndicesCacheTime : batchSectorsCacheTime;

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return cache;
  }

  let batchQuotes = {};

  // PRIMARY: Use Yahoo batch endpoint (1 API call)
  if (!yahooFinanceService.isRateLimited()) {
    try {
      batchQuotes = await withTimeout(yahooFinanceService.getBatchQuotes(symbols), 8000);
      console.log(`[Market] Yahoo batch ${cacheKey}: ${Object.keys(batchQuotes).length}/${symbols.length} quotes`);
    } catch (error) {
      console.log(`[Market] Yahoo batch failed for ${cacheKey}: ${error.message}`);
    }
  }

  // FALLBACK: For missing symbols, use Finnhub individual calls
  const missingSymbols = symbols.filter(s => !batchQuotes[s.toUpperCase()]);
  if (missingSymbols.length > 0) {
    console.log(`[Market] Fetching ${missingSymbols.length} missing ${cacheKey} from Finnhub`);
    const fallbackQuotes = await finnhub.getQuotes(missingSymbols);
    Object.assign(batchQuotes, fallbackQuotes);
  }

  // Enrich all quotes
  const enrichedQuotes = {};
  for (const symbol of symbols) {
    const quote = batchQuotes[symbol.toUpperCase()];
    if (quote && quote.c !== 0) {
      enrichedQuotes[symbol] = {
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
      // Also update individual cache
      marketCache.set(symbol, { data: enrichedQuotes[symbol], timestamp: Date.now() });
    }
  }

  // Update batch cache
  if (cacheKey === 'indices') {
    batchIndicesCache = enrichedQuotes;
    batchIndicesCacheTime = Date.now();
  } else {
    batchSectorsCache = enrichedQuotes;
    batchSectorsCacheTime = Date.now();
  }

  return enrichedQuotes;
}

/**
 * Get cached market data or fetch fresh (for individual symbols)
 * Uses Yahoo Finance as PRIMARY provider (higher daily limit, no API key)
 * Falls back to Finnhub if Yahoo fails
 */
async function getCachedQuote(symbol) {
  const cached = marketCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let quote = null;

  // Try Yahoo Finance FIRST (no API key, higher limits)
  if (!yahooFinanceService.isRateLimited()) {
    try {
      quote = await withTimeout(yahooFinanceService.getQuote(symbol), 5000);
    } catch (error) {
      // Yahoo failed or timed out, fall through to Finnhub
    }
  }

  // Fallback to Finnhub if Yahoo didn't work
  if (!quote || quote.c === undefined) {
    try {
      quote = await withTimeout(finnhub.getQuote(symbol), 5000);
    } catch (error) {
      console.log(`[Market] Error fetching ${symbol}:`, error.message);
      return null;
    }
  }

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

  return null;
}

/**
 * GET /api/market/indices
 * Get major market indices with live quotes (#116)
 * Uses batch fetching: 1 API call instead of 5 individual calls
 */
router.get('/indices', async (req, res) => {
  try {
    console.log('[Market] Fetching major indices (batch)...');

    // BATCH FETCH: Get all 5 indices in 1 API call
    const indicesSymbols = MAJOR_INDICES.map(i => i.symbol);
    const batchQuotes = await getBatchCachedQuotes(indicesSymbols, 'indices');

    const indices = MAJOR_INDICES.map(index => ({
      ...index,
      ...batchQuotes[index.symbol],
    }));

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
 * Uses batch fetching: 1 API call instead of 11 individual calls
 */
router.get('/sectors', async (req, res) => {
  try {
    console.log('[Market] Fetching sector performance (batch)...');

    // BATCH FETCH: Get all 11 sectors in 1 API call
    const sectorSymbols = SECTOR_ETFS.map(s => s.symbol);
    const batchQuotes = await getBatchCachedQuotes(sectorSymbols, 'sectors');

    const sectors = SECTOR_ETFS.map(sector => ({
      ...sector,
      ...batchQuotes[sector.symbol],
    }));

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
 * Uses request deduplication to prevent duplicate API calls during concurrent loads
 * OPTIMIZED: Uses batch fetching (2 API calls instead of 16 individual calls)
 */
router.get('/overview', async (req, res) => {
  try {
    // If already fetching, wait for pending result (prevents duplicate API calls)
    if (pendingOverviewRequest) {
      console.log('[Market] Returning deduplicated overview request');
      const result = await pendingOverviewRequest;
      return res.json(result);
    }

    console.log('[Market] Fetching market overview (batch)...');

    // Start the request and store promise for deduplication
    pendingOverviewRequest = (async () => {
      try {
        // BATCH FETCH: Get both indices and sectors in 2 API calls (was 16 calls)
        const [indicesQuotes, sectorsQuotes] = await Promise.all([
          getBatchCachedQuotes(MAJOR_INDICES.map(i => i.symbol), 'indices'),
          getBatchCachedQuotes(SECTOR_ETFS.map(s => s.symbol), 'sectors'),
        ]);

        const indices = MAJOR_INDICES.map(index => ({
          ...index,
          ...indicesQuotes[index.symbol],
        }));

        const sectors = SECTOR_ETFS.map(sector => ({
          ...sector,
          ...sectorsQuotes[sector.symbol],
        }));

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

        return {
          timestamp: Date.now(),
          indices: validIndices,
          sectors: validSectors,
          sentiment,
          breadth: {
            sectorGainers: validSectors.filter(s => s.changePercent > 0).length,
            sectorLosers: validSectors.filter(s => s.changePercent < 0).length,
          },
        };
      } finally {
        // Clear pending request after completion
        pendingOverviewRequest = null;
      }
    })();

    const result = await pendingOverviewRequest;
    res.json(result);
  } catch (error) {
    console.error('[Market] Overview error:', error);
    pendingOverviewRequest = null; // Ensure cleanup on error
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

/**
 * Movers Universe - Popular stocks to track for gainers/losers/active
 * Expanded to 150 stocks with batch fetching (1 API call for all)
 * Covers: Tech, Financials, Healthcare, Consumer, Energy, Industrials, Popular/Meme
 */
const MOVERS_UNIVERSE = [
  // === TECH (40 stocks) ===
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  'CRM', 'AMD', 'INTC', 'CSCO', 'IBM', 'QCOM', 'TXN', 'NOW', 'INTU', 'AMAT',
  'MU', 'LRCX', 'KLAC', 'SNPS', 'CDNS', 'MRVL', 'ADI', 'NXPI', 'FTNT', 'PANW',
  'CRWD', 'ZS', 'DDOG', 'NET', 'SNOW', 'PLTR', 'SHOP', 'SQ', 'PYPL', 'UBER',

  // === FINANCIALS (25 stocks) ===
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BLK', 'SCHW', 'USB',
  'PNC', 'TFC', 'COF', 'AIG', 'MET', 'PRU', 'ALL', 'TRV', 'CB', 'AFL',
  'ICE', 'CME', 'SPGI', 'MCO', 'MSCI',

  // === HEALTHCARE (25 stocks) ===
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BDX', 'ZTS', 'CI',
  'CVS', 'HUM', 'ELV', 'MCK', 'CAH',

  // === CONSUMER (25 stocks) ===
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT',
  'LOW', 'TJX', 'ROST', 'DG', 'DLTR', 'BKNG', 'MAR', 'HLT', 'CMG',
  'DPZ', 'YUM', 'QSR', 'LULU', 'NVR', 'DHI',

  // === ENERGY (15 stocks) ===
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'PSX', 'OXY', 'PXD',
  'DVN', 'HES', 'FANG', 'HAL', 'BKR',

  // === INDUSTRIALS (15 stocks) ===
  'CAT', 'DE', 'UNP', 'UPS', 'HON', 'RTX', 'LMT', 'GE', 'BA', 'MMM',
  'EMR', 'ETN', 'ITW', 'PH', 'ROK',

  // === POPULAR/MEME (5 stocks) ===
  'GME', 'AMC', 'RIVN', 'LCID', 'SOFI',
];
// Total: 150 stocks

// Movers cache (longer TTL since it's computationally expensive)
// Increased from 1 minute to 5 minutes to reduce API calls
let moversCache = null;
let moversCacheTime = 0;
const MOVERS_CACHE_TTL = 300000; // 5 minutes (increased from 1 minute)

/**
 * GET /api/market/movers
 * Get top gainers, losers, and most active stocks (#118, #119, #120)
 * Supports ?fresh=true query param to bypass cache for manual refresh
 */
router.get('/movers', async (req, res) => {
  try {
    const forceRefresh = req.query.fresh === 'true';
    console.log(`[Market] Fetching market movers... (force=${forceRefresh})`);

    // Check cache (skip if force refresh requested)
    if (!forceRefresh && moversCache && Date.now() - moversCacheTime < MOVERS_CACHE_TTL) {
      const cacheAge = Date.now() - moversCacheTime;
      console.log(`[Market] Returning cached movers (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json({ ...moversCache, cached: true, cacheAge });
    }

    // BATCH FETCH: Get all 150 quotes in ONE API call via Yahoo Finance
    // This is 150x more efficient than individual getCachedQuote() calls
    let batchQuotes = {};
    try {
      batchQuotes = await yahooFinanceService.getBatchQuotes(MOVERS_UNIVERSE);
    } catch (error) {
      console.log(`[Market] Batch fetch failed, falling back to individual quotes: ${error.message}`);
      // Fallback to individual quotes if batch fails
      const individualQuotes = await Promise.all(
        MOVERS_UNIVERSE.slice(0, 50).map(async (symbol) => { // Limit fallback to 50
          try {
            const quote = await getCachedQuote(symbol);
            if (quote && quote.price) {
              return [symbol, { c: quote.price, pc: quote.previousClose, v: quote.volume }];
            }
          } catch {
            // Skip failed symbols
          }
          return null;
        })
      );
      batchQuotes = Object.fromEntries(individualQuotes.filter(q => q !== null));
    }

    // Convert batch quotes to array format
    const validQuotes = MOVERS_UNIVERSE
      .filter(symbol => batchQuotes[symbol]?.c)
      .map(symbol => {
        const q = batchQuotes[symbol];
        const change = q.c - (q.pc || q.c);
        const changePercent = q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0;
        return {
          symbol,
          price: q.c,
          change,
          changePercent,
          volume: q.v || 0,
        };
      });

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
      cached: false,
      cacheAge: 0,
    };

    // Update cache
    moversCache = result;
    moversCacheTime = Date.now();

    console.log(`[Market] Returning fresh movers from ${validQuotes.length}/${MOVERS_UNIVERSE.length} stocks: ${gainers.length} gainers, ${losers.length} losers, ${mostActive.length} active`);
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
        description: 'Measures manufacturing sector activity. Above 50 indicates expansion, below 50 indicates contraction.',
        relatedSymbols: ['XLI', 'IYJ'],
      },
      {
        id: 2,
        date: getDateString(weekStart, 2),
        time: '8:30 AM ET',
        event: 'ADP Employment Change',
        importance: 'high',
        previous: '146K',
        forecast: '150K',
        description: 'Estimates private sector employment changes. A leading indicator for the official jobs report.',
        relatedSymbols: ['SPY', 'QQQ'],
      },
      {
        id: 3,
        date: getDateString(weekStart, 3),
        time: '10:00 AM ET',
        event: 'ISM Services PMI',
        importance: 'medium',
        previous: '52.1',
        forecast: '52.5',
        description: 'Measures service sector activity. Services represent about 80% of the US economy.',
        relatedSymbols: ['XLF', 'IYF'],
      },
      {
        id: 4,
        date: getDateString(weekStart, 4),
        time: '8:30 AM ET',
        event: 'Initial Jobless Claims',
        importance: 'medium',
        previous: '215K',
        forecast: '218K',
        description: 'Weekly count of new unemployment benefit filings. Lower numbers indicate a stronger labor market.',
        relatedSymbols: ['TLT', 'IEF'],
      },
      {
        id: 5,
        date: getDateString(weekStart, 5),
        time: '8:30 AM ET',
        event: 'Non-Farm Payrolls',
        importance: 'high',
        previous: '254K',
        forecast: '200K',
        description: 'Monthly jobs added excluding farm workers. One of the most market-moving economic indicators.',
        relatedSymbols: ['SPY', 'DIA'],
      },
      {
        id: 6,
        date: getDateString(weekStart, 5),
        time: '8:30 AM ET',
        event: 'Unemployment Rate',
        importance: 'high',
        previous: '4.1%',
        forecast: '4.1%',
        description: 'Percentage of the labor force that is unemployed. Key indicator of economic health.',
        relatedSymbols: ['SPY', 'VTI'],
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

/**
 * Pre-warm cache on server startup
 * Fetches market data for all indices and sectors to populate cache
 * This ensures the first dashboard load has instant data
 * OPTIMIZED: Uses batch fetching (2 API calls instead of 16 individual calls)
 */
async function prewarmCache() {
  console.log('[Market] Pre-warming cache (batch)...');
  try {
    // BATCH FETCH: Get all indices and sectors in 2 API calls (was 16 individual calls)
    await Promise.all([
      getBatchCachedQuotes(MAJOR_INDICES.map(i => i.symbol), 'indices'),
      getBatchCachedQuotes(SECTOR_ETFS.map(s => s.symbol), 'sectors'),
    ]);

    const totalSymbols = MAJOR_INDICES.length + SECTOR_ETFS.length;
    console.log(`[Market] Cache pre-warmed with ${totalSymbols} symbols (2 batch calls)`);
  } catch (error) {
    console.log('[Market] Cache pre-warm failed:', error.message);
  }
}

// Pre-warm cache 5 seconds after server starts
setTimeout(prewarmCache, 5000);

export default router;
