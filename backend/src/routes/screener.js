import express from 'express';
import finnhub from '../services/finnhub.js';
import yahooFinanceService from '../services/yahoo.js';

const router = express.Router();

// Optimized stock universe - 50 most liquid stocks (reduced from 90+ for API efficiency)
// Yahoo Finance is used as primary provider (no API key, 100/day limit vs Finnhub's 60/min)
const SCREENER_UNIVERSE = [
  // Mega Cap Tech (10)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  // Large Cap Tech (5)
  'CRM', 'AMD', 'INTC', 'CSCO', 'QCOM',
  // Financials (7)
  'JPM', 'BAC', 'WFC', 'GS', 'V', 'MA', 'AXP',
  // Healthcare (7)
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO',
  // Consumer (7)
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'HD', 'MCD',
  // Industrial (5)
  'CAT', 'BA', 'HON', 'UPS', 'RTX',
  // Energy (4)
  'XOM', 'CVX', 'COP', 'SLB',
  // Communication (3)
  'DIS', 'NFLX', 'CMCSA',
  // Utilities (2)
  'NEE', 'DUK',
];

// Sector mapping
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Communication Services',
  'Real Estate',
  'Utilities',
  'Basic Materials',
];

// Map Finnhub industry to standardized sector
// Finnhub provides 'finnhubIndustry' but not 'sector', so we map it
const INDUSTRY_TO_SECTOR = {
  'Technology': 'Technology',
  'Software': 'Technology',
  'Semiconductors': 'Technology',
  'Computer Hardware': 'Technology',
  'IT Services': 'Technology',
  'Electronic Components': 'Technology',
  'Consumer Electronics': 'Technology',
  'Internet Content & Information': 'Communication Services',
  'Communication Equipment': 'Communication Services',
  'Media': 'Communication Services',
  'Entertainment': 'Communication Services',
  'Telecom Services': 'Communication Services',
  'Banks': 'Financial Services',
  'Financial Services': 'Financial Services',
  'Insurance': 'Financial Services',
  'Capital Markets': 'Financial Services',
  'Credit Services': 'Financial Services',
  'Asset Management': 'Financial Services',
  'Pharmaceuticals': 'Healthcare',
  'Biotechnology': 'Healthcare',
  'Medical Devices': 'Healthcare',
  'Healthcare Plans': 'Healthcare',
  'Healthcare Services': 'Healthcare',
  'Diagnostics & Research': 'Healthcare',
  'Retail': 'Consumer Cyclical',
  'Auto Manufacturers': 'Consumer Cyclical',
  'Restaurants': 'Consumer Cyclical',
  'Travel & Leisure': 'Consumer Cyclical',
  'Apparel': 'Consumer Cyclical',
  'Home Improvement': 'Consumer Cyclical',
  'Specialty Retail': 'Consumer Cyclical',
  'Consumer Goods': 'Consumer Defensive',
  'Food & Beverage': 'Consumer Defensive',
  'Household Products': 'Consumer Defensive',
  'Tobacco': 'Consumer Defensive',
  'Discount Stores': 'Consumer Defensive',
  'Grocery Stores': 'Consumer Defensive',
  'Aerospace & Defense': 'Industrials',
  'Industrial Products': 'Industrials',
  'Machinery': 'Industrials',
  'Transportation': 'Industrials',
  'Logistics': 'Industrials',
  'Construction': 'Industrials',
  'Oil & Gas': 'Energy',
  'Oil & Gas E&P': 'Energy',
  'Oil & Gas Integrated': 'Energy',
  'Oil & Gas Equipment & Services': 'Energy',
  'Utilities': 'Utilities',
  'Utilities - Regulated Electric': 'Utilities',
  'Utilities - Renewable': 'Utilities',
  'REITs': 'Real Estate',
  'Real Estate': 'Real Estate',
  'Chemicals': 'Basic Materials',
  'Mining': 'Basic Materials',
  'Steel': 'Basic Materials',
};

