import fs from 'fs';
import alphaVantageService from './alphavantage.js';
import yahooFinanceService from './yahoo.js';
import { getKeyProvider } from './api-keys/index.js';

/**
 * Finnhub API Service
 * Provides market data with caching to respect rate limits (60 calls/minute)
 */

class FinnhubService {
  constructor() {
    this.baseUrl = 'https://finnhub.io/api/v1';
    this._apiKey = null;
    this._apiKeyLoaded = false;
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10 seconds for quote data
    this.searchCacheTimeout = 300000; // 5 minutes for search/symbol data
  }

  /**
   * Lazy-load API key (called on first use to allow dotenv to initialize first)
   * This is necessary because ES module imports are hoisted before dotenv.config() runs
   */
  get apiKey() {
    if (!this._apiKeyLoaded) {
      this._apiKey = this._loadApiKey();
      this._apiKeyLoaded = true;
    }
    return this._apiKey;
  }

  _loadApiKey() {
    // Priority 1: KeyProvider (database-managed keys with rotation)
    try {
      const keyProvider = getKeyProvider();
      if (keyProvider.isAvailable()) {
        const key = keyProvider.getKey('finnhub', {
          fallbackLoader: () => this._loadKeyFromEnvOrFile()
        });
        if (key) {
          console.log('✓ Finnhub API key loaded via KeyProvider');
          return key;
        }
      }
    } catch (e) {
      // Fallback to legacy loading
    }

    return this._loadKeyFromEnvOrFile();
  }

  _loadKeyFromEnvOrFile() {
    // Priority 2: Environment variable (from .env file via dotenv)
    if (process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.trim()) {
      console.log('✓ Finnhub API key loaded from environment variable (FINNHUB_API_KEY)');
      return process.env.FINNHUB_API_KEY.trim();
    }

    // Priority 3: File-based key (legacy support)
    try {
      const apiKeyPath = '/tmp/api-key/finnhub.io.key';
      if (fs.existsSync(apiKeyPath)) {
        const key = fs.readFileSync(apiKeyPath, 'utf8').trim();
        if (key) {
          console.log('✓ Finnhub API key loaded from /tmp/api-key/finnhub.io.key');
          return key;
        }
      }
    } catch (error) {
      console.warn('Could not load API key from /tmp/api-key/finnhub.io.key:', error.message);
    }

    // No API key found - warn user
    console.warn('⚠ No Finnhub API key found - real-time quotes will not work');
    console.warn('  Add to .env as: FINNHUB_API_KEY=your_key_here');
    console.warn('  Get a free key at: https://finnhub.io/register');
    return 'demo';
  }

  /**
   * Check if we have a valid API key (not demo mode)
   */
  hasApiKey() {
    return this.apiKey !== null && this.apiKey !== 'demo';
  }

  /**
   * Get cached data or fetch from API
   */
  async getCached(cacheKey, fetcher, timeout) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Make API request to Finnhub
   */
  async request(endpoint, params = {}) {
    // If using demo key, don't make real API calls (they will fail)
    if (this.apiKey === 'demo') {
      throw new Error('Using demo mode - API calls not available');
    }

    const keyValue = this.apiKey; // Store for tracking
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('token', keyValue);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString());

