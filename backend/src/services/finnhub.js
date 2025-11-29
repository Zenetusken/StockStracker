import fs from 'fs';

/**
 * Mock data for development/demo when API key is not available
 */
const MOCK_DATA = {
  quotes: {
    AAPL: { c: 178.72, h: 179.50, l: 177.25, o: 178.10, pc: 177.50, t: Date.now() / 1000 },
    GOOGL: { c: 140.25, h: 141.20, l: 139.50, o: 140.00, pc: 139.80, t: Date.now() / 1000 },
    MSFT: { c: 378.91, h: 380.25, l: 377.40, o: 378.00, pc: 377.20, t: Date.now() / 1000 },
    TSLA: { c: 242.84, h: 245.30, l: 240.10, o: 241.50, pc: 240.50, t: Date.now() / 1000 },
    AMZN: { c: 152.48, h: 153.90, l: 151.20, o: 152.00, pc: 151.50, t: Date.now() / 1000 },
  },
  profiles: {
    AAPL: { name: 'Apple Inc', ticker: 'AAPL', exchange: 'NASDAQ', country: 'US', currency: 'USD', finnhubIndustry: 'Technology' },
    GOOGL: { name: 'Alphabet Inc Class A', ticker: 'GOOGL', exchange: 'NASDAQ', country: 'US', currency: 'USD', finnhubIndustry: 'Technology' },
    MSFT: { name: 'Microsoft Corporation', ticker: 'MSFT', exchange: 'NASDAQ', country: 'US', currency: 'USD', finnhubIndustry: 'Technology' },
    TSLA: { name: 'Tesla Inc', ticker: 'TSLA', exchange: 'NASDAQ', country: 'US', currency: 'USD', finnhubIndustry: 'Auto Manufacturers' },
    AMZN: { name: 'Amazon.com Inc', ticker: 'AMZN', exchange: 'NASDAQ', country: 'US', currency: 'USD', finnhubIndustry: 'Retail' },
  },
  search: [
    { symbol: 'AAPL', displaySymbol: 'AAPL', description: 'Apple Inc', type: 'Common Stock' },
    { symbol: 'GOOGL', displaySymbol: 'GOOGL', description: 'Alphabet Inc Class A', type: 'Common Stock' },
    { symbol: 'MSFT', displaySymbol: 'MSFT', description: 'Microsoft Corporation', type: 'Common Stock' },
    { symbol: 'TSLA', displaySymbol: 'TSLA', description: 'Tesla Inc', type: 'Common Stock' },
    { symbol: 'AMZN', displaySymbol: 'AMZN', description: 'Amazon.com Inc', type: 'Common Stock' },
  ]
};

/**
 * Generate mock OHLC data for demonstration
 */
function generateMockCandles(symbol, days = 180) {
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 24 * 60 * 60;

  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];
  const v = [];

  // Get base price from mock quotes or use default
  let basePrice = 150;
  const mockQuote = MOCK_DATA.quotes[symbol];
  if (mockQuote) {
    basePrice = mockQuote.c;
  }

  // Generate candles going backwards in time
  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * dayInSeconds);
    const dayOffset = days - i;

    // Add some trend and randomness
    const trend = Math.sin(dayOffset / 20) * 10;
    const random = (Math.random() - 0.5) * 5;
    const dayPrice = basePrice + trend + random - (days - dayOffset) * 0.1;

    const open = dayPrice + (Math.random() - 0.5) * 2;
    const close = dayPrice + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    const volume = Math.floor(50000000 + Math.random() * 100000000);

    t.push(timestamp);
    o.push(parseFloat(open.toFixed(2)));
    h.push(parseFloat(high.toFixed(2)));
    l.push(parseFloat(low.toFixed(2)));
    c.push(parseFloat(close.toFixed(2)));
    v.push(volume);
  }

  return { c, h, l, o, t, v, s: 'ok' };
}

/**
 * Finnhub API Service
 * Provides market data with caching to respect rate limits (60 calls/minute)
 */