// Cache for stock profiles to reduce API calls
// Increased from 4 hours to 24 hours since screener profile data is not time-sensitive
const profileCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Separate cache for quotes (shorter TTL since prices change)
const quoteCache = new Map();
const QUOTE_CACHE_TTL = 60 * 1000; // 1 minute for quotes

// Request deduplication: prevents concurrent duplicate API calls for same symbol
const pendingProfileRequests = new Map();

/**
 * Get cached profile or fetch from API with request deduplication
 *
 * STRATEGY (updated Dec 2024):
 * - Finnhub: profiles (has market cap, sector, industry) - use FIRST
 * - Yahoo: quotes only (profile API now requires crumb authentication)
 *
 * NEVER uses Alpha Vantage (reserved for technical indicators only)
 */
async function getProfile(symbol) {
  // Check cache first
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Check if there's already a pending request for this symbol
  if (pendingProfileRequests.has(symbol)) {
    return pendingProfileRequests.get(symbol);
  }

  // Create the request promise and store it
  const requestPromise = (async () => {
    try {
      let profile = null;
      let quote = null;
      let metrics = null;

      // STEP 1: Get profile from Finnhub (Yahoo profile API is broken - needs crumb)
      try {
        profile = await finnhub.getCompanyProfile(symbol);
        if (profile) {
          console.log(`[Screener] ✓ Finnhub profile for ${symbol}`);
        }
      } catch (e) {
        console.log(`[Screener] Finnhub profile failed for ${symbol}: ${e.message}`);
      }

      // STEP 2: Get financial metrics from Finnhub (P/E, beta, dividend yield, 52-week data)
      try {
        metrics = await finnhub.getBasicMetrics(symbol);
        if (metrics) {
          console.log(`[Screener] ✓ Finnhub metrics for ${symbol}`);
        }
      } catch (e) {
        console.log(`[Screener] Finnhub metrics failed for ${symbol}: ${e.message}`);
      }

      // STEP 3: Get quote from Yahoo (free, no crumb needed for chart/quote API)
      try {
        if (!yahooFinanceService.isRateLimited()) {
          quote = await yahooFinanceService.getQuote(symbol);
          if (quote) {
            console.log(`[Screener] ✓ Yahoo quote for ${symbol}`);
          }
        }
      } catch (e) {
        // Yahoo quote failed, try Finnhub
      }

      // STEP 4: Fallback to Finnhub for quote if Yahoo failed
      if (!quote) {
        try {
          quote = await finnhub.getQuote(symbol);
        } catch (e) {
          // Both failed for quote
        }
      }

      // NOTE: Alpha Vantage is NEVER used for profiles (reserved for technical indicators)

      if (profile) {
        // Get 52-week data from metrics (more reliable) or profile
        const high52 = metrics?.fiftyTwoWeekHigh || profile.fiftyTwoWeekHigh || profile.weekHigh52 || 0;
        const low52 = metrics?.fiftyTwoWeekLow || profile.fiftyTwoWeekLow || profile.weekLow52 || 0;

        // Calculate 52-week proximity (#109)
        const currentPrice = quote?.c || 0;
        const range52 = high52 - low52;
        const proximityToHigh = range52 > 0 ? ((high52 - currentPrice) / range52) * 100 : 0;
        const proximityToLow = range52 > 0 ? ((currentPrice - low52) / range52) * 100 : 0;

        // Map finnhubIndustry to sector
        const industry = profile.finnhubIndustry || null;
        const sector = industry ? (INDUSTRY_TO_SECTOR[industry] || industry) : null;

        const enrichedProfile = {
          ...profile,
          symbol,
          // Map industry to sector
          sector,
          // Add metrics data (P/E, beta, dividend yield, EPS)
          peRatio: metrics?.peRatio || profile.peRatio || null,
          eps: metrics?.eps || profile.eps || null,
          beta: metrics?.beta || profile.beta || null,
          dividendYield: metrics?.dividendYield || profile.dividendYield || null,
          // Quote data
          currentPrice: quote?.c || null,
          change: quote ? quote.c - quote.pc : null,
          changePercent: quote && quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : null,
          volume: quote?.v || 0,  // #108
          // 52-week data
          fiftyTwoWeekHigh: high52,
          fiftyTwoWeekLow: low52,
          proximityToHigh,  // #109
          proximityToLow,   // #109
        };
        profileCache.set(symbol, { data: enrichedProfile, timestamp: Date.now() });
        return enrichedProfile;
      }

      // Return minimal profile if all providers fail
      console.log(`[Screener] All providers failed for ${symbol}, returning minimal`);
      return { symbol, _minimal: true };
    } catch (error) {
      console.log(`[Screener] Error fetching profile for ${symbol}:`, error.message);
      return { symbol, _minimal: true };
    } finally {
      // Clean up pending request
      pendingProfileRequests.delete(symbol);
    }
  })();

  pendingProfileRequests.set(symbol, requestPromise);
  return requestPromise;
}

