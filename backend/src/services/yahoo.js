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
 * Yahoo Finance Crumb Manager
 * Handles authentication for endpoints that require crumb (quoteSummary, etc.)
 * Yahoo requires a crumb token + cookies for certain API endpoints
 */
class YahooCrumbManager {
  constructor() {
    this.crumb = null;
    this.cookies = null;
    this.crumbExpiry = 0;
    this.crumbTTL = 60 * 60 * 1000; // 1 hour TTL
    this.fetchPromise = null; // For deduplication
  }

  /**
   * Check if we have a valid crumb
   */
  isValid() {
    return this.crumb && this.cookies && Date.now() < this.crumbExpiry;
  }

  /**
   * Fetch a fresh crumb and cookies from Yahoo Finance
   * Uses consent page to get cookies, then fetches crumb
   */
  async fetchCrumb() {
    // If already fetching, wait for that promise
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        console.log('[Yahoo] Fetching fresh crumb...');

        // Step 1: Get cookies from Yahoo Finance
        // Use fc.yahoo.com which is lightweight and sets the required cookies
        const cookieResponse = await fetch('https://fc.yahoo.com', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          },
          redirect: 'manual', // Don't follow redirects, we just want cookies
        });

        // Extract cookies from Set-Cookie headers
        const setCookies = cookieResponse.headers.getSetCookie?.() || [];
        if (setCookies.length === 0) {
          // Fallback: try raw header
          const rawCookie = cookieResponse.headers.get('set-cookie');
          if (rawCookie) {
            setCookies.push(rawCookie);
          }
        }

        // Build cookie string (just the cookie names and values)
        const cookieParts = setCookies.map(c => c.split(';')[0]).filter(Boolean);

        if (cookieParts.length === 0) {
          // Try alternative: fetch finance.yahoo.com
          const altResponse = await fetch('https://finance.yahoo.com/', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'follow',
          });

          const altCookies = altResponse.headers.getSetCookie?.() || [];
          for (const c of altCookies) {
            const part = c.split(';')[0];
            if (part) cookieParts.push(part);
          }
        }

        this.cookies = cookieParts.join('; ');

        // Step 2: Fetch crumb using the cookies
        const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': this.cookies,
          },
        });

        if (!crumbResponse.ok) {
          console.error(`[Yahoo] Crumb fetch failed: ${crumbResponse.status}`);
          return false;
        }

        this.crumb = await crumbResponse.text();

        if (!this.crumb || this.crumb.includes('error') || this.crumb.includes('html')) {
          console.error('[Yahoo] Invalid crumb received:', this.crumb?.substring(0, 50));
          this.crumb = null;
          return false;
        }

        this.crumbExpiry = Date.now() + this.crumbTTL;
        console.log(`✓ Yahoo crumb obtained (expires in 1h)`);
        return true;
      } catch (error) {
        console.error('[Yahoo] Crumb fetch error:', error.message);
        return false;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  /**
   * Get valid crumb and cookies, fetching new ones if needed
   * @returns {Object|null} { crumb, cookies } or null if failed
   */
  async getAuth() {
    if (this.isValid()) {
      return { crumb: this.crumb, cookies: this.cookies };
    }

    const success = await this.fetchCrumb();
    if (success) {
      return { crumb: this.crumb, cookies: this.cookies };
    }

    return null;
  }
}

