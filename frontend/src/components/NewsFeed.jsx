import { useState, useEffect, useRef, useCallback } from 'react';
import { Newspaper, AlertCircle, RefreshCw, Loader2, Filter } from 'lucide-react';
import NewsCard from './NewsCard';
import { useNewsStore } from '../stores/newsStore';

/**
 * NewsFeed Component
 * Fetches and displays news articles with infinite scroll (#100),
 * category filters (#101), and enhanced refresh (#102)
 *
 * Props:
 * - symbol: Stock symbol for company-specific news (optional)
 * - category: Initial news category for market news
 * - title: Section title
 * - pageSize: Articles per page (default: 10)
 * - showFilters: Show category filter buttons (default: true for market news)
 */

const NEWS_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'canada', label: '🇨🇦 Canada' },
  { id: 'forex', label: 'Forex' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'merger', label: 'M&A' },
];

// Helper to detect Canadian stock symbols (TSX, TSXV, CSE)
function isCanadianStock(symbol) {
  if (!symbol) return false;
  return /\.(TO|V|CN)$/i.test(symbol.toUpperCase());
}

function NewsFeed({
  symbol,
  category: initialCategory = 'general',
  title = 'News',
  pageSize = 10,
  showFilters = true,
}) {
  // Use newsStore for cached data fetching
  const fetchNewsFromStore = useNewsStore((state) => state.fetchNews);

  // Local state for UI (pagination, category selection)
  const [displayedNews, setDisplayedNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ref for infinite scroll observer
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Track all fetched articles for pagination simulation
  const allArticlesRef = useRef([]);
  const displayedCountRef = useRef(0);

  // Fetch news (uses store caching)
  const fetchNews = useCallback(async (reset = false, forceRefresh = false) => {
    if (reset) {
      setLoading(true);
      setDisplayedNews([]);
      allArticlesRef.current = [];
      displayedCountRef.current = 0;
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      // Use store's fetchNews which handles caching and deduplication
      const articles = await fetchNewsFromStore(symbol, category, forceRefresh);
      allArticlesRef.current = articles || [];

      // Simulate pagination with slice (#100)
      const nextCount = reset ? pageSize : displayedCountRef.current + pageSize;
      const displayArticles = allArticlesRef.current.slice(0, nextCount);
      displayedCountRef.current = displayArticles.length;

      setDisplayedNews(displayArticles);
      setHasMore(displayArticles.length < allArticlesRef.current.length);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Unable to load news articles');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [symbol, category, pageSize, fetchNewsFromStore]);

  // Load more articles (#100)
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    const nextCount = displayedCountRef.current + pageSize;
    const displayArticles = allArticlesRef.current.slice(0, nextCount);
    displayedCountRef.current = displayArticles.length;

    setDisplayedNews(displayArticles);
    setHasMore(displayArticles.length < allArticlesRef.current.length);
  }, [loadingMore, hasMore, pageSize]);

  // Refresh handler (#102) - force refresh bypasses cache
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNews(true, true); // reset=true, forceRefresh=true
  }, [fetchNews]);

  // Category change handler (#101)
  const handleCategoryChange = useCallback((newCategory) => {
    if (newCategory !== category) {
      setCategory(newCategory);
    }
  }, [category]);

  // Initial fetch and category change
  useEffect(() => {
    fetchNews(true);
  }, [symbol, category]);

  // Intersection Observer for infinite scroll (#100)
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, loadMore]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow p-6" data-testid="news-feed-loading">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-6" data-testid="news-feed-error">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-text-muted mb-2" />
          <p className="text-text-muted mb-4">{error}</p>
          <button
            onClick={() => fetchNews(true)}
            data-testid="news-retry-button"
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (displayedNews.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow p-6" data-testid="news-feed-empty">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            {title}
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="news-refresh-button"
            className="p-2 text-text-muted hover:text-text-primary hover:bg-page-bg rounded-lg transition-colors disabled:opacity-50"
            title="Refresh news"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Category Filters (#101) */}
        {!symbol && showFilters && (
          <div className="flex flex-wrap gap-2 mb-4" data-testid="news-category-filters">
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                data-testid={`news-category-${cat.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === cat.id
                    ? 'bg-brand text-white'
                    : 'bg-page-bg text-text-secondary hover:bg-brand/10 hover:text-brand'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Newspaper className="w-10 h-10 text-text-muted mb-2" />
          {symbol && isCanadianStock(symbol) ? (
            <>
              <p className="text-text-muted mb-2">
                Company-specific news is not available for Canadian stocks.
              </p>
              <a
                href={`https://finance.yahoo.com/quote/${symbol}/news`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline text-sm"
              >
                View news on Yahoo Finance
              </a>
            </>
          ) : (
            <p className="text-text-muted">No news articles available</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow p-6" data-testid="news-feed">
      {/* Header with refresh button (#102) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="news-refresh-button"
          className="p-2 text-text-muted hover:text-text-primary hover:bg-page-bg rounded-lg transition-colors disabled:opacity-50"
          title="Refresh news"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category Filters (#101) - only for market news */}
      {!symbol && showFilters && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="news-category-filters">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              data-testid={`news-category-${cat.id}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                category === cat.id
                  ? 'bg-brand text-white'
                  : 'bg-page-bg text-text-secondary hover:bg-brand/10 hover:text-brand'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* News Articles */}
      <div className="space-y-3">
        {displayedNews.map((article, index) => (
          <NewsCard key={article.id || article.url || index} article={article} />
        ))}
      </div>

      {/* Infinite scroll trigger (#100) */}
      <div ref={loadMoreRef} className="py-4">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
        {!hasMore && displayedNews.length > 0 && (
          <p className="text-center text-text-muted text-sm">
            No more articles
          </p>
        )}
      </div>
    </div>
  );
}

export default NewsFeed;