    // Track the API call (regardless of success/failure - the call was made)
    try {
      const keyProvider = getKeyProvider();
      keyProvider.recordCall('finnhub', keyValue, endpoint);
    } catch (e) {
      console.warn('[Finnhub] Failed to record API usage:', e.message);
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      try {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        const keyProvider = getKeyProvider();
        keyProvider.recordRateLimit('finnhub', keyValue, retryAfter);
      } catch (e) {
        // Silent fail for rate limit recording
      }
      throw new Error('Finnhub API rate limited');
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Finnhub API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get real-time quote for a symbol
   * Returns: { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp }
   *
   * Fallback Order:
   * 1. Finnhub (if API key available)
   * 2. Yahoo Finance (free, no API key required)
   * 3. Alpha Vantage (if API key available) - last resort due to 25 calls/day limit
   * 4. Error - no mock data
   */
  async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `quote:${upperSymbol}`;
    return this.getCached(cacheKey, async () => {
      // 1. Try Finnhub first (if we have a valid API key)
      if (this.hasApiKey()) {
        try {
          const finnhubData = await this.request('/quote', { symbol: upperSymbol });
          if (finnhubData && finnhubData.c !== 0) {
            console.log(`✓ Using Finnhub quote for ${upperSymbol}`);
            return finnhubData;
          }
        } catch (finnhubError) {
          console.log(`Finnhub quote not available for ${upperSymbol}: ${finnhubError.message}`);
        }
      }

      // 2. Try Yahoo Finance (free, no API key required)
      try {
        console.log(`Trying Yahoo Finance quote for ${upperSymbol}...`);
        const yahooData = await yahooFinanceService.getQuote(upperSymbol);
        if (yahooData && yahooData.c) {
          console.log(`✓ Using Yahoo Finance quote for ${upperSymbol}`);
          return yahooData;
        }
      } catch (yahooError) {
        console.log(`Yahoo Finance quote error for ${upperSymbol}: ${yahooError.message}`);
      }

      // 3. Try Alpha Vantage (last resort - only 25 calls/day on free tier)
      if (alphaVantageService.hasApiKey()) {
        try {
          console.log(`Trying Alpha Vantage quote for ${upperSymbol}...`);
          const avData = await alphaVantageService.getQuote(upperSymbol);
          if (avData && avData.c) {
            console.log(`✓ Using Alpha Vantage quote for ${upperSymbol}`);
            return avData;
          }
        } catch (avError) {
          console.log(`Alpha Vantage quote error for ${upperSymbol}: ${avError.message}`);
        }
      }

      // 4. Error - no mock data fallback
      console.error(`❌ No quote data available for ${upperSymbol} - all providers exhausted`);
      throw new Error(`No quote data available for ${upperSymbol}. All API providers exhausted or rate limited.`);
    }, this.cacheTimeout);
  }

  /**
   * Get company profile
   * Returns: { name, ticker, country, currency, exchange, ipo, marketCapitalization, ... }
   *
   * Fallback Order:
   * 1. Finnhub (if API key available)
   * 2. Yahoo Finance (free, no API key required)
   * 3. Alpha Vantage (if API key available) - last resort due to 25 calls/day limit
   * 4. Error - no mock data
   */
  async getCompanyProfile(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `profile:${upperSymbol}`;
    return this.getCached(cacheKey, async () => {
      // 1. Try Finnhub first (if we have a valid API key)
      if (this.hasApiKey()) {
        try {
          const profile = await this.request('/stock/profile2', { symbol: upperSymbol });
          if (profile && profile.name) {
            console.log(`✓ Using Finnhub profile for ${upperSymbol}`);
            return profile;
          }
        } catch (finnhubError) {
          console.log(`Finnhub profile not available for ${upperSymbol}: ${finnhubError.message}`);
        }
      }

      // 2. Try Yahoo Finance (free, no API key required)
      try {
        console.log(`Trying Yahoo Finance profile for ${upperSymbol}...`);
        const yahooProfile = await yahooFinanceService.getProfile(upperSymbol);
        if (yahooProfile && yahooProfile.name) {
          console.log(`✓ Using Yahoo Finance profile for ${upperSymbol}`);
          return yahooProfile;
        }
      } catch (yahooError) {
        console.log(`Yahoo Finance profile error for ${upperSymbol}: ${yahooError.message}`);
      }

      // 3. Try Alpha Vantage (last resort - only 25 calls/day on free tier)
      if (alphaVantageService.hasApiKey()) {
        try {
          console.log(`Trying Alpha Vantage profile for ${upperSymbol}...`);
          const avProfile = await alphaVantageService.getCompanyOverview(upperSymbol);
          if (avProfile && avProfile.name) {
            console.log(`✓ Using Alpha Vantage profile for ${upperSymbol}`);
            return avProfile;
          }
        } catch (avError) {
          console.log(`Alpha Vantage profile error for ${upperSymbol}: ${avError.message}`);
        }
      }

      // 4. Error - no mock data fallback
      console.error(`❌ No profile data available for ${upperSymbol} - all providers exhausted`);
      throw new Error(`No company profile available for ${upperSymbol}. All API providers exhausted or rate limited.`);
    }, this.searchCacheTimeout);
  }

