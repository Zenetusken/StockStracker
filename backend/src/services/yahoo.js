/**
 * Yahoo Finance Service
 * Provides free stock data via Yahoo Finance API
 * No API key required - uses unofficial endpoints
 *
 * Rate limits are undocumented but we track calls for visibility
 */

import { getKeyProvider } from './api-keys/index.js';

// Yahoo Finance API base URL (unofficial but widely used)
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Convert Yahoo Finance data to Finnhub-compatible candle format
 */
function convertToCandles(yahooData) {
  if (!yahooData?.chart?.result?.[0]) {
    return null;
  }

  const result = yahooData.chart.result[0];
  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0];

  if (!timestamps || !quote) {
    return null;
  }

  const { open, high, low, close, volume } = quote;

  // Filter out null values and build arrays
  const candles = {
    t: [],
    o: [],
    h: [],
    l: [],
    c: [],
    v: [],
    s: 'ok',
  };

  for (let i = 0; i < timestamps.length; i++) {
    // Skip entries with null values
    if (
      timestamps[i] != null &&
      open[i] != null &&
      high[i] != null &&
      low[i] != null &&
      close[i] != null
    ) {
      candles.t.push(timestamps[i]);
      candles.o.push(open[i]);
      candles.h.push(high[i]);
      candles.l.push(low[i]);
      candles.c.push(close[i]);
      candles.v.push(volume[i] || 0);
    }
  }

  if (candles.t.length === 0) {
    return null;
  }

  return candles;
}

/**
 * Map resolution to Yahoo Finance interval and range
 *
 * Yahoo Finance supported intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
 * Constraints:
 *   - 1m data: max 7 days available
 *   - Intraday (up to 60m/1h): max ~60 days
 *   - Daily and above: up to 'max' (full history)
 */
function getYahooParams(resolution, from, to) {
  const dayInSeconds = 86400;
  const rangeDays = Math.ceil((to - from) / dayInSeconds);

  let interval;
  let range;

  switch (resolution) {
    case '1':
      // 1-minute data - max 7 days available from Yahoo
      interval = '1m';
      range = '1d';
      break;

    case '5':
      // 5-minute data
      interval = '5m';
      if (rangeDays <= 1) range = '1d';
      else if (rangeDays <= 5) range = '5d';
      else range = '1mo'; // Yahoo allows up to ~60 days for intraday
      break;

    case '15':
      // 15-minute data (used by frontend for 1D timeframe)
      interval = '15m';
      if (rangeDays <= 1) range = '1d';
      else if (rangeDays <= 5) range = '5d';
      else range = '1mo';
      break;

    case '30':
      // 30-minute data
      interval = '30m';
      if (rangeDays <= 1) range = '1d';
      else if (rangeDays <= 5) range = '5d';
      else range = '1mo';
      break;

    case '60':
      // Hourly data (used by frontend for 5D timeframe)
      interval = '1h';
      if (rangeDays <= 5) range = '5d';
      else if (rangeDays <= 30) range = '1mo';
      else range = '3mo'; // Max ~60 days for intraday
      break;

    case 'D':
    case 'D1':
      // Daily data (used by frontend for 1M, 6M timeframes)
      interval = '1d';
      if (rangeDays <= 5) range = '5d';
      else if (rangeDays <= 30) range = '1mo';
      else if (rangeDays <= 90) range = '3mo';
      else if (rangeDays <= 180) range = '6mo';
      else if (rangeDays <= 365) range = '1y';
      else if (rangeDays <= 730) range = '2y';
      else if (rangeDays <= 1825) range = '5y';
      else range = '10y';
      break;

    case 'W':
      // Weekly data (used by frontend for 1Y, 5Y, Max timeframes)
      interval = '1wk';
      if (rangeDays <= 365) range = '1y';
      else if (rangeDays <= 730) range = '2y';
      else if (rangeDays <= 1825) range = '5y';
      else if (rangeDays <= 3650) range = '10y';
      else range = 'max';
      break;

    case 'M':
      // Monthly data
      interval = '1mo';
      range = 'max';
      break;

    default:
      // Default to daily with 1 year range
      interval = '1d';
      range = '1y';
  }

  return { interval, range };
}

class YahooFinanceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // 200ms between requests to avoid rate limiting

    // Service identification for call tracking
    this.serviceName = 'yahoo';
    this.virtualKeyValue = 'yahoo-default';
  }

  /**
   * Record API call for tracking (non-blocking)
   */
  recordApiCall() {
    try {
      const keyProvider = getKeyProvider();
      if (keyProvider) {
        keyProvider.recordCall(this.serviceName, this.virtualKeyValue);
      }
    } catch (e) {
      // Silent fail - tracking is optional, don't break functionality
    }
  }

  /**
   * Record rate limit hit for tracking
   * @param {number} retryAfter - Seconds until rate limit resets (default 60)
   */
  recordRateLimit(retryAfter = 60) {
    try {
      const keyProvider = getKeyProvider();
      if (keyProvider) {
        keyProvider.recordRateLimit(this.serviceName, this.virtualKeyValue, retryAfter);
      }
    } catch (e) {
      // Silent fail - tracking is optional
    }
  }

  /**
   * Check if Yahoo Finance is currently rate limited
   * Use this BEFORE making API calls to avoid wasted requests
   * @returns {boolean} True if rate limited
   */
  isRateLimited() {
    try {
      const keyProvider = getKeyProvider();
      return keyProvider.isServiceRateLimited(this.serviceName);
    } catch (e) {
      return false; // Fail open if check errors
    }
  }

  /**
   * Rate limit requests
   */
  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get cache key
   */
  getCacheKey(symbol, interval, range) {
    return `${symbol}:${interval}:${range}`;
  }

  /**
   * Check cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Internal method to fetch candle data from Yahoo Finance
   * @param {string} symbol - Stock symbol
   * @param {string} resolution - Timeframe resolution (1, 5, 15, 30, 60, D, W, M)
   * @param {number} from - Start timestamp (Unix seconds)
   * @param {number} to - End timestamp (Unix seconds)
   * @returns {Object|null} Candle data in Finnhub format or null if failed
   */
  async _fetchCandles(symbol, resolution, from, to) {
    const { interval, range } = getYahooParams(resolution, from, to);
    const cacheKey = this.getCacheKey(symbol, interval, range);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[Yahoo] Cache hit for ${symbol} ${interval}/${range}`);
      return cached;
    }

    try {
      await this.throttle();

      const url = new URL(`${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}`);
      url.searchParams.set('interval', interval);
      url.searchParams.set('range', range);
      url.searchParams.set('includePrePost', 'false');

      console.log(`[Yahoo] Fetching ${symbol} ${interval}/${range}...`);

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting - throw error so fallback logic works
      if (response.status === 429) {
        console.error(`[Yahoo] Rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        const error = new Error('Yahoo Finance rate limited');
        error.isRateLimited = true;
        error.provider = 'yahoo';
        throw error;
      }

      if (!response.ok) {
        console.error(`[Yahoo] HTTP error ${response.status} for ${symbol}`);
        return null;
      }

      const data = await response.json();

      // Check for errors in response (Yahoo sometimes returns errors in body)
      if (data.chart?.error) {
        // Check if it's a rate limit error
        const errorDesc = data.chart.error.description?.toLowerCase() || '';
        if (errorDesc.includes('rate') || errorDesc.includes('limit') || errorDesc.includes('too many')) {
          console.error(`[Yahoo] Rate limited (in body) for ${symbol}`);
          this.recordRateLimit(60);
          const error = new Error('Yahoo Finance rate limited');
          error.isRateLimited = true;
          error.provider = 'yahoo';
          throw error;
        } else {
          console.error(`[Yahoo] API error for ${symbol}:`, data.chart.error.description);
        }
        return null;
      }

      const candles = convertToCandles(data);

      if (candles) {
        console.log(`✓ Yahoo Finance returned ${candles.t.length} candles for ${symbol}`);
        this.setCache(cacheKey, candles);
        return candles;
      }

      console.warn(`[Yahoo] No data returned for ${symbol}`);
      return null;
    } catch (error) {
      console.error(`[Yahoo] Error fetching ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch candle data from Yahoo Finance with fallback to daily data
   * @param {string} symbol - Stock symbol
   * @param {string} resolution - Timeframe resolution (1, 5, 15, 30, 60, D, W, M)
   * @param {number} from - Start timestamp (Unix seconds)
   * @param {number} to - End timestamp (Unix seconds)
   * @returns {Object|null} Candle data in Finnhub format or null if failed
   */
  async getCandles(symbol, resolution, from, to) {
    // Try requested resolution first
    let candles = await this._fetchCandles(symbol, resolution, from, to);

    // If intraday fails, try daily as fallback (for OTC/foreign stocks that lack intraday data)
    if (!candles && ['1', '5', '15', '30', '60'].includes(resolution)) {
      console.log(`[Yahoo] Intraday (${resolution}) failed for ${symbol}, trying daily fallback...`);
      candles = await this._fetchCandles(symbol, 'D', from, to);
      if (candles) {
        candles.fallback = true;  // Mark as fallback data
        candles.originalResolution = resolution;
        console.log(`✓ Yahoo Finance: Using daily fallback for ${symbol} (${candles.t.length} candles)`);
      }
    }

    return candles;
  }

  /**
   * Get real-time quote from Yahoo Finance
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Quote data
   */
  async getQuote(symbol) {
    // Proactive rate limit check - throw error so fallback logic works
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping quote for ${symbol}`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    try {
      await this.throttle();

      const url = new URL(`${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}`);
      url.searchParams.set('interval', '1d');
      url.searchParams.set('range', '1d');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting - throw error so fallback logic works
      if (response.status === 429) {
        console.error(`[Yahoo] Quote rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        const error = new Error('Yahoo Finance rate limited');
        error.isRateLimited = true;
        error.provider = 'yahoo';
        throw error;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result) {
        return null;
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];

      if (!meta || !quote) {
        return null;
      }

      // Get latest values
      const lastIndex = quote.close.length - 1;

      return {
        c: meta.regularMarketPrice || quote.close[lastIndex],
        h: meta.regularMarketDayHigh || Math.max(...quote.high.filter(h => h != null)),
        l: meta.regularMarketDayLow || Math.min(...quote.low.filter(l => l != null)),
        o: quote.open[0],
        pc: meta.chartPreviousClose || meta.previousClose,
        t: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error(`[Yahoo] Quote error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get company profile from Yahoo Finance
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Company profile data
   */
  async getProfile(symbol) {
    // Proactive rate limit check - throw error so fallback logic works
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping profile for ${symbol}`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    try {
      await this.throttle();

      // Use quoteSummary endpoint for profile data with additional modules for financial metrics
      // assetProfile has description, fullTimeEmployees, sector, industry
      const modules = 'assetProfile,summaryProfile,price,summaryDetail,defaultKeyStatistics';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting - throw error so fallback logic works
      if (response.status === 429) {
        console.error(`[Yahoo] Profile rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        const error = new Error('Yahoo Finance rate limited');
        error.isRateLimited = true;
        error.provider = 'yahoo';
        throw error;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const result = data.quoteSummary?.result?.[0];

      if (!result) {
        return null;
      }

      const assetProfile = result.assetProfile || {};
      const price = result.price || {};
      const summaryDetail = result.summaryDetail || {};
      const keyStats = result.defaultKeyStatistics || {};

      return {
        name: price.longName || price.shortName || symbol,
        ticker: symbol.toUpperCase(),
        exchange: price.exchangeName || price.exchange,
        country: assetProfile.country,
        currency: price.currency,
        sector: assetProfile.sector || null,
        finnhubIndustry: assetProfile.industry || null,
        weburl: assetProfile.website,
        marketCapitalization: price.marketCap?.raw ? price.marketCap.raw / 1e6 : null, // Convert to millions like Finnhub
        logo: null, // Yahoo doesn't provide logo URLs easily
        // Financial metrics (#92)
        peRatio: summaryDetail.trailingPE?.raw || keyStats.trailingPE?.raw || null,
        forwardPE: summaryDetail.forwardPE?.raw || keyStats.forwardPE?.raw || null,
        eps: keyStats.trailingEps?.raw || null,
        beta: summaryDetail.beta?.raw || keyStats.beta?.raw || null,
        fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw || null,
        fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw || null,
        dividendYield: summaryDetail.dividendYield?.raw || null,
        sharesOutstanding: keyStats.sharesOutstanding?.raw ? keyStats.sharesOutstanding.raw / 1e6 : null, // Convert to millions
        // Additional company info (#93-95)
        description: assetProfile.longBusinessSummary || null,
        fullTimeEmployees: assetProfile.fullTimeEmployees || null,
        // Note: IPO date not available from Yahoo Finance profile
      };
    } catch (error) {
      console.error(`[Yahoo] Profile error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Check if service is available (always true since no API key needed)
   */
  isAvailable() {
    return true;
  }

  /**
   * Search for symbols using Yahoo Finance
   * @param {string} query - Search query
   * @returns {Object} Search results in Finnhub-compatible format
   */
  async search(query) {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping search for "${query}"`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    try {
      await this.throttle();

      // Yahoo Finance search endpoint
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting
      if (response.status === 429) {
        console.error(`[Yahoo] Search rate limited for "${query}"`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        const error = new Error('Yahoo Finance rate limited');
        error.isRateLimited = true;
        error.provider = 'yahoo';
        throw error;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const quotes = data.quotes || [];

      if (quotes.length === 0) {
        return null;
      }

      // Convert to Finnhub-compatible format
      const results = quotes
        .filter(q => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
        .map(q => ({
          description: q.longname || q.shortname || q.symbol,
          displaySymbol: q.symbol,
          symbol: q.symbol,
          type: q.quoteType === 'ETF' ? 'ETF' : 'Common Stock',
        }));

      console.log(`✓ Yahoo search found ${results.length} results for "${query}"`);

      return {
        count: results.length,
        result: results,
      };
    } catch (error) {
      console.error(`[Yahoo] Search error for "${query}":`, error.message);
      return null;
    }
  }
}

// Export singleton
const yahooFinanceService = new YahooFinanceService();
export default yahooFinanceService;