// Singleton crumb manager
const crumbManager = new YahooCrumbManager();

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

    // Request deduplication - prevents concurrent duplicate API calls
    this.pendingRequests = new Map();

    // Trending tickers cache (15 min TTL - trending data changes slowly)
    this.trendingCache = null;
    this.trendingCacheTime = 0;
    this.trendingCacheTTL = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Execute request with deduplication
   * Prevents concurrent duplicate API calls for the same resource
   * @param {string} key - Unique request key
   * @param {Function} fetcher - Async function to execute
   * @returns {Promise} Request result
   */
  async withDeduplication(key, fetcher) {
    // Check if request already in flight
    if (this.pendingRequests.has(key)) {
      console.log(`[Yahoo] Request dedup hit: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Create promise and store
    const requestPromise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
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

      // VIX has different settlement times (4:15 PM ET vs 4:00 PM for stocks)
      // Yahoo's chartPreviousClose with range=1d returns stale data for VIX
      // Use range=2d for VIX to get accurate previous close from historical data
      const isVIX = symbol.toUpperCase() === '^VIX';
      const range = isVIX ? '2d' : '1d';

      const url = new URL(`${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}`);
      url.searchParams.set('interval', '1d');
      url.searchParams.set('range', range);

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

      // For VIX, calculate previous close from historical data (second-to-last close)
      // For other symbols, use meta.chartPreviousClose which is reliable
      let previousClose;
      if (isVIX && quote.close.length >= 2) {
        previousClose = quote.close[lastIndex - 1];
      } else {
        previousClose = meta.chartPreviousClose || meta.previousClose;
      }

      return {
        c: meta.regularMarketPrice || quote.close[lastIndex],
        h: meta.regularMarketDayHigh || Math.max(...quote.high.filter(h => h != null)),
        l: meta.regularMarketDayLow || Math.min(...quote.low.filter(l => l != null)),
        o: isVIX ? (quote.open[lastIndex] || quote.open[0]) : quote.open[0],
        pc: previousClose,
        t: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error(`[Yahoo] Quote error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get company profile from Yahoo Finance using authenticated quoteSummary endpoint
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

      // Get authentication (crumb + cookies) for quoteSummary endpoint
      const auth = await crumbManager.getAuth();

      if (!auth) {
        console.warn(`[Yahoo] Failed to get crumb for profile ${symbol}, trying fallback...`);
        return await this._getProfileFallback(symbol);
      }

      // Use quoteSummary endpoint for profile data with additional modules for financial metrics
      // assetProfile has description, fullTimeEmployees, sector, industry
      const modules = 'assetProfile,summaryProfile,price,summaryDetail,defaultKeyStatistics';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': auth.cookies,
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
        console.warn(`[Yahoo] Profile request failed (${response.status}) for ${symbol}, trying fallback...`);
        return await this._getProfileFallback(symbol);
      }

      const data = await response.json();

      // Check for crumb errors - invalidate and retry with fallback
      if (data.quoteSummary?.error?.code === 'Unauthorized') {
        console.warn(`[Yahoo] Invalid crumb for ${symbol}, clearing cache and using fallback...`);
        crumbManager.crumb = null;
        crumbManager.crumbExpiry = 0;
        return await this._getProfileFallback(symbol);
      }

      const result = data.quoteSummary?.result?.[0];

      if (!result) {
        return await this._getProfileFallback(symbol);
      }

      const assetProfile = result.assetProfile || {};
      const price = result.price || {};
      const summaryDetail = result.summaryDetail || {};
      const keyStats = result.defaultKeyStatistics || {};

      // Derive logo from company website using Clearbit
      let logo = null;
      let logoSource = null;
      if (assetProfile.website) {
        try {
          const domain = new URL(assetProfile.website).hostname.replace(/^www\./, '');
          logo = `https://logo.clearbit.com/${domain}`;
          logoSource = 'clearbit';
        } catch {
          // Invalid URL, skip logo derivation
        }
      }

      console.log(`✓ Yahoo profile (authenticated) for ${symbol}`);

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
        logo, // Derived from company website via Clearbit
        _logoSource: logoSource,
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
      if (error.isRateLimited) throw error;
      console.error(`[Yahoo] Profile error for ${symbol}:`, error.message);
      return await this._getProfileFallback(symbol);
    }
  }

  /**
   * Fallback profile using chart API data (doesn't require authentication)
   * Provides basic profile data when quoteSummary fails
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Basic profile data
   */
  async _getProfileFallback(symbol) {
    try {
      console.log(`[Yahoo] Using chart API fallback for ${symbol} profile...`);

      // Use chart API which doesn't require authentication
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?range=1mo&interval=1d`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      this.recordApiCall();

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (!meta) {
        return null;
      }

      console.log(`✓ Yahoo profile fallback for ${symbol} (chart API)`);

      return {
        name: meta.shortName || meta.longName || symbol,
        ticker: symbol.toUpperCase(),
        exchange: meta.exchangeName || meta.fullExchangeName,
        currency: meta.currency,
        // From chart meta
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
        // Mark as minimal so frontend can show indicator
        _minimal: true,
        _source: 'chart-fallback',
      };
    } catch (error) {
      console.error(`[Yahoo] Profile fallback error for ${symbol}:`, error.message);
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
   * Get market-wide top movers from Yahoo Finance screener
   * Uses Yahoo's pre-calculated screener data for true market-wide movers
   * @param {string} type - Screener type (day_gainers, day_losers, most_actives, small_cap_gainers, etc.)
   * @param {number} count - Number of results (max 25)
   * @returns {Array} Array of mover objects with symbol, name, price, change, changePercent, volume, marketCap
   */
  async getMarketMovers(type = 'day_gainers', count = 10) {
    const validTypes = [
      // US Standard movers (large/mid cap focused)
      'day_gainers', 'day_losers', 'most_actives',
      // US Small cap screeners
      'small_cap_gainers', 'aggressive_small_caps',
      // US Growth screeners
      'undervalued_growth_stocks', 'growth_technology_stocks',
      // US Trending/popular
      'most_watched_tickers',
      // CANADIAN screeners (TSX/TSXV/CSE)
      'day_gainers_ca', 'most_actives_ca',
    ];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid screener type: ${type}`);
    }

    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping market movers`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    try {
      await this.throttle();

      const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${type}&count=${count}`;

      console.log(`[Yahoo] Fetching ${type} (top ${count})...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting
      if (response.status === 429) {
        console.error(`[Yahoo] Screener rate limited`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        const error = new Error('Yahoo Finance rate limited');
        error.isRateLimited = true;
        error.provider = 'yahoo';
        throw error;
      }

      if (!response.ok) {
        console.error(`[Yahoo] Screener HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      if (quotes.length === 0) {
        console.warn(`[Yahoo] No results from ${type} screener`);
        return null;
      }

      const movers = quotes.map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        marketCap: q.marketCap,
      }));

      // Sort results based on screener type
      // Daily gainer screeners: sort by daily % change (highest gains first)
      const dailyGainerScreeners = ['day_gainers', 'small_cap_gainers', 'aggressive_small_caps', 'day_gainers_ca'];
      // Volume-based screeners: sort by volume descending
      const volumeScreeners = ['most_actives', 'most_actives_ca'];
      // Valuation-based screeners: preserve Yahoo's original order (ranked by metrics like P/E, PEG, growth rate)
      const valuationScreeners = ['undervalued_growth_stocks', 'growth_technology_stocks', 'most_watched_tickers'];

      if (type === 'day_losers') {
        // Losers: sort by % change ascending (most negative first)
        movers.sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0));
      } else if (volumeScreeners.includes(type)) {
        // Most active (US and CA): sort by volume descending
        movers.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      } else if (valuationScreeners.includes(type)) {
        // Valuation-based screeners: preserve Yahoo's original order
        // Yahoo ranks these by relevance to screener criteria (P/E, PEG, earnings growth, etc.)
        // Do NOT re-sort - the original order is meaningful
        console.log(`[Yahoo] Preserving Yahoo's ranking for ${type} (valuation-based screener)`);
      } else if (dailyGainerScreeners.includes(type)) {
        // Daily gainers: sort by % change descending (highest gains first)
        movers.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      } else {
        // Unknown screener type - preserve Yahoo's order as fallback
        console.log(`[Yahoo] Unknown screener type ${type}, preserving original order`);
      }

      console.log(`✓ Yahoo screener: ${movers.length} ${type.replace('_', ' ')} (sorted)`);
      return movers;
    } catch (error) {
      if (error.isRateLimited) {
        throw error;
      }
      console.error(`[Yahoo] Screener error for ${type}:`, error.message);
      return null;
    }
  }

  /**
   * Get trending tickers from Yahoo Finance
   * These are viral/hot stocks that may be excluded from predefined screeners
   * due to price (<$5) or market cap (<$2B) filters
   * @returns {Array} Array of trending ticker symbols
   */
  async getTrendingTickers() {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log('[Yahoo] Rate limited, skipping trending tickers');
      return [];
    }

    try {
      await this.throttle();

      const url = 'https://query1.finance.yahoo.com/v1/finance/trending/US';

      console.log('[Yahoo] Fetching trending tickers...');

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      if (response.status === 429) {
        console.error('[Yahoo] Trending tickers rate limited');
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        return [];
      }

      if (!response.ok) {
        console.error(`[Yahoo] Trending HTTP error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      // Filter out crypto and other non-equity symbols (those with - like BTC-USD)
      const symbols = quotes
        .map(q => q.symbol)
        .filter(s => s && !s.includes('-'));

      console.log(`✓ Yahoo trending: ${symbols.length} tickers`);
      return symbols;
    } catch (error) {
      console.error('[Yahoo] Trending tickers error:', error.message);
      return [];
    }
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

  /**
   * Get quotes for multiple symbols using the spark endpoint
   * Yahoo Finance spark endpoint has a 20 symbol limit per request
   * We batch into groups of 20 and run them in parallel
   * Still much more efficient than individual getQuote() calls (8 calls for 150 vs 150 calls)
   * @param {string[]} symbols - Array of stock symbols
   * @returns {Object} Map of symbol -> quote data in Finnhub format
   */
  async getBatchQuotes(symbols) {
    if (!symbols || symbols.length === 0) {
      return {};
    }

    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping batch quotes`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    // Yahoo spark endpoint limit is 20 symbols per request
    const BATCH_SIZE = 20;
    const batches = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Yahoo] Batch fetching ${symbols.length} symbols in ${batches.length} parallel requests...`);

    try {
      // Fetch all batches in parallel
      const batchResults = await Promise.all(
        batches.map(async (batch, batchIndex) => {
          try {
            await this.throttle();

            const symbolList = batch.map(s => s.toUpperCase()).join(',');
            const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbolList)}&range=1d&interval=1d`;

            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              timeout: 15000,
            });

            // Track the API call
            this.recordApiCall();

            // Check for rate limiting
            if (response.status === 429) {
              console.error(`[Yahoo] Batch ${batchIndex + 1} rate limited`);
              const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
              this.recordRateLimit(retryAfter);
              return {};
            }

            if (!response.ok) {
              console.error(`[Yahoo] Batch ${batchIndex + 1} HTTP error: ${response.status}`);
              return {};
            }

            const data = await response.json();

            // Spark endpoint returns object with symbol keys directly
            // But when there's an error, it may return { spark: { error: ... } }
            if (data.spark?.error) {
              console.error(`[Yahoo] Batch ${batchIndex + 1} error:`, data.spark.error.description);
              return {};
            }

            // Convert spark format to quotes
            const quotes = {};
            for (const [symbol, sparkData] of Object.entries(data)) {
              if (!sparkData || !sparkData.close || sparkData.close.length === 0) {
                continue;
              }

              const currentPrice = sparkData.close[sparkData.close.length - 1];
              const previousClose = sparkData.chartPreviousClose || currentPrice;

              quotes[symbol] = {
                c: currentPrice,
                pc: previousClose,
                h: currentPrice,
                l: currentPrice,
                o: previousClose,
                v: 0,
                t: sparkData.timestamp?.[0] || Math.floor(Date.now() / 1000),
              };
            }

            return quotes;
          } catch (error) {
            console.error(`[Yahoo] Batch ${batchIndex + 1} error:`, error.message);
            return {};
          }
        })
      );

      // Merge all batch results
      const allQuotes = {};
      for (const batchQuotes of batchResults) {
        Object.assign(allQuotes, batchQuotes);
      }

      console.log(`✓ Yahoo spark returned ${Object.keys(allQuotes).length}/${symbols.length} quotes`);
      return allQuotes;
    } catch (error) {
      if (error.isRateLimited) {
        throw error;
      }
      console.error(`[Yahoo] Batch quotes error:`, error.message);
      return {};
    }
  }

  /**
   * Get quotes for multiple symbols using the v7 quote endpoint
   * Returns REAL volume data (unlike spark endpoint which lacks volume)
   * Use this for any feature that needs accurate volume (Most Active, etc.)
   * @param {string[]} symbols - Array of stock symbols
   * @returns {Object} Map of symbol -> quote data with real OHLCV
   */
  async getBatchQuotesV2(symbols) {
    if (!symbols || symbols.length === 0) {
      return {};
    }

    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping batch quotes V2`);
      const error = new Error('Yahoo Finance rate limited');
      error.isRateLimited = true;
      error.provider = 'yahoo';
      throw error;
    }

    // Use deduplication for concurrent identical requests
    const dedupeKey = `batchV2:${symbols.sort().join(',')}`;

    return this.withDeduplication(dedupeKey, async () => {
      console.log(`[Yahoo] Batch V2 fetching ${symbols.length} symbols via chart API...`);

      try {
        // Use chart API which includes volume in metadata
        // Fetch in parallel batches of 10 to avoid overwhelming
        const PARALLEL_LIMIT = 10;
        const allQuotes = {};

        for (let i = 0; i < symbols.length; i += PARALLEL_LIMIT) {
          const batch = symbols.slice(i, i + PARALLEL_LIMIT);

          const batchResults = await Promise.all(
            batch.map(async (symbol) => {
              try {
                await this.throttle();

                const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?range=1d&interval=1d`;

                const response = await fetch(url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  },
                  timeout: 10000,
                });

                this.recordApiCall();

                if (response.status === 429) {
                  const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
                  this.recordRateLimit(retryAfter);
                  return null;
                }

                if (!response.ok) {
                  return null;
                }

                const data = await response.json();
                const result = data?.chart?.result?.[0];
                const meta = result?.meta;
                const indicators = result?.indicators?.quote?.[0];

                if (!meta || meta.regularMarketPrice == null) {
                  return null;
                }

                // Open price is in indicators.quote, not in meta
                const openPrice = indicators?.open?.[0] ?? meta.regularMarketOpen ?? null;

                return {
                  symbol: symbol.toUpperCase(),
                  quote: {
                    c: meta.regularMarketPrice,
                    pc: meta.chartPreviousClose || meta.previousClose,
                    h: meta.regularMarketDayHigh,
                    l: meta.regularMarketDayLow,
                    o: openPrice,
                    v: meta.regularMarketVolume || 0, // REAL VOLUME from chart API!
                    t: meta.regularMarketTime || Math.floor(Date.now() / 1000),
                    name: meta.shortName || meta.longName || symbol,
                    // Additional data from chart meta for profile fallback
                    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
                    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
                  },
                };
              } catch (error) {
                return null;
              }
            })
          );

          // Add successful results to allQuotes
          for (const result of batchResults) {
            if (result) {
              allQuotes[result.symbol] = result.quote;
            }
          }
        }

        console.log(`✓ Yahoo chart V2 returned ${Object.keys(allQuotes).length}/${symbols.length} quotes with volume`);
        return allQuotes;
      } catch (error) {
        if (error.isRateLimited) throw error;
        console.error(`[Yahoo] Batch V2 quotes error:`, error.message);
        return {};
      }
    });
  }

  /**
   * Get ETF holdings from Yahoo Finance
   * Fetches top holdings for an ETF - enables dynamic sector tracking
   * @param {string} etfSymbol - ETF symbol (e.g., 'ICLN', 'BOTZ', 'DRIV')
   * @param {number} maxHoldings - Maximum number of holdings to return (default 15)
   * @returns {Array} Array of { symbol, name, holdingPercent } objects
   */
  async getETFHoldings(etfSymbol, maxHoldings = 15) {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping ETF holdings for ${etfSymbol}`);
      return [];
    }

    try {
      await this.throttle();

      // Get authentication (crumb + cookies) for quoteSummary endpoint
      const auth = await crumbManager.getAuth();

      if (!auth) {
        console.warn(`[Yahoo] Failed to get crumb for ETF holdings ${etfSymbol}`);
        return [];
      }

      // Use quoteSummary with topHoldings module (requires authentication)
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(etfSymbol)}?modules=topHoldings&crumb=${encodeURIComponent(auth.crumb)}`;

      console.log(`[Yahoo] Fetching ETF holdings for ${etfSymbol}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': auth.cookies,
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      // Check for rate limiting
      if (response.status === 429) {
        console.error(`[Yahoo] ETF holdings rate limited for ${etfSymbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        return [];
      }

      if (!response.ok) {
        console.error(`[Yahoo] ETF holdings HTTP error: ${response.status}`);
        return [];
      }

      const data = await response.json();

      // Check for crumb errors
      if (data.quoteSummary?.error?.code === 'Unauthorized') {
        console.warn(`[Yahoo] Invalid crumb for ETF holdings ${etfSymbol}`);
        crumbManager.crumb = null;
        crumbManager.crumbExpiry = 0;
        return [];
      }

      const topHoldings = data?.quoteSummary?.result?.[0]?.topHoldings;

      if (!topHoldings || !topHoldings.holdings) {
        console.warn(`[Yahoo] No holdings data for ${etfSymbol}`);
        return [];
      }

      // Extract holdings - filter for equities only (skip bonds, cash, etc.)
      const holdings = topHoldings.holdings
        .filter(h => h.symbol && !h.symbol.includes('/') && !h.symbol.includes('-'))
        .slice(0, maxHoldings)
        .map(h => ({
          symbol: h.symbol,
          name: h.holdingName || h.symbol,
          holdingPercent: h.holdingPercent?.raw || 0,
        }));

      console.log(`✓ Yahoo ETF holdings: ${holdings.length} stocks from ${etfSymbol}`);
      return holdings;
    } catch (error) {
      console.error(`[Yahoo] ETF holdings error for ${etfSymbol}:`, error.message);
      return [];
    }
  }

  /**
   * Get Canadian market news via Yahoo Finance search endpoint
   * Uses multiple Canadian-focused search queries for better coverage
   * @param {number} count - Maximum number of articles to return (default 15)
   * @returns {Array} Array of news articles in raw Yahoo format
   */
  async getCanadianNews(count = 15) {
    // Check cache first (5-min TTL)
    const cacheKey = 'canadianNews';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('[Yahoo] Canadian news cache hit');
      return cached;
    }

    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log('[Yahoo] Rate limited, skipping Canadian news');
      return [];
    }

    // Use deduplication for concurrent requests
    return this.withDeduplication(cacheKey, async () => {
      try {
        // Canadian-focused search queries for better coverage
        const queries = ['TSX stocks', 'Toronto stock exchange', 'Canada stock market'];

        const allNews = [];
        const seenUrls = new Set();

        for (const query of queries) {
          await this.throttle();

          const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=10`;

          console.log(`[Yahoo] Fetching Canadian news for query: "${query}"...`);

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
            console.error('[Yahoo] Canadian news rate limited');
            const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
            this.recordRateLimit(retryAfter);
            continue; // Try next query
          }

          if (!response.ok) {
            console.error(`[Yahoo] Canadian news HTTP error: ${response.status}`);
            continue;
          }

          const data = await response.json();
          const news = data.news || [];

          // Deduplicate by URL
          for (const article of news) {
            if (article.link && !seenUrls.has(article.link)) {
              seenUrls.add(article.link);
              allNews.push(article);
            }
          }
        }

        // Sort by publish time (newest first) and limit
        const result = allNews
          .sort((a, b) => (b.providerPublishTime || 0) - (a.providerPublishTime || 0))
          .slice(0, count);

        console.log(`✓ Yahoo Canadian news: ${result.length} articles (from ${allNews.length} total)`);

        // Cache the result
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.error('[Yahoo] Canadian news error:', error.message);
        return [];
      }
    });
  }

  /**
   * Get trending tickers with full quote data (cached)
   * Combines getTrendingTickers() + getBatchQuotesV2() with 15-min caching
   * Returns ready-to-use mover data with volume and % change
   * @param {boolean} forceRefresh - Bypass cache when true (for manual refresh)
   * @returns {Array} Array of { symbol, name, price, change, changePercent, volume } objects
   */
  async getTrendingTickersWithQuotes(forceRefresh = false) {
    // Check cache first (skip if forceRefresh requested)
    if (!forceRefresh && this.trendingCache && Date.now() - this.trendingCacheTime < this.trendingCacheTTL) {
      console.log('[Yahoo] Trending cache hit');
      return this.trendingCache;
    }

    if (forceRefresh) {
      console.log('[Yahoo] Trending force refresh');
    }

    // Use deduplication for concurrent requests
    return this.withDeduplication('trendingWithQuotes', async () => {
      try {
        // Fetch trending symbols
        const symbols = await this.getTrendingTickers();
        if (!symbols || symbols.length === 0) {
          return [];
        }

        // Fetch quotes with real volume using V2 method
        const quotes = await this.getBatchQuotesV2(symbols);

        // Build result array with full data
        const result = symbols
          .filter(s => quotes[s] && quotes[s].c && quotes[s].pc)
          .map(symbol => {
            const q = quotes[symbol];
            const price = q.c;
            const previousClose = q.pc;
            const change = price - previousClose;
            const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

            return {
              symbol,
              name: q.name || symbol,
              price,
              change,
              changePercent,
              volume: q.v || 0,
              marketCap: q.marketCap,
            };
          })
          .sort((a, b) => b.changePercent - a.changePercent); // Sort by % change descending

        // Update cache
        this.trendingCache = result;
        this.trendingCacheTime = Date.now();

        console.log(`✓ Trending tickers cached: ${result.length} symbols with quotes`);
        return result;
      } catch (error) {
        console.error('[Yahoo] getTrendingTickersWithQuotes error:', error.message);
        return [];
      }
    });
  }

  /**
   * Get company-specific news using Yahoo Finance search endpoint
   * Works for both US and Canadian stocks (unlike Finnhub)
   * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'SHOP.TO')
   * @param {number} count - Number of news articles to return (default 10)
   * @returns {Array} Array of news articles in Finnhub-compatible format
   */
  async getCompanyNews(symbol, count = 10) {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping company news for ${symbol}`);
      return [];
    }

    try {
      await this.throttle();

      // Get company name from profile for better search results
      // Yahoo search works on keywords, not ticker symbols (especially for .TO/.V/.CN)
      let searchTerm = symbol;
      try {
        const profile = await this.getProfile(symbol);
        if (profile?.shortName) {
          searchTerm = profile.shortName;
        } else if (profile?.longName) {
          searchTerm = profile.longName;
        } else {
          // Fallback: strip exchange suffix for cleaner search
          searchTerm = symbol.replace(/\.(TO|V|CN|L|PA|DE|AX|HK|SS|SZ)$/i, '');
        }
      } catch {
        // Profile fetch failed, use symbol without exchange suffix
        searchTerm = symbol.replace(/\.(TO|V|CN|L|PA|DE|AX|HK|SS|SZ)$/i, '');
      }

      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchTerm)}&quotesCount=0&newsCount=${count}`;

      console.log(`[Yahoo] Fetching company news for ${symbol} (searching: "${searchTerm}")...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Track the API call
      this.recordApiCall();

      if (response.status === 429) {
        console.error(`[Yahoo] Company news rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        return [];
      }

      if (!response.ok) {
        console.error(`[Yahoo] Company news HTTP error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const news = data.news || [];

      if (news.length === 0) {
        console.warn(`[Yahoo] No news found for ${symbol}`);
        return [];
      }

      // Transform to Finnhub-compatible format
      const articles = news.map(item => ({
        id: item.uuid,
        headline: item.title,
        summary: null, // Not available from Yahoo search
        source: item.publisher,
        url: item.link,
        image: item.thumbnail?.resolutions?.[0]?.url || null,
        datetime: item.providerPublishTime,
        related: (item.relatedTickers || []).join(','),
        category: 'company',
      }));

      console.log(`✓ Yahoo company news: ${articles.length} articles for ${symbol}`);
      return articles;
    } catch (error) {
      console.error(`[Yahoo] Company news error for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Get analyst ratings and recommendations using authenticated quoteSummary
   * @param {string} symbol - Stock symbol
   * @returns {Object} { recommendations: {...}, upgrades: [...] }
   */
  async getAnalystRatings(symbol) {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping analyst ratings for ${symbol}`);
      return null;
    }

    try {
      await this.throttle();

      // Get authentication for quoteSummary endpoint
      const auth = await crumbManager.getAuth();

      if (!auth) {
        console.warn(`[Yahoo] Failed to get crumb for analyst ratings ${symbol}`);
        return null;
      }

      const modules = 'recommendationTrend,upgradeDowngradeHistory';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

      console.log(`[Yahoo] Fetching analyst ratings for ${symbol}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': auth.cookies,
        },
        timeout: 10000,
      });

      this.recordApiCall();

      if (response.status === 429) {
        console.error(`[Yahoo] Analyst ratings rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        return null;
      }

      if (!response.ok) {
        console.error(`[Yahoo] Analyst ratings HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Check for crumb errors
      if (data.quoteSummary?.error?.code === 'Unauthorized') {
        console.warn(`[Yahoo] Invalid crumb for analyst ratings ${symbol}`);
        crumbManager.crumb = null;
        crumbManager.crumbExpiry = 0;
        return null;
      }

      const result = data.quoteSummary?.result?.[0];
      if (!result) {
        return null;
      }

      const recommendationTrend = result.recommendationTrend?.trend || [];
      const upgradeDowngradeHistory = result.upgradeDowngradeHistory?.history || [];

      // Get current period recommendations (period: "0m")
      const currentRecommendations = recommendationTrend.find(r => r.period === '0m') || {};

      console.log(`✓ Yahoo analyst ratings for ${symbol}: ${upgradeDowngradeHistory.length} upgrades/downgrades`);

      return {
        recommendations: {
          strongBuy: currentRecommendations.strongBuy || 0,
          buy: currentRecommendations.buy || 0,
          hold: currentRecommendations.hold || 0,
          sell: currentRecommendations.sell || 0,
          strongSell: currentRecommendations.strongSell || 0,
          total: (currentRecommendations.strongBuy || 0) +
                 (currentRecommendations.buy || 0) +
                 (currentRecommendations.hold || 0) +
                 (currentRecommendations.sell || 0) +
                 (currentRecommendations.strongSell || 0),
        },
        trend: recommendationTrend.map(t => ({
          period: t.period,
          strongBuy: t.strongBuy || 0,
          buy: t.buy || 0,
          hold: t.hold || 0,
          sell: t.sell || 0,
          strongSell: t.strongSell || 0,
        })),
        upgrades: upgradeDowngradeHistory.slice(0, 20).map(u => ({
          firm: u.firm,
          toGrade: u.toGrade,
          fromGrade: u.fromGrade,
          action: u.action, // 'upgrade', 'downgrade', 'main', 'init', 'reiterated'
          date: u.epochGradeDate,
        })),
      };
    } catch (error) {
      console.error(`[Yahoo] Analyst ratings error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get insider activity and institutional ownership using authenticated quoteSummary
   * @param {string} symbol - Stock symbol
   * @returns {Object} { transactions: [...], institutions: [...], breakdown: {...} }
   */
  async getInsiderActivity(symbol) {
    // Proactive rate limit check
    if (this.isRateLimited()) {
      console.log(`[Yahoo] Rate limited, skipping insider activity for ${symbol}`);
      return null;
    }

    try {
      await this.throttle();

      // Get authentication for quoteSummary endpoint
      const auth = await crumbManager.getAuth();

      if (!auth) {
        console.warn(`[Yahoo] Failed to get crumb for insider activity ${symbol}`);
        return null;
      }

      const modules = 'insiderTransactions,institutionOwnership,majorHoldersBreakdown';
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

      console.log(`[Yahoo] Fetching insider activity for ${symbol}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': auth.cookies,
        },
        timeout: 10000,
      });

      this.recordApiCall();

      if (response.status === 429) {
        console.error(`[Yahoo] Insider activity rate limited for ${symbol}`);
        const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
        this.recordRateLimit(retryAfter);
        return null;
      }

      if (!response.ok) {
        console.error(`[Yahoo] Insider activity HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Check for crumb errors
      if (data.quoteSummary?.error?.code === 'Unauthorized') {
        console.warn(`[Yahoo] Invalid crumb for insider activity ${symbol}`);
        crumbManager.crumb = null;
        crumbManager.crumbExpiry = 0;
        return null;
      }

      const result = data.quoteSummary?.result?.[0];
      if (!result) {
        return null;
      }

      const insiderTransactions = result.insiderTransactions?.transactions || [];
      const institutionOwnership = result.institutionOwnership?.ownershipList || [];
      const majorHoldersBreakdown = result.majorHoldersBreakdown || {};

      console.log(`✓ Yahoo insider activity for ${symbol}: ${insiderTransactions.length} transactions, ${institutionOwnership.length} institutions`);

      return {
        transactions: insiderTransactions.slice(0, 20).map(t => ({
          name: t.filerName,
          relation: t.filerRelation,
          transactionType: t.transactionText,
          shares: t.shares?.raw || 0,
          value: t.value?.raw || 0,
          date: t.startDate?.raw,
          ownership: t.ownership,
        })),
        institutions: institutionOwnership.slice(0, 10).map(i => ({
          name: i.organization,
          shares: i.position?.raw || 0,
          value: i.value?.raw || 0,
          pctHeld: i.pctHeld?.raw || 0,
          change: i.pctChange?.raw || 0,
          reportDate: i.reportDate?.raw,
        })),
        breakdown: {
          insidersPercentHeld: majorHoldersBreakdown.insidersPercentHeld?.raw || 0,
          institutionsPercentHeld: majorHoldersBreakdown.institutionsPercentHeld?.raw || 0,
          institutionsFloatPercentHeld: majorHoldersBreakdown.institutionsFloatPercentHeld?.raw || 0,
          institutionsCount: majorHoldersBreakdown.institutionsCount?.raw || 0,
        },
      };
    } catch (error) {
      console.error(`[Yahoo] Insider activity error for ${symbol}:`, error.message);
      return null;
    }
  }
}

// Export singleton
const yahooFinanceService = new YahooFinanceService();
export default yahooFinanceService;