  /**
   * Search for symbols
   * Returns: { count, result: [{ description, displaySymbol, symbol, type }] }
   *
   * Fallback Order:
   * 1. Finnhub (if API key available)
   * 2. Alpha Vantage (if API key available)
   * 3. Error - no mock data
   */
  async searchSymbols(query) {
    const cacheKey = `search:${query.toLowerCase()}`;
    return this.getCached(cacheKey, async () => {
      // 1. Try Finnhub first
      if (this.hasApiKey()) {
        try {
          const result = await this.request('/search', { q: query });
          if (result && result.count > 0) {
            console.log(`✓ Using Finnhub search results for "${query}"`);
            return result;
          }
        } catch (finnhubError) {
          console.log(`Finnhub search error for "${query}": ${finnhubError.message}`);
        }
      }

      // 2. Try Alpha Vantage (if API key available)
      if (alphaVantageService.hasApiKey()) {
        try {
          console.log(`Trying Alpha Vantage search for "${query}"...`);
          const avResult = await alphaVantageService.searchSymbols(query);
          if (avResult && avResult.count > 0) {
            console.log(`✓ Using Alpha Vantage search results for "${query}"`);
            return avResult;
          }
        } catch (avError) {
          console.log(`Alpha Vantage search error for "${query}": ${avError.message}`);
        }
      }

      // 3. Error - no mock data fallback
      console.error(`❌ No search results for "${query}" - all providers exhausted`);
      throw new Error(`No search results for "${query}". All API providers exhausted or rate limited.`);
    }, this.searchCacheTimeout);
  }

  /**
   * Get company news
   * Returns: [{ category, datetime, headline, id, image, related, source, summary, url }]
   */
  async getCompanyNews(symbol, from, to) {
    const cacheKey = `news:${symbol}:${from}:${to}`;
    return this.getCached(cacheKey, async () => {
      return await this.request('/company-news', {
        symbol: symbol.toUpperCase(),
        from,
        to
      });
    }, this.searchCacheTimeout);
  }

  /**
   * Map resolution to Finnhub format
   * Finnhub supported resolutions: 1, 5, 15, 30, 60, D, W, M
   */
  _mapResolutionToFinnhub(resolution) {
    const mapping = {
      '1': '1',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
      'D': 'D',
      'D1': 'D',
      'W': 'W',
      'M': 'M',
    };
    return mapping[resolution] || 'D';
  }