/**
 * Get quote for a symbol (for lazy loading after profile filtering)
 * Uses Yahoo Finance as primary, Finnhub as fallback
 */
async function getQuote(symbol) {
  // Check quote cache first
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
    return cached.data;
  }

  try {
    // Try Yahoo first
    if (!yahooFinanceService.isRateLimited()) {
      const quote = await yahooFinanceService.getQuote(symbol);
      if (quote) {
        quoteCache.set(symbol, { data: quote, timestamp: Date.now() });
        return quote;
      }
    }
  } catch (e) { /* fall through */ }

  try {
    // Fallback to Finnhub
    const quote = await finnhub.getQuote(symbol);
    if (quote) {
      quoteCache.set(symbol, { data: quote, timestamp: Date.now() });
      return quote;
    }
  } catch (e) { /* fall through */ }

  return null;
}

/**
 * Apply filters to a stock profile
 */
function matchesFilters(profile, filters) {
  if (!profile) return false;

  // Market cap filter (#103)
  if (filters.minMarketCap !== undefined) {
    const marketCap = profile.marketCapitalization || 0;
    if (marketCap < filters.minMarketCap) return false;
  }
  if (filters.maxMarketCap !== undefined) {
    const marketCap = profile.marketCapitalization || 0;
    if (marketCap > filters.maxMarketCap) return false;
  }

  // P/E ratio filter (#104)
  if (filters.minPE !== undefined) {
    const pe = profile.peRatio || 0;
    if (pe < filters.minPE || pe === 0) return false;
  }
  if (filters.maxPE !== undefined) {
    const pe = profile.peRatio || 0;
    if (pe > filters.maxPE) return false;
  }

  // Sector filter (#105)
  if (filters.sector && filters.sector !== 'all') {
    const profileSector = (profile.sector || '').toLowerCase();
    if (!profileSector.includes(filters.sector.toLowerCase())) return false;
  }

  // Industry filter (#106)
  if (filters.industry && filters.industry !== 'all') {
    const profileIndustry = (profile.finnhubIndustry || '').toLowerCase();
    if (!profileIndustry.includes(filters.industry.toLowerCase())) return false;
  }

  // Price filter (#107)
  if (filters.minPrice !== undefined) {
    const price = profile.currentPrice || 0;
    if (price < filters.minPrice) return false;
  }
  if (filters.maxPrice !== undefined) {
    const price = profile.currentPrice || 0;
    if (price > filters.maxPrice) return false;
  }

  // Volume filter (#108)
  if (filters.minVolume !== undefined) {
    const volume = profile.volume || 0;
    if (volume < filters.minVolume) return false;
  }

  // 52-week high/low proximity filter (#109)
  // nearHigh: stocks within X% of 52-week high
  if (filters.nearHigh !== undefined) {
    const proximityToHigh = profile.proximityToHigh || 100;
    if (proximityToHigh > filters.nearHigh) return false;
  }
  // nearLow: stocks within X% of 52-week low
  if (filters.nearLow !== undefined) {
    const proximityToLow = profile.proximityToLow || 100;
    if (proximityToLow > filters.nearLow) return false;
  }

  // Dividend yield filter (#110)
  if (filters.minDividend !== undefined) {
    const dividend = profile.dividendYield || 0;
    if (dividend < filters.minDividend) return false;
  }
  if (filters.maxDividend !== undefined) {
    const dividend = profile.dividendYield || 0;
    if (dividend > filters.maxDividend) return false;
  }

  return true;
}

