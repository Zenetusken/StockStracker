import fs from 'fs';

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
    this.apiKey = this.loadApiKey();
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes for historical data
  }

  loadApiKey() {
    try {
      // Try to load from /tmp/api-key/alphavantage.key first
      const apiKeyPath = '/tmp/api-key/alphavantage.key';
      if (fs.existsSync(apiKeyPath)) {
        const key = fs.readFileSync(apiKeyPath, 'utf8').trim();
        console.log('✓ Alpha Vantage API key loaded from /tmp/api-key/alphavantage.key');
        return key;
      }
    } catch (error) {
      console.warn('Could not load API key from /tmp/api-key/alphavantage.key:', error.message);
    }

    // Fallback to environment variable
    if (process.env.ALPHAVANTAGE_API_KEY) {
      console.log('✓ Alpha Vantage API key loaded from environment variable');
      return process.env.ALPHAVANTAGE_API_KEY;
    }

    console.warn('⚠ No Alpha Vantage API key found - historical chart data will use mock data');
    console.warn('  Get a free key at: https://www.alphavantage.co/support/#api-key');
    console.warn('  Save it to: /tmp/api-key/alphavantage.key');
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

    const url = new URL(this.baseUrl);
    url.searchParams.append('apikey', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      // Rate limit warning
      console.warn('Alpha Vantage rate limit warning:', data['Note']);
    }

    if (data['Information']) {
      throw new Error(`Alpha Vantage: ${data['Information']}`);
    }

    return data;
  }

  /**
   * Get daily OHLCV data
   * Returns data in Finnhub candle format for compatibility: { c: [], h: [], l: [], o: [], t: [], v: [], s: 'ok' }
   */
  async getDailyCandles(symbol, days = 100) {
    const cacheKey = `daily:${symbol}:${days}`;

    return this.getCached(cacheKey, async () => {
      const outputsize = days > 100 ? 'full' : 'compact';

      const data = await this.request({
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        outputsize
      });

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No data returned from Alpha Vantage');
      }

      // Convert Alpha Vantage format to Finnhub candle format
      const dates = Object.keys(timeSeries).sort(); // Sort dates ascending
      const recentDates = dates.slice(-days); // Get last N days

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
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const alphaVantageService = new AlphaVantageService();
export default alphaVantageService;