  /**
   * Fetch candle data directly from Finnhub API
   * Finnhub provides historical candle data (free tier has limitations but works for US stocks)
   */
  async _fetchFinnhubCandles(symbol, resolution, from, to) {
    if (!this.hasApiKey()) {
      return null;
    }

    try {
      const finnhubResolution = this._mapResolutionToFinnhub(resolution);
      console.log(`[Finnhub] Fetching candles for ${symbol} (${finnhubResolution})...`);

      const data = await this.request('/stock/candle', {
        symbol: symbol,
        resolution: finnhubResolution,
        from: from,
        to: to,
      });

      // Finnhub returns { s: 'ok', c: [], h: [], l: [], o: [], t: [], v: [] }
      // or { s: 'no_data' } if no data available
      if (data && data.s === 'ok' && data.t && data.t.length > 0) {
        console.log(`✓ Finnhub: ${data.t.length} candles for ${symbol} (${finnhubResolution})`);
        return data;
      }

      if (data && data.s === 'no_data') {
        console.log(`[Finnhub] No data for ${symbol} (${finnhubResolution})`);
      }

      return null;
    } catch (error) {
      console.log(`[Finnhub] Candle error for ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get candles (OHLCV data) - Multi-provider cascade for maximum intraday coverage
   * Returns: { c: [], h: [], l: [], o: [], s: 'ok', t: [], v: [] }
   *
   * Provider Cascade (for intraday data):
   * 1. Yahoo Finance (free, good coverage for most stocks)
   * 2. Finnhub (if API key available, good for US stocks)
   * 3. Daily fallback (LAST RESORT - only if both providers fail for intraday)
   *
   * This ensures maximum intraday data coverage by trying multiple sources.
   */
  async getCandles(symbol, resolution, from, to) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `candles:${upperSymbol}:${resolution}:${from}:${to}`;
    const isIntradayRequest = ['1', '5', '15', '30', '60'].includes(resolution);

    return this.getCached(cacheKey, async () => {
      let intradayData = null;

      // ========== PROVIDER 1: Yahoo Finance (try intraday first) ==========
      try {
        // Call Yahoo's _fetchCandles directly to avoid its internal daily fallback
        const yahooData = await yahooFinanceService._fetchCandles(upperSymbol, resolution, from, to);
        if (yahooData && yahooData.s === 'ok' && yahooData.t && yahooData.t.length > 0) {
          console.log(`✓ Yahoo Finance: ${yahooData.t.length} intraday candles for ${upperSymbol} (${resolution})`);
          return yahooData;
        }
      } catch (yahooError) {
        console.log(`[Yahoo] Intraday error for ${upperSymbol}: ${yahooError.message}`);
      }

      // ========== PROVIDER 2: Finnhub (if Yahoo intraday failed) ==========
      if (isIntradayRequest && this.hasApiKey()) {
        console.log(`[Cascade] Yahoo intraday failed for ${upperSymbol}, trying Finnhub...`);
        const finnhubData = await this._fetchFinnhubCandles(upperSymbol, resolution, from, to);
        if (finnhubData && finnhubData.s === 'ok' && finnhubData.t && finnhubData.t.length > 0) {
          finnhubData.provider = 'finnhub';
          return finnhubData;
        }
      }

      // ========== PROVIDER 3: Daily Fallback (LAST RESORT) ==========
      if (isIntradayRequest) {
        console.log(`⚠ [Cascade] Both providers failed for ${upperSymbol} intraday (${resolution}), trying daily fallback...`);

        // Try Yahoo daily
        try {
          const dailyData = await yahooFinanceService._fetchCandles(upperSymbol, 'D', from, to);
          if (dailyData && dailyData.s === 'ok' && dailyData.t && dailyData.t.length > 0) {
            dailyData.fallback = true;
            dailyData.originalResolution = resolution;
            console.log(`⚠ ${upperSymbol}: Using daily fallback (${dailyData.t.length} candles) - intraday unavailable from all providers`);
            return dailyData;
          }
        } catch (dailyError) {
          console.log(`[Yahoo] Daily fallback error for ${upperSymbol}: ${dailyError.message}`);
        }

        // Try Finnhub daily as absolute last resort
        if (this.hasApiKey()) {
          const finnhubDaily = await this._fetchFinnhubCandles(upperSymbol, 'D', from, to);
          if (finnhubDaily && finnhubDaily.s === 'ok' && finnhubDaily.t && finnhubDaily.t.length > 0) {
            finnhubDaily.fallback = true;
            finnhubDaily.originalResolution = resolution;
            finnhubDaily.provider = 'finnhub';
            console.log(`⚠ ${upperSymbol}: Using Finnhub daily fallback (${finnhubDaily.t.length} candles)`);
            return finnhubDaily;
          }
        }
      }

      // ========== Non-intraday requests (D, W, M) - simpler flow ==========
      if (!isIntradayRequest) {
        // Try Yahoo first
        try {
          const yahooData = await yahooFinanceService._fetchCandles(upperSymbol, resolution, from, to);
          if (yahooData && yahooData.s === 'ok' && yahooData.t && yahooData.t.length > 0) {
            console.log(`✓ Yahoo Finance: ${yahooData.t.length} candles for ${upperSymbol} (${resolution})`);
            return yahooData;
          }
        } catch (error) {
          console.log(`[Yahoo] Error for ${upperSymbol} (${resolution}): ${error.message}`);
        }

        // Try Finnhub
        if (this.hasApiKey()) {
          const finnhubData = await this._fetchFinnhubCandles(upperSymbol, resolution, from, to);
          if (finnhubData) {
            finnhubData.provider = 'finnhub';
            return finnhubData;
          }
        }
      }

      // Error - all providers exhausted
      console.error(`❌ No candle data available for ${upperSymbol} (${resolution}) - all providers exhausted`);
      throw new Error(`No candle data available for ${upperSymbol}. All providers (Yahoo, Finnhub) returned no data.`);
    }, this.cacheTimeout);
  }

  /**
   * Get market news
   * Returns: [{ category, datetime, headline, id, image, related, source, summary, url }]
   */
  async getMarketNews(category = 'general') {
    const cacheKey = `market-news:${category}`;
    return this.getCached(cacheKey, async () => {
      return await this.request('/news', { category });
    }, this.cacheTimeout);
  }

  /**
   * Get multiple quotes at once (more efficient)
   */
  async getQuotes(symbols) {
    const promises = symbols.map(symbol =>
      this.getQuote(symbol).catch(err => {
        console.error(`Error fetching quote for ${symbol}:`, err.message);
        return null;
      })
    );

    const results = await Promise.all(promises);
    const quotes = {};
    symbols.forEach((symbol, index) => {
      if (results[index]) {
        quotes[symbol.toUpperCase()] = results[index];
      }
    });

    return quotes;
  }

  /**
   * Calculate derived quote data (change, percent change, etc.)
   */
  enrichQuote(symbol, quoteData) {
    if (!quoteData || quoteData.c === 0) {
      return null;
    }

    const current = quoteData.c;
    const previousClose = quoteData.pc;
    const change = current - previousClose;
    const percentChange = (change / previousClose) * 100;

    return {
      symbol: symbol.toUpperCase(),
      current,
      previousClose,
      change: parseFloat(change.toFixed(2)),
      percentChange: parseFloat(percentChange.toFixed(2)),
      high: quoteData.h,
      low: quoteData.l,
      open: quoteData.o,
      timestamp: quoteData.t,
      lastUpdate: Date.now()
    };
  }

  /**
   * Get volume for a symbol using a stable cache key
   * Uses day-rounded timestamps for consistent caching
   */
  async getVolume(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `volume:${upperSymbol}`;

    return this.getCached(cacheKey, async () => {
      try {
        // Use day-rounded timestamps for stable cache keys
        const now = Math.floor(Date.now() / 1000);
        const dayRounded = Math.floor(now / 86400) * 86400; // Round to start of day
        const weekAgo = dayRounded - (7 * 86400); // 7 days back to handle weekends

        // Use getCandles which has mock data fallback
        const candles = await this.getCandles(upperSymbol, 'D', weekAgo, dayRounded);

        if (candles && candles.s === 'ok' && candles.v && candles.v.length > 0) {
          return candles.v[candles.v.length - 1]; // Latest day's volume
        }
        return null;
      } catch (error) {
        console.log(`Could not fetch volume for ${upperSymbol}:`, error.message);
        return null;
      }
    }, 60000); // Cache volume for 1 minute
  }

  /**
   * Get enriched quote with all calculated fields
   * Note: Volume is no longer fetched here - it comes from the chart candles
   * when needed. This reduces API calls from 2 to 1 per quote request.
   */
  async getEnrichedQuote(symbol) {
    const quoteData = await this.getQuote(symbol);
    return this.enrichQuote(symbol, quoteData);
    // Volume is available from getCandles() when displaying charts
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key) {
    this.cache.delete(key);
  }
}

// Export singleton instance
const finnhubService = new FinnhubService();
export default finnhubService;