class FinnhubService {
  constructor() {
    this.baseUrl = 'https://finnhub.io/api/v1';
    this.apiKey = this.loadApiKey();
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10 seconds for quote data
    this.searchCacheTimeout = 300000; // 5 minutes for search/symbol data
  }

  loadApiKey() {
    try {
      // Try to load from /tmp/api-key/finnhub.io.key first
      const apiKeyPath = '/tmp/api-key/finnhub.io.key';
      if (fs.existsSync(apiKeyPath)) {
        const key = fs.readFileSync(apiKeyPath, 'utf8').trim();
        console.log('✓ Finnhub API key loaded from /tmp/api-key/finnhub.io.key');
        return key;
      }
    } catch (error) {
      console.warn('Could not load API key from /tmp/api-key/finnhub.io.key:', error.message);
    }

    // Fallback to environment variable
    if (process.env.FINNHUB_API_KEY) {
      console.log('✓ Finnhub API key loaded from environment variable');
      return process.env.FINNHUB_API_KEY;
    }

    // Use demo key as fallback (very limited)
    console.warn('⚠ Using Finnhub demo API key - limited functionality');
    return 'demo';
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

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('token', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Finnhub API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get real-time quote for a symbol
   * Returns: { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp }
   */
  async getQuote(symbol) {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    return this.getCached(cacheKey, async () => {
      try {
        return await this.request('/quote', { symbol: symbol.toUpperCase() });
      } catch (error) {
        // Log the actual error and throw - no mock fallback
        console.error(`❌ API call failed for ${symbol.toUpperCase()}:`, error.message);
        throw new Error(`Failed to fetch real-time quote for ${symbol.toUpperCase()}: ${error.message}`);
      }
    }, this.cacheTimeout);
  }

  /**
   * Get company profile
   * Returns: { name, ticker, country, currency, exchange, ipo, marketCapitalization, ... }
   */
  async getCompanyProfile(symbol) {
    const cacheKey = `profile:${symbol.toUpperCase()}`;
    return this.getCached(cacheKey, async () => {
      try {
        return await this.request('/stock/profile2', { symbol: symbol.toUpperCase() });
      } catch (error) {
        // Fallback to mock data
        const mockProfile = MOCK_DATA.profiles[symbol.toUpperCase()];
        if (mockProfile) {
          console.log(`Using mock profile for ${symbol.toUpperCase()}`);
          return mockProfile;
        }
        throw error;
      }
    }, this.searchCacheTimeout);
  }

  /**
   * Search for symbols
   * Returns: { count, result: [{ description, displaySymbol, symbol, type }] }
   */
  async searchSymbols(query) {
    const cacheKey = `search:${query.toLowerCase()}`;
    return this.getCached(cacheKey, async () => {
      try {
        return await this.request('/search', { q: query });
      } catch (error) {
        // Fallback to mock data
        console.log(`Using mock search results for "${query}"`);
        const results = MOCK_DATA.search.filter(item =>
          item.symbol.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
        );
        return { count: results.length, result: results };
      }
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
   * Get candles (OHLCV data)
   * Returns: { c: [], h: [], l: [], o: [], s: 'ok', t: [], v: [] }
   */
  async getCandles(symbol, resolution, from, to) {
    const cacheKey = `candles:${symbol}:${resolution}:${from}:${to}`;
    return this.getCached(cacheKey, async () => {
      try {
        return await this.request('/stock/candle', {
          symbol: symbol.toUpperCase(),
          resolution,
          from,
          to
        });
      } catch (error) {
        // Fallback to mock data
        console.log(`Using mock candle data for ${symbol.toUpperCase()}`);

        // Calculate number of days requested
        const fromDate = new Date(parseInt(from) * 1000);
        const toDate = new Date(parseInt(to) * 1000);
        const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));

        return generateMockCandles(symbol.toUpperCase(), Math.min(days, 365));
      }
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
   */
  async getEnrichedQuote(symbol) {
    const quoteData = await this.getQuote(symbol);
    const enriched = this.enrichQuote(symbol, quoteData);

    // Try to get volume (uses separate cache)
    if (enriched) {
      const volume = await this.getVolume(symbol);
      if (volume) {
        enriched.volume = volume;
      }
    }

    return enriched;
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
