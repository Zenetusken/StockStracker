import fs from 'fs';
import { getKeyProvider } from './api-keys/index.js';

/**
 * Alpha Vantage API Service
 * Provides historical OHLCV data (candles) for stock charts
 * Free tier: 25 requests/day - more than enough for development
 *
 * Get a free API key at: https://www.alphavantage.co/support/#api-key
 */

class AlphaVantageService {
  constructor() {
    this.baseUrl = 'https://www.alphavantage.co/query';
    this._apiKey = null;
    this._apiKeyLoaded = false;
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes for historical data
  }

  /**
   * Lazy-load API key (called on first use to allow dotenv to initialize first)
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
        const key = keyProvider.getKey('alphavantage', {
          fallbackLoader: () => this._loadKeyFromEnvOrFile()
        });
        if (key) {
          console.log('✓ Alpha Vantage API key loaded via KeyProvider');
          return key;
        }
      }
    } catch (e) {
      // Fallback to legacy loading
    }

    return this._loadKeyFromEnvOrFile();
  }

  _loadKeyFromEnvOrFile() {
    // Priority 2: Environment variable (set by dotenv from .env file)
    if (process.env.ALPHAVANTAGE_API_KEY) {
      console.log('✓ Alpha Vantage API key loaded from environment variable');
      return process.env.ALPHAVANTAGE_API_KEY;
    }

    // Priority 3: File-based key (legacy support)
    try {
      const apiKeyPath = '/tmp/api-key/alphavantage.key';
      if (fs.existsSync(apiKeyPath)) {
        const key = fs.readFileSync(apiKeyPath, 'utf8').trim();
        console.log('✓ Alpha Vantage API key loaded from /tmp/api-key/alphavantage.key');
        return key;
      }
    } catch (error) {
      console.warn('Could not load API key from /tmp/api-key/alphavantage.key:', error.message);
    }

    console.warn('⚠ No Alpha Vantage API key found - historical chart data will use mock data');
    console.warn('  Get a free key at: https://www.alphavantage.co/support/#api-key');
    console.warn('  Add to .env as: ALPHAVANTAGE_API_KEY=your_key_here');
    return null;
  }

  /**
   * Check if we have a valid API key
   */
  hasApiKey() {
    return this.apiKey !== null && this.apiKey !== 'demo';
  }

  /**
   * Get cached data or fetch from API
   */
  async getCached(cacheKey, fetcher) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Make API request to Alpha Vantage
   */
  async request(params) {
    if (!this.hasApiKey()) {
      throw new Error('No Alpha Vantage API key configured');
    }

    const keyValue = this.apiKey; // Store for tracking
    const url = new URL(this.baseUrl);
    url.searchParams.append('apikey', keyValue);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString());

