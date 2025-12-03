import { ExternalLink, Clock, Newspaper } from 'lucide-react';

/**
 * NewsCard Component
 * Displays a news article with headline, summary, source, and timestamp
 */
function NewsCard({ article }) {
  const {
    headline,
    summary,
    source,
    url,
    image,
    datetime,
    category,
  } = article;

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

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
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
          <h3 className="text-text-primary font-semibold mb-1 line-clamp-2">
            {headline}
          </h3>

          {summary && (
            <p className="text-text-secondary text-sm mb-2 line-clamp-2">
              {summary}
            </p>
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
              <span className="px-2 py-0.5 bg-brand/10 text-brand rounded text-xs">
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
