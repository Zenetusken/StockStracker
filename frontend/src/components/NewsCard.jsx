import { ExternalLink, Clock, Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * NewsCard Component
 * Displays a news article with headline, summary, source, timestamp,
 * sentiment indicator (#98), and related symbols (#99)
 */

// Keyword-based sentiment analysis (#98)
const POSITIVE_KEYWORDS = [
  'surge', 'soar', 'jump', 'gain', 'rise', 'rally', 'upgrade', 'beat', 'exceed',
  'profit', 'growth', 'bullish', 'optimistic', 'record', 'breakthrough', 'success',
  'boost', 'climb', 'advance', 'positive', 'strong', 'outperform', 'buy', 'upside',
  'expansion', 'revenue', 'dividend', 'acquisition'
];

const NEGATIVE_KEYWORDS = [
  'fall', 'drop', 'plunge', 'crash', 'decline', 'loss', 'downgrade', 'miss', 'fail',
  'bearish', 'concern', 'risk', 'warning', 'layoff', 'cut', 'lawsuit', 'investigation',
  'tumble', 'sink', 'slump', 'negative', 'weak', 'underperform', 'sell', 'downside',
  'recession', 'bankruptcy', 'fraud', 'scandal'
];

function analyzeSentiment(headline = '', summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();

  let positiveScore = 0;
  let negativeScore = 0;

  POSITIVE_KEYWORDS.forEach(word => {
    if (text.includes(word)) positiveScore++;
  });

  NEGATIVE_KEYWORDS.forEach(word => {
    if (text.includes(word)) negativeScore++;
  });

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

function NewsCard({ article }) {
  const navigate = useNavigate();
  const {
    headline,
    summary,
    source,
    url,
    image,
    datetime,
    category,
    related,
  } = article;

  // Calculate sentiment (#98)
  const sentiment = analyzeSentiment(headline, summary);

  // Parse related symbols (#99)
  const relatedSymbols = related
    ? related.split(',').map(s => s.trim()).filter(s => s.length > 0 && s.length <= 5)
    : [];

  // Format datetime (Finnhub returns Unix timestamp in seconds)
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  };

  // Sentiment display config
  const sentimentConfig = {
    positive: {
      icon: TrendingUp,
      label: 'Bullish',
      className: 'text-gain bg-gain/10',
    },
    negative: {
      icon: TrendingDown,
      label: 'Bearish',
      className: 'text-loss bg-loss/10',
    },
    neutral: {
      icon: Minus,
      label: 'Neutral',
      className: 'text-text-muted bg-text-muted/10',
    },
  };

  const SentimentIcon = sentimentConfig[sentiment].icon;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="news-card"
      className="block bg-card hover:bg-card-hover rounded-lg shadow transition-colors overflow-hidden"
    >
      <div className="flex gap-4 p-4">
        {/* Article Image */}
        {image && (
          <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-24">
            <img
              src={image}
              alt=""
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Article Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-text-primary font-semibold line-clamp-2 flex-1" data-testid="news-headline">
              {headline}
            </h3>
            {/* Sentiment Indicator (#98) */}
            <span
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sentimentConfig[sentiment].className}`}
              title={`Sentiment: ${sentimentConfig[sentiment].label}`}
              data-testid="news-sentiment"
              data-sentiment={sentiment}
            >
              <SentimentIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{sentimentConfig[sentiment].label}</span>
            </span>
          </div>

          {summary && (
            <p className="text-text-secondary text-sm mb-2 line-clamp-2">
              {summary}
            </p>
          )}

          {/* Related Symbols (#99) - using buttons to avoid nested <a> tags */}
          {relatedSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {relatedSymbols.slice(0, 5).map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/stock/${symbol}`);
                  }}
                  className="px-2 py-0.5 bg-brand/10 text-brand rounded text-xs font-medium hover:bg-brand/20 transition-colors cursor-pointer"
                >
                  ${symbol}
                </button>
              ))}
              {relatedSymbols.length > 5 && (
                <span className="px-2 py-0.5 text-text-muted text-xs">
                  +{relatedSymbols.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-3 text-xs text-text-muted">
            {source && (
              <span className="flex items-center gap-1">
                <Newspaper className="w-3 h-3" />
                {source}
              </span>
            )}
            {datetime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(datetime)}
              </span>
            )}
            {category && (
              <span className="px-2 py-0.5 bg-page-bg text-text-muted rounded text-xs">
                {category}
              </span>
            )}
            <ExternalLink className="w-3 h-3 ml-auto" />
          </div>
        </div>
      </div>
    </a>
  );
}

export default NewsCard;
