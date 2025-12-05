import express from 'express';
import finnhub from '../services/finnhub.js';
import yahooFinanceService from '../services/yahoo.js';

const router = express.Router();

/**
 * Major Indices - using actual Yahoo Finance index symbols for accurate values
 * Yahoo's getQuote endpoint supports ^GSPC, ^DJI, etc. (unlike spark batch endpoint)
 * #116: Major indices (S&P 500, Dow, Nasdaq) with live updates
 */
const MAJOR_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', displaySymbol: 'SPX', isIndex: true },
  { symbol: '^DJI', name: 'Dow Jones', displaySymbol: 'DJI', isIndex: true },
  { symbol: '^IXIC', name: 'Nasdaq', displaySymbol: 'NDX', isIndex: true },
  { symbol: '^RUT', name: 'Russell 2000', displaySymbol: 'RUT', isIndex: true },
  { symbol: '^VIX', name: 'VIX', displaySymbol: 'VIX', isIndex: true },
  { symbol: '^GSPTSE', name: 'TSX Composite', displaySymbol: 'TSX', isIndex: true },
  { symbol: 'GC=F', name: 'Gold Futures', displaySymbol: 'Gold', isIndex: true },
  { symbol: '^TNX', name: '10-Year Treasury', displaySymbol: 'TNX', isIndex: true },
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

// YTD performance cache (1 hour TTL - YTD data changes slowly)
let ytdPerformanceCache = null;
let ytdPerformanceCacheTime = 0;
const YTD_CACHE_TTL = 3600000; // 1 hour

// ============================================================================
// UNIFIED SCREENER CACHE - Shared across /movers, /movers/enhanced endpoints
// Prevents duplicate API calls when both endpoints request same screener data
// ============================================================================
const screenerCache = new Map();
const SCREENER_CACHE_TTL = 300000; // 5 minutes

/**
 * Get cached screener results or fetch fresh
 * Uses unified cache to prevent duplicate screener API calls
 * Also caches smaller slices (25 → 10) for efficiency
 * @param {string} type - Screener type (day_gainers, day_losers, etc.)
 * @param {number} count - Number of results to fetch
 * @param {boolean} forceRefresh - Bypass cache when true (for manual refresh)
 * @returns {Array} Screener results
 */
async function getCachedScreener(type, count, forceRefresh = false) {
  const cacheKey = `${type}:${count}`;
  const cached = screenerCache.get(cacheKey);

  // Skip cache if forceRefresh requested
  if (!forceRefresh && cached && Date.now() - cached.timestamp < SCREENER_CACHE_TTL) {
    console.log(`[Market] Screener cache hit: ${cacheKey}`);
    return cached.data;
  }

  if (forceRefresh) {
    console.log(`[Market] Screener force refresh: ${cacheKey}`);
  }

  // Fetch fresh data
  const data = await yahooFinanceService.getMarketMovers(type, count);

  if (data && data.length > 0) {
    screenerCache.set(cacheKey, { data, timestamp: Date.now() });

    // Also cache smaller slices for efficiency
    // This prevents redundant API calls when different endpoints need different counts
    if (count >= 50) {
      // Cache 25-result slice
      screenerCache.set(`${type}:25`, {
        data: data.slice(0, 25),
        timestamp: Date.now(),
      });
      // Cache 10-result slice
      screenerCache.set(`${type}:10`, {
        data: data.slice(0, 10),
        timestamp: Date.now(),
      });
    } else if (count >= 25) {
      // Cache 10-result slice
      screenerCache.set(`${type}:10`, {
        data: data.slice(0, 10),
        timestamp: Date.now(),
      });
    }
    console.log(`[Market] Screener cached: ${cacheKey} (${data.length} results)`);
  }

  return data;
}

/**
 * Filter symbols to only fetch those not already in marketCache
 * Reduces redundant API calls by reusing recently-fetched quotes
 * @param {string[]} symbols - Symbols to check
 * @param {number} maxAge - Max cache age in ms (default: CACHE_TTL)
 * @returns {Object} { toFetch: [], cached: {} }
 */
function filterCachedSymbols(symbols, maxAge = CACHE_TTL) {
  const toFetch = [];
  const cached = {};

  for (const symbol of symbols) {
    const entry = marketCache.get(symbol);
    if (entry && Date.now() - entry.timestamp < maxAge) {
      cached[symbol] = entry.data;
    } else {
      toFetch.push(symbol);
    }
  }

  if (Object.keys(cached).length > 0) {
    console.log(`[Market] Symbol cache: ${Object.keys(cached).length} cached, ${toFetch.length} to fetch`);
  }

  return { toFetch, cached };
}

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
 * Fetch index quotes individually (Yahoo batch/spark doesn't support ^symbols)
 * Uses Yahoo getQuote which supports index symbols like ^GSPC, ^DJI, ^VIX
 * @param {Array} indexConfigs - Array of {symbol, name, displaySymbol, isIndex}
 * @param {boolean} forceRefresh - Bypass cache when true (for manual refresh)
 * @returns {Object} Map of symbol -> enriched quote data
 */
async function getIndexQuotes(indexConfigs, forceRefresh = false) {
  // Check cache first (skip if forceRefresh)
  if (!forceRefresh && batchIndicesCache && Date.now() - batchIndicesCacheTime < CACHE_TTL) {
    return batchIndicesCache;
  }

  if (forceRefresh) {
    console.log('[Market] Index quotes force refresh');
  }

  const enrichedQuotes = {};

  // Fetch each index individually (Yahoo quote endpoint supports ^symbols)
  const fetchPromises = indexConfigs.map(async (config) => {
    try {
      const quote = await withTimeout(yahooFinanceService.getQuote(config.symbol), 5000);
      if (quote && quote.c !== 0) {
        enrichedQuotes[config.symbol] = {
          symbol: config.symbol,
          price: quote.c,
          change: quote.c - quote.pc,
          changePercent: quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : 0,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          previousClose: quote.pc,
          volume: quote.v || 0,
        };
        marketCache.set(config.symbol, { data: enrichedQuotes[config.symbol], timestamp: Date.now() });
      }
    } catch (error) {
      console.log(`[Market] Failed to fetch index ${config.symbol}: ${error.message}`);
    }
  });

  await Promise.all(fetchPromises);
  console.log(`[Market] Yahoo indices: ${Object.keys(enrichedQuotes).length}/${indexConfigs.length} quotes`);

  // Update cache
  batchIndicesCache = enrichedQuotes;
  batchIndicesCacheTime = Date.now();

  return enrichedQuotes;
}

/**
 * Batch fetch quotes for sectors (ETFs only - not index symbols)
 * Uses Yahoo batch endpoint (1 API call for all symbols)
 * @param {string[]} symbols - Array of stock symbols
 * @param {boolean} forceRefresh - Bypass cache when true (for manual refresh)
 * @returns {Object} Map of symbol -> enriched quote data
 */
async function getSectorQuotes(symbols, forceRefresh = false) {
  // Check cache first (skip if forceRefresh)
  if (!forceRefresh && batchSectorsCache && Date.now() - batchSectorsCacheTime < CACHE_TTL) {
    return batchSectorsCache;
  }

  if (forceRefresh) {
    console.log('[Market] Sector quotes force refresh');
  }

  let batchQuotes = {};

  // PRIMARY: Use Yahoo batch endpoint (1 API call)
  if (!yahooFinanceService.isRateLimited()) {
    try {
      batchQuotes = await withTimeout(yahooFinanceService.getBatchQuotes(symbols), 8000);
      console.log(`[Market] Yahoo batch sectors: ${Object.keys(batchQuotes).length}/${symbols.length} quotes`);
    } catch (error) {
      console.log(`[Market] Yahoo batch failed for sectors: ${error.message}`);
    }
  }

  // FALLBACK: For missing symbols, use Finnhub individual calls
  const missingSymbols = symbols.filter(s => !batchQuotes[s.toUpperCase()]);
  if (missingSymbols.length > 0) {
    console.log(`[Market] Fetching ${missingSymbols.length} missing sectors from Finnhub`);
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
      marketCache.set(symbol, { data: enrichedQuotes[symbol], timestamp: Date.now() });
    }
  }

  // Update cache
  batchSectorsCache = enrichedQuotes;
  batchSectorsCacheTime = Date.now();

  return enrichedQuotes;
}

