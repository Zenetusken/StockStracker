import express from 'express';
import finnhub from '../services/finnhub.js';

const router = express.Router();

// Popular US stocks for screening (curated list since Finnhub free tier lacks screener API)
const SCREENER_UNIVERSE = [
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  // Large Cap Tech
  'CRM', 'AMD', 'INTC', 'CSCO', 'IBM', 'QCOM', 'TXN', 'NOW', 'INTU', 'AMAT',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BLK', 'SCHW', 'USB',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  // Consumer
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT',
  // Industrial
  'CAT', 'BA', 'HON', 'UPS', 'GE', 'MMM', 'RTX', 'LMT', 'DE', 'UNP',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'HAL',
  // Communication
  'DIS', 'NFLX', 'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR', 'EA', 'ATVI', 'TTWO',
  // REITs & Utilities
  'AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'NEE', 'DUK', 'SO', 'D', 'AEP',
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

// Cache for stock profiles to reduce API calls
const profileCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get cached profile or fetch from API
 */
async function getProfile(symbol) {
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const profile = await finnhub.getCompanyProfile(symbol);
    if (profile) {
      // Get quote for current price and volume
      const quote = await finnhub.getQuote(symbol);

      // Calculate 52-week proximity (#109)
      const currentPrice = quote?.c || 0;
      const high52 = profile.fiftyTwoWeekHigh || profile.weekHigh52 || 0;
      const low52 = profile.fiftyTwoWeekLow || profile.weekLow52 || 0;
      const range52 = high52 - low52;
      const proximityToHigh = range52 > 0 ? ((high52 - currentPrice) / range52) * 100 : 0;
      const proximityToLow = range52 > 0 ? ((currentPrice - low52) / range52) * 100 : 0;

      const enrichedProfile = {
        ...profile,
        symbol,
        currentPrice: quote?.c || null,
        change: quote ? quote.c - quote.pc : null,
        changePercent: quote && quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : null,
        volume: quote?.v || 0,  // #108
        fiftyTwoWeekHigh: high52,
        fiftyTwoWeekLow: low52,
        proximityToHigh,  // #109
        proximityToLow,   // #109
      };
      profileCache.set(symbol, { data: enrichedProfile, timestamp: Date.now() });
      return enrichedProfile;
    }
  } catch (error) {
    console.log(`[Screener] Error fetching profile for ${symbol}:`, error.message);
  }
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
