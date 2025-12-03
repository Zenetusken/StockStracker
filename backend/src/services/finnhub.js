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
    this.searchCacheTimeout = 900000; // 15 minutes for search/symbol data (increased from 5 min)
    // Request deduplication: prevents concurrent duplicate API calls
    this.pendingRequests = new Map();
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
    // Environment variable (from .env file via dotenv)
    if (process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.trim()) {
      console.log('✓ Finnhub API key loaded from environment variable (FINNHUB_API_KEY)');
      return process.env.FINNHUB_API_KEY.trim();
    }

    // No API key found - warn user
    console.warn('⚠ No Finnhub API key found - real-time quotes will not work');
    console.warn('  Add to .env as: FINNHUB_API_KEY=your_key_here');
    console.warn('  Get a free key at: https://finnhub.io/register');
    return null;
  }

  /**
   * Check if we have a valid API key
   */
  hasApiKey() {
    return this.apiKey !== null;
  }

  /**
   * Check if a provider is available (has key and not rate-limited)
   * Use this BEFORE making API calls to avoid wasted requests
   * @param {string} serviceName - Service name (e.g., 'finnhub', 'yahoo', 'alphavantage')
   * @returns {boolean} True if provider is available
   */
  _isProviderAvailable(serviceName) {
    try {
      const keyProvider = getKeyProvider();
      if (keyProvider.isServiceRateLimited(serviceName)) {
        console.log(`[Provider] ${serviceName} is rate-limited, skipping`);
        return false;
      }
      return true;
    } catch (e) {
      return true; // Fail open if check errors
    }
  }

  /**
   * Get cached data or fetch from API with request deduplication
   * Prevents multiple concurrent requests for the same data
   */
  async getCached(cacheKey, fetcher, timeout) {
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(cacheKey)) {
      // Wait for the existing request to complete
      return this.pendingRequests.get(cacheKey);
    }

    // Create the request promise and store it
    const requestPromise = (async () => {
      try {
        const data = await fetcher();
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Make API request to Finnhub
   */
  async request(endpoint, params = {}) {
    // API key is required for real API calls
    if (!this.apiKey) {
      throw new Error('Finnhub API key not configured - API calls not available');
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
   * 1. Finnhub (if API key available AND not rate-limited)
   * 2. Yahoo Finance (free, if not rate-limited)
   * 3. Error - no mock data
   *
   * NOTE: Alpha Vantage removed from quote fallback to protect 25 calls/day limit.
   * Alpha Vantage is reserved for profiles and search only.
   */
  async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `quote:${upperSymbol}`;
    return this.getCached(cacheKey, async () => {
      // 1. Try Finnhub first (if we have API key AND not rate-limited)
      if (this.hasApiKey() && this._isProviderAvailable('finnhub')) {
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

      // 2. Try Yahoo Finance (free, if not rate-limited)
      if (this._isProviderAvailable('yahoo')) {
        try {
          console.log(`Trying Yahoo Finance quote for ${upperSymbol}...`);
          const yahooData = await yahooFinanceService.getQuote(upperSymbol);
          if (yahooData && yahooData.c) {
            console.log(`✓ Using Yahoo Finance quote for ${upperSymbol}`);
            return yahooData;
          }
        } catch (yahooError) {
          if (yahooError.isRateLimited) {
            console.log(`[Fallback] Yahoo Finance rate limited - no more quote providers available`);
          } else {
            console.log(`Yahoo Finance quote error for ${upperSymbol}: ${yahooError.message}`);
          }
        }
      } else {
        console.log(`[Fallback] Yahoo Finance unavailable (rate-limited), skipping`);
      }

      // 3. Error - no mock data fallback
      // NOTE: Alpha Vantage intentionally NOT used for quotes (25 calls/day limit)
      console.error(`❌ No quote data available for ${upperSymbol} - all providers exhausted or rate-limited`);
      throw new Error(`No quote data available for ${upperSymbol}. All API providers exhausted or rate limited.`);
    }, this.cacheTimeout);
  }

  /**
   * Get company profile with merged data from multiple providers
   * Returns: { name, ticker, country, currency, exchange, ipo, marketCapitalization, peRatio, eps, beta, ... }
   *
   * Strategy:
   * 1. Try Yahoo Finance first (has the most complete data with P/E, Beta, EPS, 52-week)
   * 2. If Yahoo fails, try Finnhub for basic profile (if API key available)
   * 3. If Finnhub has logo but Yahoo doesn't, merge the logo
   * 4. Alpha Vantage as last resort
   */
  async getCompanyProfile(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `profile:${upperSymbol}`;
    return this.getCached(cacheKey, async () => {
      let baseProfile = null;
      let finnhubProfile = null;

      // 1. Try Yahoo Finance first (has the most complete data, if not rate-limited)
      if (this._isProviderAvailable('yahoo')) {
        try {
          console.log(`Trying Yahoo Finance profile for ${upperSymbol}...`);
          const yahooProfile = await yahooFinanceService.getProfile(upperSymbol);
          if (yahooProfile && yahooProfile.name) {
            console.log(`✓ Using Yahoo Finance profile for ${upperSymbol}`);
            baseProfile = yahooProfile;
          }
        } catch (yahooError) {
          if (yahooError.isRateLimited) {
            console.log(`[Fallback] Yahoo Finance rate limited for profile, trying other providers`);
          } else {
            console.log(`Yahoo Finance profile error for ${upperSymbol}: ${yahooError.message}`);
          }
        }
      } else {
        console.log(`[Fallback] Yahoo Finance unavailable for profile (rate-limited), trying Finnhub`);
      }

      // 2. Try Finnhub to get logo (Yahoo doesn't provide logos, if not rate-limited)
      if (this.hasApiKey() && this._isProviderAvailable('finnhub')) {
        try {
          finnhubProfile = await this.request('/stock/profile2', { symbol: upperSymbol });
          if (finnhubProfile && finnhubProfile.name) {
            console.log(`✓ Finnhub profile retrieved for ${upperSymbol}`);

            // If we don't have a base profile yet, use Finnhub's
            if (!baseProfile) {
              baseProfile = {
                name: finnhubProfile.name,
                ticker: finnhubProfile.ticker || upperSymbol,
                exchange: finnhubProfile.exchange,
                country: finnhubProfile.country,
                currency: finnhubProfile.currency,
                sector: null,
                finnhubIndustry: finnhubProfile.finnhubIndustry,
                weburl: finnhubProfile.weburl,
                marketCapitalization: finnhubProfile.marketCapitalization,
                logo: finnhubProfile.logo,
                ipo: finnhubProfile.ipo,
              };
            } else {
              // Merge Finnhub's data into Yahoo's profile
              if (finnhubProfile.logo && !baseProfile.logo) {
                baseProfile.logo = finnhubProfile.logo;
              }
              // Use Finnhub's industry if Yahoo didn't provide one
              if (finnhubProfile.finnhubIndustry && !baseProfile.finnhubIndustry) {
                baseProfile.finnhubIndustry = finnhubProfile.finnhubIndustry;
              }
              // Add IPO date from Finnhub (#95)
              if (finnhubProfile.ipo && !baseProfile.ipo) {
                baseProfile.ipo = finnhubProfile.ipo;
              }
              // Add employee count from Finnhub if Yahoo doesn't have it
              if (finnhubProfile.employeeTotal && !baseProfile.fullTimeEmployees) {
                baseProfile.fullTimeEmployees = finnhubProfile.employeeTotal;
              }
            }
          }
        } catch (finnhubError) {
          console.log(`Finnhub profile not available for ${upperSymbol}: ${finnhubError.message}`);
        }
      }

      // 3. If we have a profile, return it
      if (baseProfile) {
        return baseProfile;
      }

      // 4. Return minimal profile instead of calling Alpha Vantage
      // NOTE: Alpha Vantage intentionally REMOVED from profile cascade (25 calls/day limit)
      // Alpha Vantage is reserved for unique features that Yahoo/Finnhub don't provide
      console.log(`⚠ No full profile data available for ${upperSymbol}, returning minimal profile`);
      return {
        name: upperSymbol,
        ticker: upperSymbol,
        exchange: null,
        country: null,
        currency: 'USD',
        sector: null,
        finnhubIndustry: null,
        weburl: null,
        marketCapitalization: null,
        logo: null,
        ipo: null,
        _minimal: true, // Flag to indicate this is a minimal profile
      };
    }, this.searchCacheTimeout);
  }

  /**
   * Search for symbols
   * Returns: { count, result: [{ description, displaySymbol, symbol, type }] }
   *
   * Fallback Order:
   * 1. Finnhub (if API key available, real-time)
   * 2. Yahoo Finance (free, no API key needed)
   * 3. Alpha Vantage (LAST RESORT - 25 calls/day limit, use sparingly!)
   *
   * NOTE: Alpha Vantage is intentionally last resort to preserve 25/day limit
   * for features where it's truly needed (technical indicators).
   */
  async searchSymbols(query) {
    const cacheKey = `search:${query.toLowerCase()}`;
    return this.getCached(cacheKey, async () => {
      // 1. Try Finnhub first (if not rate-limited)
      if (this.hasApiKey() && this._isProviderAvailable('finnhub')) {
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

      // 2. Try Yahoo Finance (free, no API key needed)
      if (this._isProviderAvailable('yahoo')) {
        try {
          console.log(`Trying Yahoo Finance search for "${query}"...`);
          const yahooResult = await yahooFinanceService.search(query);
          if (yahooResult && yahooResult.count > 0) {
            console.log(`✓ Using Yahoo Finance search results for "${query}"`);
            return yahooResult;
          }
        } catch (yahooError) {
          if (yahooError.isRateLimited) {
            console.log(`[Search] Yahoo Finance rate limited, trying next provider...`);
          } else {
            console.log(`Yahoo Finance search error for "${query}": ${yahooError.message}`);
          }
        }
      }

      // 3. Try Alpha Vantage as LAST RESORT (25 calls/day limit!)
      // NOTE: Consider skipping AV entirely for search since Yahoo/Finnhub usually suffice
      if (alphaVantageService.hasApiKey() && this._isProviderAvailable('alphavantage') && !alphaVantageService.isRateLimited()) {
        try {
          console.log(`⚠ Trying Alpha Vantage search for "${query}" (LAST RESORT - 25/day limit)...`);
          const avResult = await alphaVantageService.searchSymbols(query);
          if (avResult && avResult.count > 0) {
            console.log(`✓ Using Alpha Vantage search results for "${query}"`);
            return avResult;
          }
        } catch (avError) {
          console.log(`Alpha Vantage search error for "${query}": ${avError.message}`);
        }
      } else if (alphaVantageService.hasApiKey() && alphaVantageService.isRateLimited()) {
        console.log(`[Search] Alpha Vantage rate limited (25/day), skipping for "${query}"`);
      }

      // 4. Return empty results instead of error (graceful degradation)
      console.warn(`⚠ No search results for "${query}" - all providers exhausted, returning empty`);
      return { count: 0, result: [] };
    }, this.searchCacheTimeout);
  }

  /**
   * Get basic financial metrics for a symbol
   * Uses Finnhub's /stock/metric endpoint
   * Returns: { peRatio, pbRatio, eps, beta, dividendYield, 52WeekHigh, 52WeekLow, ... }
   */
  async getBasicMetrics(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `metrics:${upperSymbol}`;
    return this.getCached(cacheKey, async () => {
      if (!this.hasApiKey() || !this._isProviderAvailable('finnhub')) {
        return null;
      }

      try {
        const data = await this.request('/stock/metric', {
          symbol: upperSymbol,
          metric: 'all'
        });

        if (data && data.metric) {
          const m = data.metric;
          return {
            peRatio: m.peBasicExclExtraTTM || m.peTTM || null,
            pbRatio: m.pbQuarterly || m.pbAnnual || null,
            eps: m.epsBasicExclExtraItemsTTM || m.epsTTM || null,
            beta: m.beta || null,
            dividendYield: m.dividendYieldIndicatedAnnual || m.currentDividendYieldTTM || null,
            fiftyTwoWeekHigh: m['52WeekHigh'] || null,
            fiftyTwoWeekLow: m['52WeekLow'] || null,
            marketCap: m.marketCapitalization || null,
            revenuePerShare: m.revenuePerShareTTM || null,
            bookValuePerShare: m.bookValuePerShareQuarterly || null,
          };
        }
        return null;
      } catch (error) {
        console.log(`[Finnhub] Metrics error for ${upperSymbol}: ${error.message}`);
        return null;
      }
    }, this.searchCacheTimeout); // Cache metrics for longer (15 min)
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