/**
 * Fetch YTD performance data for all sector ETFs
 * Uses Yahoo Finance chart API with 'ytd' range to get year-to-date candles
 * Calculates YTD change from first trading day of year to current price
 * @returns {Object} Map of symbol -> { ytdChangePercent, ytdOpenPrice, currentPrice }
 */
async function fetchYTDData() {
  // Check cache first (1 hour TTL)
  if (ytdPerformanceCache && Date.now() - ytdPerformanceCacheTime < YTD_CACHE_TTL) {
    const cacheAge = Math.round((Date.now() - ytdPerformanceCacheTime) / 1000);
    console.log(`[Market] YTD cache hit (age: ${cacheAge}s)`);
    return ytdPerformanceCache;
  }

  console.log('[Market] Fetching YTD performance data...');
  const ytdData = {};

  // Fetch YTD candles for each sector ETF in parallel
  const fetchPromises = SECTOR_ETFS.map(async (sector) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sector.symbol}?interval=1d&range=ytd`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      if (!response.ok) {
        console.log(`[Market] YTD fetch failed for ${sector.symbol}: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        console.log(`[Market] No YTD data for ${sector.symbol}`);
        return;
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      const opens = quotes.open;
      const closes = quotes.close;

      // Find first valid 2025 candle (Jan 2 is first trading day)
      const jan2Timestamp = new Date(new Date().getFullYear(), 0, 2).getTime() / 1000;
      let firstYTDIndex = 0;
      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] >= jan2Timestamp && opens[i] != null) {
          firstYTDIndex = i;
          break;
        }
      }

      // Detect stock splits: look for large single-day drops (>40%) in the data
      // Yahoo Finance doesn't immediately back-adjust historical data after splits
      let splitRatio = 1;
      for (let i = firstYTDIndex + 1; i < closes.length; i++) {
        const prevClose = closes[i - 1];
        const currClose = closes[i];
        if (prevClose && currClose && prevClose > 0) {
          const dayChange = (currClose - prevClose) / prevClose;
          // Detect ~50% drop (2:1 split) or ~67% drop (3:1 split)
          if (dayChange < -0.40 && dayChange > -0.75) {
            // Calculate split ratio: e.g., -50% = ratio of 2
            const detectedRatio = Math.round(prevClose / currClose);
            if (detectedRatio >= 2) {
              splitRatio *= detectedRatio;
              console.log(`[Market] Detected ${detectedRatio}:1 split for ${sector.symbol} (${prevClose.toFixed(2)} -> ${currClose.toFixed(2)})`);
            }
          }
        }
      }

      let ytdOpenPrice = opens[firstYTDIndex];
      const currentPrice = closes[closes.length - 1];

      // Apply split adjustment to historical opening price
      if (splitRatio > 1) {
        const adjustedOpen = ytdOpenPrice / splitRatio;
        console.log(`[Market] Adjusting ${sector.symbol} YTD open: $${ytdOpenPrice.toFixed(2)} / ${splitRatio} = $${adjustedOpen.toFixed(2)}`);
        ytdOpenPrice = adjustedOpen;
      }

      if (ytdOpenPrice && currentPrice) {
        const ytdChangePercent = ((currentPrice - ytdOpenPrice) / ytdOpenPrice) * 100;
        // Data validation logging - verify YTD calculation
        console.log(`[Market] YTD ${sector.symbol}: open=$${ytdOpenPrice.toFixed(2)}, current=$${currentPrice.toFixed(2)}, change=${ytdChangePercent.toFixed(2)}%${splitRatio > 1 ? ' (split-adjusted)' : ''}`);
        ytdData[sector.symbol] = {
          ytdChangePercent: Math.round(ytdChangePercent * 100) / 100,
          ytdChange: Math.round((currentPrice - ytdOpenPrice) * 100) / 100,
          ytdOpenPrice: Math.round(ytdOpenPrice * 100) / 100,
          currentPrice: Math.round(currentPrice * 100) / 100,
          splitAdjusted: splitRatio > 1,
        };
      }
    } catch (error) {
      console.log(`[Market] YTD error for ${sector.symbol}: ${error.message}`);
    }
  });

  await Promise.all(fetchPromises);
  console.log(`[Market] YTD data fetched for ${Object.keys(ytdData).length}/${SECTOR_ETFS.length} sectors`);

  // Update cache
  ytdPerformanceCache = ytdData;
  ytdPerformanceCacheTime = Date.now();

  return ytdData;
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
 * Uses Yahoo getQuote for actual index values (^GSPC, ^DJI, ^VIX, etc.)
 */