/**
 * GET /api/screener
 * Screen stocks with various filters
 * Query params:
 *   - minMarketCap, maxMarketCap: Market cap in millions (#103)
 *   - minPE, maxPE: P/E ratio range (#104)
 *   - sector: Sector filter (#105)
 *   - industry: Industry filter (#106)
 *   - minPrice, maxPrice: Price range (#107)
 *   - minVolume: Minimum volume (#108)
 *   - nearHigh: Within X% of 52-week high (#109)
 *   - nearLow: Within X% of 52-week low (#109)
 *   - minDividend, maxDividend: Dividend yield range (#110)
 *   - limit: Max results (default 20)
 */
router.get('/', async (req, res) => {
  try {
    const {
      minMarketCap,
      maxMarketCap,
      minPE,
      maxPE,
      sector,
      industry,
      minPrice,
      maxPrice,
      minVolume,
      nearHigh,
      nearLow,
      minDividend,
      maxDividend,
      limit = 20,
    } = req.query;

    const filters = {
      minMarketCap: minMarketCap ? parseFloat(minMarketCap) : undefined,
      maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap) : undefined,
      minPE: minPE ? parseFloat(minPE) : undefined,
      maxPE: maxPE ? parseFloat(maxPE) : undefined,
      sector,
      industry,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minVolume: minVolume ? parseFloat(minVolume) : undefined,
      nearHigh: nearHigh ? parseFloat(nearHigh) : undefined,
      nearLow: nearLow ? parseFloat(nearLow) : undefined,
      minDividend: minDividend ? parseFloat(minDividend) : undefined,
      maxDividend: maxDividend ? parseFloat(maxDividend) : undefined,
    };

    console.log('[Screener] Running with filters:', filters);

    // Fetch profiles for all stocks in universe (with caching)
    const profiles = await Promise.all(
      SCREENER_UNIVERSE.map(symbol => getProfile(symbol))
    );

    // Filter stocks based on criteria
    const results = profiles
      .filter(profile => matchesFilters(profile, filters))
      .slice(0, parseInt(limit));

    console.log(`[Screener] Found ${results.length} stocks matching filters`);

    res.json({
      count: results.length,
      filters,
      results: results.map(profile => ({
        symbol: profile.symbol,
        name: profile.name,
        sector: profile.sector,
        industry: profile.finnhubIndustry,
        marketCap: profile.marketCapitalization,
        peRatio: profile.peRatio,
        eps: profile.eps,
        beta: profile.beta,
        dividendYield: profile.dividendYield,
        fiftyTwoWeekHigh: profile.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: profile.fiftyTwoWeekLow,
        proximityToHigh: profile.proximityToHigh,  // #109
        proximityToLow: profile.proximityToLow,    // #109
        currentPrice: profile.currentPrice,
        change: profile.change,
        changePercent: profile.changePercent,
        volume: profile.volume,  // #108
        exchange: profile.exchange,
        currency: profile.currency,
      })),
    });
  } catch (error) {
    console.error('[Screener] Error:', error);
    res.status(500).json({ error: 'Failed to run stock screener' });
  }
});

/**
 * GET /api/screener/sectors
 * Get list of available sectors
 */
router.get('/sectors', (req, res) => {
  res.json(SECTORS);
});

/**
 * GET /api/screener/universe
 * Get list of stocks in screener universe
 */
router.get('/universe', (req, res) => {
  res.json(SCREENER_UNIVERSE);
});

export default router;