    // Track the API call (regardless of success/failure - the call was made)
    try {
      const keyProvider = getKeyProvider();
      keyProvider.recordCall('alphavantage', keyValue);
    } catch (e) {
      console.warn('[AlphaVantage] Failed to record API usage:', e.message);
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      try {
        const keyProvider = getKeyProvider();
        keyProvider.recordRateLimit('alphavantage', keyValue, 60);
      } catch (e) {
        // Silent fail for rate limit recording
      }
      throw new Error('Alpha Vantage API rate limited');
    }

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }

    // Check for rate limit messages in response body (Alpha Vantage does this)
    if (data['Note'] && data['Note'].includes('API call frequency')) {
      console.warn('Alpha Vantage rate limit warning:', data['Note']);
      try {
        const keyProvider = getKeyProvider();
        keyProvider.recordRateLimit('alphavantage', keyValue, 60);
      } catch (e) {
        // Silent fail for rate limit recording
      }
    }

    if (data['Information']) {
      throw new Error(`Alpha Vantage: ${data['Information']}`);
    }

    return data;
  }

  /**
   * Get daily OHLCV data
   * Returns data in Finnhub candle format for compatibility: { c: [], h: [], l: [], o: [], t: [], v: [], s: 'ok' }
   *
   * NOTE: Free tier only supports 'compact' (100 data points). 'full' requires premium subscription.
   */
  async getDailyCandles(symbol, days = 100) {
    // Free tier: always use 'compact' (100 data points max)
    // Premium feature 'full' is not available on free tier
    const cacheKey = `daily:${symbol}:compact`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        outputsize: 'compact'  // Always compact for free tier (100 data points)
      });

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No data returned from Alpha Vantage');
      }

      // Convert Alpha Vantage format to Finnhub candle format
      // Compact returns ~100 data points, return all available
      const dates = Object.keys(timeSeries).sort(); // Sort dates ascending
      const recentDates = days < dates.length ? dates.slice(-days) : dates;

      const t = [];
      const o = [];
      const h = [];
      const l = [];
      const c = [];
      const v = [];

      for (const date of recentDates) {
        const entry = timeSeries[date];
        // Convert date to Unix timestamp (seconds)
        t.push(Math.floor(new Date(date).getTime() / 1000));
        o.push(parseFloat(entry['1. open']));
        h.push(parseFloat(entry['2. high']));
        l.push(parseFloat(entry['3. low']));
        c.push(parseFloat(entry['4. close']));
        v.push(parseInt(entry['5. volume'], 10));
      }

      return { c, h, l, o, t, v, s: 'ok' };
    });
  }

  /**
   * Get weekly OHLCV data
   */
  async getWeeklyCandles(symbol, weeks = 52) {
    const cacheKey = `weekly:${symbol}:${weeks}`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'TIME_SERIES_WEEKLY',
        symbol: symbol.toUpperCase()
      });

      const timeSeries = data['Weekly Time Series'];
      if (!timeSeries) {
        throw new Error('No weekly data returned from Alpha Vantage');
      }

      const dates = Object.keys(timeSeries).sort();
      const recentDates = dates.slice(-weeks);

      const t = [];
      const o = [];
      const h = [];
      const l = [];
      const c = [];
      const v = [];

      for (const date of recentDates) {
        const entry = timeSeries[date];
        t.push(Math.floor(new Date(date).getTime() / 1000));
        o.push(parseFloat(entry['1. open']));
        h.push(parseFloat(entry['2. high']));
        l.push(parseFloat(entry['3. low']));
        c.push(parseFloat(entry['4. close']));
        v.push(parseInt(entry['5. volume'], 10));
      }

      return { c, h, l, o, t, v, s: 'ok' };
    });
  }

  /**
   * Get intraday OHLCV data (requires premium for some intervals)
   */
  async getIntradayCandles(symbol, interval = '60min', days = 1) {
    const cacheKey = `intraday:${symbol}:${interval}:${days}`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'TIME_SERIES_INTRADAY',
        symbol: symbol.toUpperCase(),
        interval,
        outputsize: 'compact'
      });

      const key = `Time Series (${interval})`;
      const timeSeries = data[key];
      if (!timeSeries) {
        throw new Error(`No intraday data returned from Alpha Vantage for interval ${interval}`);
      }

      const dates = Object.keys(timeSeries).sort();

      const t = [];
      const o = [];
      const h = [];
      const l = [];
      const c = [];
      const v = [];

      for (const datetime of dates) {
        const entry = timeSeries[datetime];
        t.push(Math.floor(new Date(datetime).getTime() / 1000));
        o.push(parseFloat(entry['1. open']));
        h.push(parseFloat(entry['2. high']));
        l.push(parseFloat(entry['3. low']));
        c.push(parseFloat(entry['4. close']));
        v.push(parseInt(entry['5. volume'], 10));
      }

      return { c, h, l, o, t, v, s: 'ok' };
    });
  }

  /**
   * Get candles based on resolution (compatible with Finnhub resolution format)
   * Resolutions: 1, 5, 15, 30, 60 (minutes), D (daily), W (weekly), M (monthly)
   */
  async getCandles(symbol, resolution, from, to) {
    // Calculate days from timestamps
    const fromDate = new Date(parseInt(from) * 1000);
    const toDate = new Date(parseInt(to) * 1000);
    const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));

    switch (resolution) {
      case 'W':
        const weeks = Math.ceil(days / 7);
        return this.getWeeklyCandles(symbol, weeks);

      case 'D':
        return this.getDailyCandles(symbol, days);

      case '60':
        return this.getIntradayCandles(symbol, '60min', days);

      case '30':
        return this.getIntradayCandles(symbol, '30min', days);

      case '15':
        return this.getIntradayCandles(symbol, '15min', days);

      case '5':
        return this.getIntradayCandles(symbol, '5min', days);

      case '1':
        return this.getIntradayCandles(symbol, '1min', days);

      default:
        // Default to daily
        return this.getDailyCandles(symbol, days);
    }
  }

  /**
   * Get real-time quote (Global Quote endpoint)
   * Returns data in Finnhub format: { c, h, l, o, pc, t }
   */
  async getQuote(symbol) {
    const cacheKey = `quote:${symbol}`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase()
      });

      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error('No quote data returned from Alpha Vantage');
      }

      // Convert to Finnhub format
      return {
        c: parseFloat(quote['05. price']),           // Current price
        h: parseFloat(quote['03. high']),            // Day high
        l: parseFloat(quote['04. low']),             // Day low
        o: parseFloat(quote['02. open']),            // Open price
        pc: parseFloat(quote['08. previous close']), // Previous close
        t: Math.floor(Date.now() / 1000)             // Current timestamp
      };
    });
  }

  /**
   * Get company overview/profile
   * Returns data in Finnhub-compatible format
   */
  async getCompanyOverview(symbol) {
    const cacheKey = `overview:${symbol}`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'OVERVIEW',
        symbol: symbol.toUpperCase()
      });

      if (!data || !data.Symbol) {
        throw new Error('No company data returned from Alpha Vantage');
      }

      // Convert to Finnhub profile format
      return {
        name: data.Name || symbol,
        ticker: data.Symbol,
        exchange: data.Exchange,
        country: data.Country,
        currency: data.Currency,
        finnhubIndustry: data.Industry || data.Sector,
        weburl: null, // Alpha Vantage doesn't provide website
        marketCapitalization: data.MarketCapitalization
          ? parseFloat(data.MarketCapitalization) / 1e6  // Convert to millions like Finnhub
          : null,
        logo: null, // Alpha Vantage doesn't provide logos
        ipo: data.IPODate || null,
        phone: data.Phone || null,
        shareOutstanding: data.SharesOutstanding
          ? parseFloat(data.SharesOutstanding) / 1e6  // Convert to millions
          : null
      };
    });
  }

  /**
   * Search for symbols
   * Returns data in Finnhub-compatible format: { count, result: [...] }
   */
  async searchSymbols(query) {
    const cacheKey = `search:${query}`;

    return this.getCached(cacheKey, async () => {
      const data = await this.request({
        function: 'SYMBOL_SEARCH',
        keywords: query
      });

      const matches = data.bestMatches || [];

      // Convert to Finnhub search result format
      const result = matches.map(match => ({
        description: match['2. name'],
        displaySymbol: match['1. symbol'],
        symbol: match['1. symbol'],
        type: match['3. type'] || 'Stock'
      }));

      return {
        count: result.length,
        result
      };
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const alphaVantageService = new AlphaVantageService();
export default alphaVantageService;