router.get('/indices', async (req, res) => {
  try {
    console.log('[Market] Fetching major indices...');

    // Fetch actual index quotes (Yahoo getQuote supports ^symbols)
    const indexQuotes = await getIndexQuotes(MAJOR_INDICES);

    const indices = MAJOR_INDICES.map(index => ({
      ...index,
      ...indexQuotes[index.symbol],
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
    const sectorQuotes = await getSectorQuotes(sectorSymbols);

    const sectors = SECTOR_ETFS.map(sector => ({
      ...sector,
      ...sectorQuotes[sector.symbol],
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
 * GET /api/market/sectors/performance
 * Get sector performance with both daily AND YTD data
 * Combines current quotes with year-to-date performance for trend analysis
 */
router.get('/sectors/performance', async (req, res) => {
  try {
    const forceRefresh = req.query.fresh === 'true';
    console.log(`[Market] Fetching sector performance with YTD data... (force=${forceRefresh})`);

    // Fetch both daily quotes and YTD data in parallel
    // Pass forceRefresh to bypass cache when user clicks refresh
    const [sectorQuotes, ytdData] = await Promise.all([
      getSectorQuotes(SECTOR_ETFS.map(s => s.symbol), forceRefresh),
      fetchYTDData(),
    ]);

    // Combine daily and YTD data for each sector
    const sectors = SECTOR_ETFS.map(sector => {
      const daily = sectorQuotes[sector.symbol] || {};
      const ytd = ytdData[sector.symbol] || {};

      return {
        symbol: sector.symbol,
        name: sector.name,
        color: sector.color,
        price: daily.price,
        daily: {
          change: daily.change,
          changePercent: daily.changePercent,
        },
        ytd: {
          change: ytd.ytdChange,
          changePercent: ytd.ytdChangePercent,
          openPrice: ytd.ytdOpenPrice,
        },
      };
    }).filter(s => s.price != null);

    // Calculate rankings
    const sortedByDaily = [...sectors].sort((a, b) =>
      (b.daily.changePercent || 0) - (a.daily.changePercent || 0)
    );
    const sortedByYTD = [...sectors].sort((a, b) =>
      (b.ytd.changePercent || 0) - (a.ytd.changePercent || 0)
    );

    // Add rank to each sector
    sectors.forEach(sector => {
      sector.rank = {
        daily: sortedByDaily.findIndex(s => s.symbol === sector.symbol) + 1,
        ytd: sortedByYTD.findIndex(s => s.symbol === sector.symbol) + 1,
      };
    });

    // Sort by YTD performance for default display
    sectors.sort((a, b) => (b.ytd.changePercent || 0) - (a.ytd.changePercent || 0));

    // Calculate breadth
    const dailyGainers = sectors.filter(s => (s.daily.changePercent || 0) > 0).length;
    const dailyLosers = sectors.filter(s => (s.daily.changePercent || 0) < 0).length;
    const ytdGainers = sectors.filter(s => (s.ytd.changePercent || 0) > 0).length;
    const ytdLosers = sectors.filter(s => (s.ytd.changePercent || 0) < 0).length;

    // Cache age for frontend display
    const cacheAge = ytdPerformanceCacheTime
      ? Math.round((Date.now() - ytdPerformanceCacheTime) / 1000)
      : 0;

    // Generate sector analysis
    const analysis = generateSectorAnalysis(sectors, {
      daily: { gainers: dailyGainers, losers: dailyLosers },
      ytd: { gainers: ytdGainers, losers: ytdLosers },
    });

    console.log(`[Market] Returning ${sectors.length} sectors with YTD data and analysis`);

    res.json({
      timestamp: Date.now(),
      sectors,
      breadth: {
        daily: { gainers: dailyGainers, losers: dailyLosers },
        ytd: { gainers: ytdGainers, losers: ytdLosers },
      },
      analysis,
      cacheAge,
    });
  } catch (error) {
    console.error('[Market] Sectors performance error:', error);
    res.status(500).json({ error: 'Failed to fetch sector performance' });
  }
});

/**
 * Sector classification for rotation analysis
 * Cyclical sectors tend to outperform in expansions, defensive in contractions
 */
const CYCLICAL_SECTORS = ['XLK', 'XLY', 'XLF', 'XLI', 'XLB', 'XLE', 'XLC']; // Tech, Consumer Disc, Financials, Industrials, Materials, Energy, Communication
const DEFENSIVE_SECTORS = ['XLV', 'XLP', 'XLU', 'XLRE']; // Healthcare, Consumer Staples, Utilities, Real Estate

/**
 * Calculate production-ready market sentiment using multiple factors:
 *
 * DAILY FACTORS (65% total weight):
 * - SPX (S&P 500) daily change: Primary directional signal (30%)
 * - VIX (Volatility Index): Fear/greed modifier (18%)
 * - Sector Breadth (Daily): Market participation (12%)
 * - Multi-index consensus: DJI, NDX, RUT agreement (5%)
 *
 * YTD TREND FACTORS (35% total weight):
 * - YTD Sector Breadth: Sustained trend confirmation (12%)
 * - Sector Rotation Signal: Cyclical vs Defensive leadership (15%)
 * - Divergence Detection: Daily/YTD rank inconsistency warning (8%)
 *
 * @param {Array} indices - Array of index objects with changePercent, price
 * @param {Array} sectors - Array of sector objects with changePercent
 * @param {Object} ytdData - Optional YTD data map { symbol: { ytdChangePercent } }
 * @returns {Object} { score, label, confidence, factors, timestamp }
 */
function calculateMarketSentiment(indices, sectors, ytdData = null) {
  const factors = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // === FACTOR 1: S&P 500 Change (weight: 30%) ===
  const spx = indices.find(i => i.symbol === '^GSPC');
  const spxChange = spx?.changePercent ?? null;

  if (spxChange !== null) {
    // Normalize: -3% to +3% maps to -1 to +1
    const spxScore = Math.max(-1, Math.min(1, spxChange / 3));
    const spxWeight = 0.30;

    weightedScore += spxScore * spxWeight;
    totalWeight += spxWeight;

    factors.push({
      name: 'S&P 500',
      value: spxChange,
      score: Math.round(spxScore * 100) / 100,
      weight: spxWeight,
      description: `${spxChange >= 0 ? '+' : ''}${spxChange.toFixed(2)}% today`
    });
  }

  // === FACTOR 2: VIX Level (weight: 18%) ===
  const vix = indices.find(i => i.symbol === '^VIX');
  const vixLevel = vix?.price ?? null;

  if (vixLevel !== null) {
    // VIX interpretation:
    // < 15: Complacency (bullish but watch for reversal)
    // 15-20: Normal (neutral to slightly bullish)
    // 20-25: Elevated fear (slightly bearish)
    // 25-30: High fear (bearish)
    // > 30: Panic (extreme bearish)
    let vixScore;
    let vixDescription;

    if (vixLevel < 15) {
      vixScore = 0.5;
      vixDescription = 'Low volatility';
    } else if (vixLevel < 20) {
      vixScore = 0.2;
      vixDescription = 'Normal volatility';
    } else if (vixLevel < 25) {
      vixScore = -0.2;
      vixDescription = 'Elevated fear';
    } else if (vixLevel < 30) {
      vixScore = -0.5;
      vixDescription = 'High fear';
    } else {
      vixScore = -0.8;
      vixDescription = 'Panic levels';
    }

    const vixWeight = 0.18;
    weightedScore += vixScore * vixWeight;
    totalWeight += vixWeight;

    factors.push({
      name: 'VIX',
      value: Math.round(vixLevel * 100) / 100,
      score: vixScore,
      weight: vixWeight,
      description: vixDescription
    });
  }

  // === FACTOR 3: Sector Breadth - Daily (weight: 12%) ===
  const validSectors = sectors.filter(s => s.changePercent != null);

  if (validSectors.length > 0) {
    const gainers = validSectors.filter(s => s.changePercent > 0).length;
    const losers = validSectors.filter(s => s.changePercent < 0).length;
    const total = validSectors.length;

    // Breadth ratio: -1 (all down) to +1 (all up)
    const breadthScore = (gainers - losers) / total;
    const breadthWeight = 0.12;

    weightedScore += breadthScore * breadthWeight;
    totalWeight += breadthWeight;

    const breadthPercent = Math.round((gainers / total) * 100);
    factors.push({
      name: 'Daily Breadth',
      value: breadthPercent,
      score: Math.round(breadthScore * 100) / 100,
      weight: breadthWeight,
      description: `${gainers}/${total} sectors up today`
    });
  }

  // === FACTOR 4: Multi-Index Consensus (weight: 5%) ===
  const consensusIndices = ['^DJI', '^IXIC', '^RUT'];
  const consensusData = consensusIndices
    .map(sym => indices.find(i => i.symbol === sym))
    .filter(i => i?.changePercent != null);

  if (consensusData.length > 0) {
    const avgChange = consensusData.reduce((sum, i) => sum + i.changePercent, 0) / consensusData.length;
    // Normalize: -2% to +2% maps to -1 to +1
    const consensusScore = Math.max(-1, Math.min(1, avgChange / 2));
    const consensusWeight = 0.05;

    weightedScore += consensusScore * consensusWeight;
    totalWeight += consensusWeight;

    const allUp = consensusData.every(i => i.changePercent > 0);
    const allDown = consensusData.every(i => i.changePercent < 0);

    factors.push({
      name: 'Consensus',
      value: Math.round(avgChange * 100) / 100,
      score: Math.round(consensusScore * 100) / 100,
      weight: consensusWeight,
      description: allUp ? 'All indices up' : allDown ? 'All indices down' : 'Mixed signals'
    });
  }

  // === YTD TREND FACTORS (only if YTD data available) ===
  if (ytdData && Object.keys(ytdData).length > 0) {

    // === FACTOR 5: YTD Sector Breadth (weight: 12%) ===
    // Measures sustained trend strength - more sectors up YTD = healthier market
    const sectorsWithYtd = validSectors.filter(s => ytdData[s.symbol]?.ytdChangePercent != null);

    if (sectorsWithYtd.length > 0) {
      const ytdGainers = sectorsWithYtd.filter(s => ytdData[s.symbol].ytdChangePercent > 0).length;
      const ytdLosers = sectorsWithYtd.filter(s => ytdData[s.symbol].ytdChangePercent < 0).length;
      const ytdTotal = sectorsWithYtd.length;

      // YTD breadth: -1 (all down YTD) to +1 (all up YTD)
      const ytdBreadthScore = (ytdGainers - ytdLosers) / ytdTotal;
      const ytdBreadthWeight = 0.12;

      weightedScore += ytdBreadthScore * ytdBreadthWeight;
      totalWeight += ytdBreadthWeight;

      factors.push({
        name: 'YTD Breadth',
        value: ytdGainers,
        score: Math.round(ytdBreadthScore * 100) / 100,
        weight: ytdBreadthWeight,
        description: `${ytdGainers}/${ytdTotal} sectors positive YTD`
      });
    }

    // === FACTOR 6: Sector Rotation Signal (weight: 15%) ===
    // Compares cyclical vs defensive sector performance
    // Cyclical leadership = risk-on/bullish, Defensive leadership = risk-off/bearish
    const cyclicalYtdAvg = CYCLICAL_SECTORS
      .filter(sym => ytdData[sym]?.ytdChangePercent != null)
      .reduce((sum, sym, _, arr) => sum + ytdData[sym].ytdChangePercent / arr.length, 0);

    const defensiveYtdAvg = DEFENSIVE_SECTORS
      .filter(sym => ytdData[sym]?.ytdChangePercent != null)
      .reduce((sum, sym, _, arr) => sum + ytdData[sym].ytdChangePercent / arr.length, 0);

    const hasCyclicalData = CYCLICAL_SECTORS.some(sym => ytdData[sym]?.ytdChangePercent != null);
    const hasDefensiveData = DEFENSIVE_SECTORS.some(sym => ytdData[sym]?.ytdChangePercent != null);

    if (hasCyclicalData && hasDefensiveData) {
      // Rotation spread: positive = cyclicals outperforming (bullish), negative = defensives outperforming (bearish)
      const rotationSpread = cyclicalYtdAvg - defensiveYtdAvg;
      // Normalize: -15% to +15% spread maps to -1 to +1
      const rotationScore = Math.max(-1, Math.min(1, rotationSpread / 15));
      const rotationWeight = 0.15;

      weightedScore += rotationScore * rotationWeight;
      totalWeight += rotationWeight;

      let rotationDescription;
      if (rotationSpread > 5) {
        rotationDescription = 'Cyclical leadership (risk-on)';
      } else if (rotationSpread > 0) {
        rotationDescription = 'Slight cyclical tilt';
      } else if (rotationSpread > -5) {
        rotationDescription = 'Slight defensive tilt';
      } else {
        rotationDescription = 'Defensive leadership (risk-off)';
      }

      factors.push({
        name: 'Rotation',
        value: Math.round(rotationSpread * 100) / 100,
        score: Math.round(rotationScore * 100) / 100,
        weight: rotationWeight,
        description: rotationDescription
      });
    }

    // === FACTOR 7: Divergence Detection (weight: 8%) ===
    // Warns when daily leaders are YTD laggards (potential reversal)
    // or daily laggards are YTD leaders (potential catch-up)
    const sectorsWithBothData = validSectors.filter(s =>
      s.changePercent != null && ytdData[s.symbol]?.ytdChangePercent != null
    );

    if (sectorsWithBothData.length >= 5) {
      // Rank sectors by daily and YTD performance
      const dailyRanked = [...sectorsWithBothData].sort((a, b) => b.changePercent - a.changePercent);
      const ytdRanked = [...sectorsWithBothData].sort((a, b) =>
        ytdData[b.symbol].ytdChangePercent - ytdData[a.symbol].ytdChangePercent
      );

      // Calculate rank divergence for each sector
      let totalDivergence = 0;
      let significantDivergences = 0;

      sectorsWithBothData.forEach(sector => {
        const dailyRank = dailyRanked.findIndex(s => s.symbol === sector.symbol) + 1;
        const ytdRank = ytdRanked.findIndex(s => s.symbol === sector.symbol) + 1;
        const rankDiff = Math.abs(dailyRank - ytdRank);
        totalDivergence += rankDiff;
        if (rankDiff >= 5) significantDivergences++; // Large rank change = significant divergence
      });

      // Average divergence normalized (lower = more aligned, higher = more divergent)
      const avgDivergence = totalDivergence / sectorsWithBothData.length;
      const maxPossibleDivergence = sectorsWithBothData.length - 1;

      // High divergence = uncertainty (bearish), Low divergence = trend confirmation (bullish)
      // Normalize: 0 divergence = +1, max divergence = -1
      const divergenceScore = 1 - (2 * avgDivergence / maxPossibleDivergence);
      const divergenceWeight = 0.08;

      weightedScore += divergenceScore * divergenceWeight;
      totalWeight += divergenceWeight;

      let divergenceDescription;
      if (avgDivergence < 2) {
        divergenceDescription = 'Daily aligns with YTD trends';
      } else if (avgDivergence < 4) {
        divergenceDescription = 'Moderate rank divergence';
      } else {
        divergenceDescription = `High divergence (${significantDivergences} sectors)`;
      }

      factors.push({
        name: 'Divergence',
        value: Math.round(avgDivergence * 10) / 10,
        score: Math.round(divergenceScore * 100) / 100,
        weight: divergenceWeight,
        description: divergenceDescription
      });
    }
  }

  // === CALCULATE FINAL SCORE ===
  // Normalize by actual weight used (handles missing data gracefully)
  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Confidence based on data availability (100% = all 7 factors available)
  const maxWeight = ytdData ? 1.0 : 0.65; // Max possible weight depends on YTD data availability
  const confidence = Math.round((totalWeight / maxWeight) * 100);

  // === DETERMINE LABEL ===
  let label;
  if (finalScore > 0.4) label = 'bullish';
  else if (finalScore > 0.15) label = 'slightly-bullish';
  else if (finalScore < -0.4) label = 'bearish';
  else if (finalScore < -0.15) label = 'slightly-bearish';
  else label = 'neutral';

  return {
    score: Math.round(finalScore * 100) / 100,  // -1 to +1, rounded to 2 decimals
    label,
    confidence,
    factors,
    hasYtdData: ytdData !== null && Object.keys(ytdData).length > 0,
    timestamp: Date.now()
  };
}

/**
 * Generate textual analysis for sector performance
 * Produces 5 analysis insights for display in the frontend
 *
 * @param {Array} sectors - Sorted sectors with daily/ytd data and ranks
 * @param {Object} breadth - { daily: { gainers, losers }, ytd: { gainers, losers } }
 * @returns {Object} { insights: [], summary: string, signals: {}, timestamp }
 */
function generateSectorAnalysis(sectors, breadth) {
  const insights = [];
  const signals = {};

  if (!sectors || sectors.length === 0) {
    return { insights: [], signals: {}, summary: '', timestamp: Date.now() };
  }

  // === INSIGHT 1: Leadership Summary ===
  const ytdLeader = sectors[0]; // Already sorted by YTD
  const dailySorted = [...sectors].sort((a, b) =>
    (b.daily?.changePercent || 0) - (a.daily?.changePercent || 0)
  );
  const dailyLeader = dailySorted[0];

  if (ytdLeader && ytdLeader.ytd?.changePercent != null) {
    const ytdPct = ytdLeader.ytd.changePercent;
    insights.push({
      type: 'leadership',
      icon: 'trophy',
      title: 'YTD Leadership',
      text: `${ytdLeader.name} leads with ${ytdPct >= 0 ? '+' : ''}${ytdPct.toFixed(2)}% YTD`,
      subtext: dailyLeader?.symbol !== ytdLeader.symbol
        ? `${dailyLeader.name} leads today (${dailyLeader.daily?.changePercent >= 0 ? '+' : ''}${(dailyLeader.daily?.changePercent || 0).toFixed(2)}%)`
        : null,
      sentiment: 'neutral'
    });
  }

  // === INSIGHT 2: Sector Rotation Signal ===
  const cyclicalSectors = sectors.filter(s => CYCLICAL_SECTORS.includes(s.symbol));
  const defensiveSectors = sectors.filter(s => DEFENSIVE_SECTORS.includes(s.symbol));

  const cyclicalYtdAvg = cyclicalSectors.length > 0
    ? cyclicalSectors.reduce((sum, s) => sum + (s.ytd?.changePercent || 0), 0) / cyclicalSectors.length
    : 0;
  const defensiveYtdAvg = defensiveSectors.length > 0
    ? defensiveSectors.reduce((sum, s) => sum + (s.ytd?.changePercent || 0), 0) / defensiveSectors.length
    : 0;

  const rotationSpread = cyclicalYtdAvg - defensiveYtdAvg;
  signals.rotation = rotationSpread;

  let rotationSentiment, rotationText;
  if (rotationSpread > 5) {
    rotationSentiment = 'bullish';
    rotationText = `Strong risk-on: Cyclicals outperforming by ${rotationSpread.toFixed(1)}%`;
  } else if (rotationSpread > 0) {
    rotationSentiment = 'slightly-bullish';
    rotationText = 'Slight risk-on tilt: Cyclicals leading defensives';
  } else if (rotationSpread > -5) {
    rotationSentiment = 'slightly-bearish';
    rotationText = 'Slight risk-off tilt: Defensives leading cyclicals';
  } else {
    rotationSentiment = 'bearish';
    rotationText = `Risk-off mode: Defensives outperforming by ${Math.abs(rotationSpread).toFixed(1)}%`;
  }

  insights.push({
    type: 'rotation',
    icon: 'refresh',
    title: 'Sector Rotation',
    text: rotationText,
    subtext: `Cyclical avg: ${cyclicalYtdAvg >= 0 ? '+' : ''}${cyclicalYtdAvg.toFixed(1)}% | Defensive avg: ${defensiveYtdAvg >= 0 ? '+' : ''}${defensiveYtdAvg.toFixed(1)}%`,
    sentiment: rotationSentiment
  });

  // === INSIGHT 3: Divergence Analysis ===
  const divergentSectors = sectors.filter(s =>
    s.rank?.daily && s.rank?.ytd && Math.abs(s.rank.daily - s.rank.ytd) >= 5
  );

  if (divergentSectors.length > 0) {
    // Show all divergent sectors - the filter (>=5 rank difference) already limits scope
    const examples = divergentSectors.map(s => {
      const direction = s.rank.daily < s.rank.ytd ? 'surging' : 'fading';
      return `${s.name} (${direction} today)`;
    });

    insights.push({
      type: 'divergence',
      icon: 'alert-triangle',
      title: 'Rank Divergence',
      text: `${divergentSectors.length} sector${divergentSectors.length > 1 ? 's' : ''} showing unusual activity`,
      subtext: examples.join(', '),
      sentiment: 'warning'
    });
    signals.divergence = divergentSectors.length;
  }

  // === INSIGHT 4: Breadth Summary ===
  const dailyUp = breadth?.daily?.gainers || 0;
  const dailyDown = breadth?.daily?.losers || 0;
  const ytdUp = breadth?.ytd?.gainers || 0;
  const ytdDown = breadth?.ytd?.losers || 0;
  const total = sectors.length;

  let breadthSentiment;
  if (dailyUp >= 8) breadthSentiment = 'bullish';
  else if (dailyUp >= 6) breadthSentiment = 'slightly-bullish';
  else if (dailyDown >= 8) breadthSentiment = 'bearish';
  else if (dailyDown >= 6) breadthSentiment = 'slightly-bearish';
  else breadthSentiment = 'neutral';

  insights.push({
    type: 'breadth',
    icon: 'bar-chart-2',
    title: 'Market Breadth',
    text: `${dailyUp}/${total} sectors advancing today`,
    subtext: `YTD: ${ytdUp} positive, ${ytdDown} negative`,
    sentiment: breadthSentiment
  });

  // === INSIGHT 5: Momentum Alignment ===
  const dailyTop3 = dailySorted.slice(0, 3);
  const ytdTop5Symbols = sectors.slice(0, 5).map(s => s.symbol);
  const alignedCount = dailyTop3.filter(s => ytdTop5Symbols.includes(s.symbol)).length;

  signals.momentum = alignedCount;

  let momentumSentiment, momentumText;
  if (alignedCount === 3) {
    momentumSentiment = 'bullish';
    momentumText = 'Strong momentum: All daily leaders are YTD leaders';
  } else if (alignedCount >= 2) {
    momentumSentiment = 'slightly-bullish';
    momentumText = 'Momentum intact: Most daily leaders are YTD leaders';
  } else if (alignedCount === 1) {
    momentumSentiment = 'neutral';
    momentumText = 'Mixed momentum: Daily rally led by mid-tier performers';
  } else {
    momentumSentiment = 'warning';
    momentumText = 'Potential rotation: Today\'s leaders are YTD laggards';
  }

  insights.push({
    type: 'momentum',
    icon: 'zap',
    title: 'Momentum',
    text: momentumText,
    subtext: `${alignedCount}/3 daily leaders in YTD top 5`,
    sentiment: momentumSentiment
  });

  // === GENERATE SUMMARY (v2: bulletproof logic with YTD context) ===
  const summaryParts = [];

  // Extract breadth values with defaults
  const dailyGainers = breadth?.daily?.gainers || 0;
  const dailyLosers = breadth?.daily?.losers || 0;
  const ytdGainers = breadth?.ytd?.gainers || 0;
  const ytdLosers = breadth?.ytd?.losers || 0;
  const dailyTotal = dailyGainers + dailyLosers;
  const ytdTotal = ytdGainers + ytdLosers;
  const dailyRatio = dailyTotal > 0 ? dailyGainers / dailyTotal : 0.5;
  const ytdRatio = ytdTotal > 0 ? ytdGainers / ytdTotal : 0.5;

  // Classify breadth states with clear thresholds
  const dailyStrong = dailyRatio >= 0.7;    // 8+ of 11 up
  const dailyWeak = dailyRatio <= 0.3;      // 3- of 11 up (8+ down)
  const dailyBullish = dailyRatio >= 0.55;  // 6+ of 11 up
  const dailyBearish = dailyRatio <= 0.45;  // 5- of 11 up
  const ytdStrong = ytdRatio >= 0.8;        // 9+ of 11 positive YTD
  const ytdWeak = ytdRatio <= 0.3;          // 3- of 11 positive YTD

  // 1. PRIMARY TONE (includes concrete numbers)
  if (dailyStrong && ytdStrong) {
    summaryParts.push('Broad sector strength');
  } else if (dailyWeak && ytdWeak) {
    summaryParts.push('Broad sector weakness');
  } else if (dailyStrong) {
    summaryParts.push(`Strong daily breadth (${dailyGainers}/${dailyTotal} up)`);
  } else if (dailyWeak) {
    summaryParts.push(`Weak daily breadth (${dailyLosers}/${dailyTotal} down)`);
  } else if (dailyBullish) {
    summaryParts.push(`Most sectors advancing (${dailyGainers}/${dailyTotal})`);
  } else if (dailyBearish) {
    summaryParts.push(`Most sectors declining (${dailyLosers}/${dailyTotal})`);
  } else {
    summaryParts.push(`Split daily action (${dailyGainers}/${dailyTotal} up)`);
  }

  // 2. YTD CONTEXT (when it diverges meaningfully from daily tone)
  if (!dailyStrong && ytdStrong) {
    summaryParts.push(`but ${ytdGainers}/${ytdTotal} remain positive YTD`);
  } else if (!dailyWeak && ytdWeak) {
    summaryParts.push(`with only ${ytdGainers}/${ytdTotal} positive YTD`);
  }

  // 3. ROTATION CONTEXT (complete sentences, not fragments)
  const rotation = signals.rotation || 0;
  if (Math.abs(rotation) > 5) {
    summaryParts.push(rotation > 0
      ? `Cyclicals leading defensives by ${rotation.toFixed(1)}%`
      : `Defensives leading cyclicals by ${Math.abs(rotation).toFixed(1)}%`
    );
  }

  // 4. MOMENTUM QUALIFIER (properly capitalized)
  const momentum = signals.momentum || 0;
  if (momentum === 3) {
    summaryParts.push('YTD leaders continue to drive gains');
  } else if (momentum === 0) {
    summaryParts.push('YTD laggards leading today, signaling potential rotation');
  }

  // 5. DIVERGENCE WARNING (if significant)
  const divergence = signals.divergence || 0;
  if (divergence >= 3) {
    summaryParts.push(`${divergence} sectors showing unusual rank movement`);
  }

  // Combine with proper grammar
  let summary;
  if (summaryParts.length === 0) {
    summary = 'Sector conditions are neutral.';
  } else if (summaryParts.length === 1) {
    summary = summaryParts[0] + '.';
  } else {
    // Smart joining: "but" gets space connector, others get period separator
    const [first, second, ...rest] = summaryParts;
    const connector = second.toLowerCase().startsWith('but') ? ' ' : '. ';
    let combined = first + connector + second;
    if (rest.length > 0) {
      combined += '. ' + rest.join('. ');
    }
    summary = combined + '.';
  }

  return {
    insights,
    signals,
    summary,
    timestamp: Date.now()
  };
}

/**
 * GET /api/market/overview
 * Get combined market overview (indices + sectors)
 * Uses request deduplication to prevent duplicate API calls during concurrent loads
 * OPTIMIZED: Uses batch fetching (2 API calls instead of 16 individual calls)
 * ENHANCED: Includes YTD data for advanced sentiment analysis (7 factors)
 */
router.get('/overview', async (req, res) => {
  try {
    const forceRefresh = req.query.fresh === 'true';

    // If already fetching, wait for pending result (prevents duplicate API calls)
    // Skip deduplication if force refresh requested
    if (!forceRefresh && pendingOverviewRequest) {
      console.log('[Market] Returning deduplicated overview request');
      const result = await pendingOverviewRequest;
      return res.json(result);
    }

    console.log(`[Market] Fetching market overview (batch + YTD)... (force=${forceRefresh})`);

    // Start the request and store promise for deduplication
    pendingOverviewRequest = (async () => {
      try {
        // Fetch indices, sectors, AND YTD data in parallel for enhanced sentiment
        // Pass forceRefresh to bypass cache when user clicks refresh
        const [indicesQuotes, sectorsQuotes, ytdData] = await Promise.all([
          getIndexQuotes(MAJOR_INDICES, forceRefresh),
          getSectorQuotes(SECTOR_ETFS.map(s => s.symbol), forceRefresh),
          fetchYTDData().catch(err => {
            // YTD is optional - gracefully degrade if unavailable
            console.log('[Market] YTD fetch failed, sentiment will use daily factors only:', err.message);
            return null;
          }),
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

        // Market sentiment (enhanced 7-factor analysis with YTD data)
        const sentiment = calculateMarketSentiment(validIndices, validSectors, ytdData);

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

// Movers cache (longer TTL since it's computationally expensive)
// Increased from 1 minute to 5 minutes to reduce API calls
let moversCache = null;
let moversCacheTime = 0;
const MOVERS_CACHE_TTL = 300000; // 5 minutes (increased from 1 minute)

/**
 * GET /api/market/movers
 * Get top gainers, losers, and most active stocks (#118, #119, #120)
 * Uses Yahoo Finance screener API for true market-wide movers (100% dynamic)
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

    console.log('[Market] Fetching market-wide movers from Yahoo screener...');
    const [screenerGainers, screenerLosers, screenerActive] = await Promise.all([
      getCachedScreener('day_gainers', 10),
      getCachedScreener('day_losers', 10),
      getCachedScreener('most_actives', 10),
    ]);

    const gainers = screenerGainers || [];
    const losers = screenerLosers || [];
    const mostActive = screenerActive || [];

    console.log(`[Market] Yahoo screener: ${gainers.length} gainers, ${losers.length} losers, ${mostActive.length} active`);

    const result = {
      timestamp: Date.now(),
      gainers,
      losers,
      mostActive,
      source: 'yahoo_screener',
      cached: false,
      cacheAge: 0,
    };

    // Update cache only if we have data
    if (gainers.length > 0 || losers.length > 0 || mostActive.length > 0) {
      moversCache = result;
      moversCacheTime = Date.now();
    }

    res.json(result);
  } catch (error) {
    console.error('[Market] Movers error:', error);
    res.status(500).json({ error: 'Failed to fetch market movers' });
  }
});

// Enhanced movers cache (separate from regular movers)
let enhancedMoversCache = null;
let enhancedMoversCacheTime = 0;

/**
 * GET /api/market/movers/enhanced
 * Get comprehensive market movers across all market cap segments
 * Includes: Large cap, Small cap, Growth stocks, and Most Watched
 */
router.get('/movers/enhanced', async (req, res) => {
  try {
    const forceRefresh = req.query.fresh === 'true';
    console.log(`[Market] Fetching enhanced market movers... (force=${forceRefresh})`);

    // Check cache (skip if force refresh requested)
    if (!forceRefresh && enhancedMoversCache && Date.now() - enhancedMoversCacheTime < MOVERS_CACHE_TTL) {
      const cacheAge = Date.now() - enhancedMoversCacheTime;
      console.log(`[Market] Returning cached enhanced movers (age: ${Math.round(cacheAge / 1000)}s)`);
      return res.json({ ...enhancedMoversCache, cached: true, cacheAge });
    }

    const categories = {
      viral: { label: 'Top Movers', gainers: [], losers: [] },
      largeCap: { label: 'Large & Mid Cap', gainers: [], losers: [], mostActive: [] },
      smallCap: { label: 'Small Cap', gainers: [], aggressive: [] },
      growth: { label: 'Growth Stocks', undervalued: [], tech: [] },
      trending: { label: 'Most Watched', watched: [] },
      canada: { label: 'Canada', gainers: [], mostActive: [] },
    };

    // TOP MOVERS: HYBRID APPROACH
    // Problem: Yahoo screeners filter by price (>$5) and market cap (>$2B), missing extreme movers
    // Solution: Merge MULTIPLE sources to maximize coverage:
    //   1. TRENDING TICKERS - unfiltered, captures "viral" extreme movers (SMX +141%)
    //   2. MOST ACTIVES - high-volume stocks often have big moves (even if not in gainers)
    //   3. DAY GAINERS - large/mid cap gainers (Yahoo filtered)
    //   4. SMALL CAP GAINERS - highest % gains but still filtered
    // Note: Some extreme movers (like QCLS +48%) have N/A market cap and are filtered from ALL
    // Yahoo screeners - this is a Yahoo data limitation we cannot bypass.
    console.log('[Market] Fetching top movers (HYBRID: trending + actives + screeners)...');
    try {
      // Fetch ALL sources in parallel for maximum coverage
      // Pass forceRefresh to bypass caches when user clicks refresh
      const [trendingMovers, mostActivesData, dayGainersLarge, smallCapGainersLarge, dayLosersLarge] = await Promise.all([
        yahooFinanceService.getTrendingTickersWithQuotes(forceRefresh), // Extreme viral movers
        getCachedScreener('most_actives', 50, forceRefresh),            // High volume (often big moves)
        getCachedScreener('day_gainers', 75, forceRefresh),             // Large/mid cap gainers
        getCachedScreener('small_cap_gainers', 50, forceRefresh),       // Small cap gainers
        getCachedScreener('day_losers', 50, forceRefresh),              // Losers
      ]);

      // MERGE all gainers and deduplicate by symbol (keep highest % change)
      const MIN_GAINER_PERCENT = 3; // Lowered threshold to capture more from trending
      const gainerMap = new Map();

      // Add trending movers first (these have extreme gains like 100%+)
      for (const stock of (trendingMovers || [])) {
        if (stock.changePercent >= MIN_GAINER_PERCENT) {
          gainerMap.set(stock.symbol, stock);
        }
      }

      // Add most actives (high volume stocks often have big moves)
      for (const stock of (mostActivesData || [])) {
        if (stock.changePercent >= MIN_GAINER_PERCENT) {
          const existing = gainerMap.get(stock.symbol);
          if (!existing || stock.changePercent > existing.changePercent) {
            gainerMap.set(stock.symbol, stock);
          }
        }
      }

      // Add screener results (these fill in the continuous distribution)
      for (const stock of [...(dayGainersLarge || []), ...(smallCapGainersLarge || [])]) {
        if (stock.changePercent >= MIN_GAINER_PERCENT) {
          const existing = gainerMap.get(stock.symbol);
          // Keep the entry with the higher % change (in case of data discrepancies)
          if (!existing || stock.changePercent > existing.changePercent) {
            gainerMap.set(stock.symbol, stock);
          }
        }
      }

      // Sort by % change descending and take top 10
      categories.viral.gainers = Array.from(gainerMap.values())
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        .slice(0, 10);

      // LOSERS: Also use hybrid approach for completeness
      const MIN_LOSER_PERCENT = -3;
      const loserMap = new Map();

      // Add trending losers (stocks can trend down too)
      for (const stock of (trendingMovers || [])) {
        if (stock.changePercent <= MIN_LOSER_PERCENT) {
          loserMap.set(stock.symbol, stock);
        }
      }

      // Add screener losers
      for (const stock of (dayLosersLarge || [])) {
        if (stock.changePercent <= MIN_LOSER_PERCENT) {
          const existing = loserMap.get(stock.symbol);
          if (!existing || stock.changePercent < existing.changePercent) {
            loserMap.set(stock.symbol, stock);
          }
        }
      }

      categories.viral.losers = Array.from(loserMap.values())
        .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)) // Most negative first
        .slice(0, 10);

      const trendingCount = (trendingMovers || []).filter(s => s.changePercent >= MIN_GAINER_PERCENT).length;
      const activesCount = (mostActivesData || []).filter(s => s.changePercent >= MIN_GAINER_PERCENT).length;
      console.log(`[Market] Top movers: ${categories.viral.gainers.length} gainers, ${categories.viral.losers.length} losers (HYBRID: trending:${trendingCount}, actives:${activesCount}, screeners)`);
    } catch (err) {
      console.warn('[Market] Top movers failed:', err.message);
    }

    // Batch 1: Large cap screeners (uses unified screener cache)
    // Note: day_gainers:75 and day_losers:50 already fetched by viral movers above
    // getCachedScreener will use cached 25-slice for efficiency (unless forceRefresh)
    console.log('[Market] Fetching large cap movers from unified cache...');
    const [largeCap1, largeCap2, largeCap3] = await Promise.all([
      getCachedScreener('day_gainers', 25, forceRefresh),  // Uses cached slice from 75 results
      getCachedScreener('day_losers', 25, forceRefresh),   // Uses cached slice from 50 results
      getCachedScreener('most_actives', 25, forceRefresh),
    ]);
    categories.largeCap.gainers = largeCap1 || [];
    categories.largeCap.losers = largeCap2 || [];
    categories.largeCap.mostActive = largeCap3 || [];

    // Batch 2: Small cap and growth screeners (uses unified screener cache)
    console.log('[Market] Fetching small cap and growth movers from unified cache...');
    const [smallCapGainers, aggressiveSmallCaps, undervaluedGrowth, techGrowth, mostWatched] = await Promise.all([
      getCachedScreener('small_cap_gainers', 25, forceRefresh),
      getCachedScreener('aggressive_small_caps', 25, forceRefresh),
      getCachedScreener('undervalued_growth_stocks', 25, forceRefresh),
      getCachedScreener('growth_technology_stocks', 25, forceRefresh),
      getCachedScreener('most_watched_tickers', 25, forceRefresh),
    ]);
    categories.smallCap.gainers = smallCapGainers || [];
    categories.smallCap.aggressive = aggressiveSmallCaps || [];
    categories.growth.undervalued = undervaluedGrowth || [];
    categories.growth.tech = techGrowth || [];
    categories.trending.watched = mostWatched || [];

    // CANADIAN MOVERS (TSX/TSXV/CSE)
    // Filter: Minimum $0.50 price to exclude illiquid penny stocks with misleading % gains
    const CA_MIN_PRICE = 0.50;
    console.log('[Market] Fetching Canadian movers (TSX/TSXV/CSE, min $0.50)...');
    try {
      const [caGainers, caActive] = await Promise.all([
        getCachedScreener('day_gainers_ca', 50, forceRefresh),  // Fetch more to filter
        getCachedScreener('most_actives_ca', 30, forceRefresh),
      ]);

      // Filter out penny stocks under $0.50 (often illiquid with misleading % changes)
      categories.canada.gainers = (caGainers || [])
        .filter(s => s.price >= CA_MIN_PRICE)
        .slice(0, 10);
      categories.canada.mostActive = (caActive || [])
        .filter(s => s.price >= CA_MIN_PRICE)
        .slice(0, 10);

      const filteredGainers = (caGainers || []).length - categories.canada.gainers.length;
      console.log(`[Market] Canadian movers: ${categories.canada.gainers.length} gainers, ${categories.canada.mostActive.length} active (filtered ${filteredGainers} penny stocks <$0.50)`);
    } catch (err) {
      console.warn('[Market] Canadian movers failed:', err.message);
    }

    // Log results
    console.log(`[Market] Enhanced movers: viral(${categories.viral.gainers.length}/${categories.viral.losers.length}), largeCap(${categories.largeCap.gainers.length}/${categories.largeCap.losers.length}/${categories.largeCap.mostActive.length}), smallCap(${categories.smallCap.gainers.length}/${categories.smallCap.aggressive.length}), growth(${categories.growth.undervalued.length}/${categories.growth.tech.length}), trending(${categories.trending.watched.length}), canada(${categories.canada.gainers.length}/${categories.canada.mostActive.length})`);

    const result = {
      timestamp: Date.now(),
      categories,
      source: 'yahoo_screener_multi',
      cached: false,
      cacheAge: 0,
    };

    // Update cache
    enhancedMoversCache = result;
    enhancedMoversCacheTime = Date.now();

    res.json(result);
  } catch (error) {
    console.error('[Market] Enhanced movers error:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced market movers' });
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
  console.log('[Market] Pre-warming cache...');
  try {
    // Fetch indices (individual calls - batch doesn't support ^symbols) and sectors (batch)
    await Promise.all([
      getIndexQuotes(MAJOR_INDICES),
      getSectorQuotes(SECTOR_ETFS.map(s => s.symbol)),
    ]);

    const totalSymbols = MAJOR_INDICES.length + SECTOR_ETFS.length;
    console.log(`[Market] Cache pre-warmed with ${totalSymbols} symbols`);
  } catch (error) {
    console.log('[Market] Cache pre-warm failed:', error.message);
  }
}

// Pre-warm cache 5 seconds after server starts
setTimeout(prewarmCache, 5000);

export default router;
