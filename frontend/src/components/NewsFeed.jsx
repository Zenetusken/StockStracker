import { useState, useEffect } from 'react';
import { Newspaper, AlertCircle, RefreshCw } from 'lucide-react';
import NewsCard from './NewsCard';
import api from '../api/client';

/**
 * NewsFeed Component
 * Fetches and displays news articles for a specific stock or general market news
 *
 * Props:
 * - symbol: Stock symbol for company-specific news (optional)
 * - category: News category for market news ('general', 'forex', 'crypto', 'merger')
 * - title: Section title
 * - limit: Maximum number of articles to display (default: 10)
 */
function NewsFeed({ symbol, category = 'general', title = 'News', limit = 10 }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      let response;
      if (symbol) {
        // Fetch company-specific news
        response = await api.get(`/news/${symbol}`);
      } else {
        // Fetch general market news
        response = await api.get(`/news/market/general?category=${category}`);
      }

      setNews(response.data.slice(0, limit));
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Unable to load news articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [symbol, category, limit]);

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
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

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-text-muted mb-2" />
          <p className="text-text-muted mb-4">{error}</p>
          <button
            onClick={fetchNews}
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Newspaper className="w-10 h-10 text-text-muted mb-2" />
          <p className="text-text-muted">No news articles available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {title}
        </h2>
        <button
          onClick={fetchNews}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-page-bg rounded-lg transition-colors"
          title="Refresh news"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {news.map((article) => (
          <NewsCard key={article.id || article.url} article={article} />
        ))}
      </div>
    </div>
  );
}

export default NewsFeed;
