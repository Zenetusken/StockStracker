import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, Eye } from 'lucide-react';
import { useWatchlistStore } from '../stores/watchlistStore';
import { getWatchlistIcon } from './WatchlistIcons';

export default function WatchlistSummaryCard() {
  const navigate = useNavigate();
  const { watchlists, isLoading, fetchWatchlists } = useWatchlistStore();

  useEffect(() => {
    fetchWatchlists().catch(console.error);
  }, [fetchWatchlists]);

  // Calculate totals
  const totalStocks = watchlists.reduce((sum, w) => sum + (w.item_count || 0), 0);

  const handleClick = () => {
    // Navigate to watchlists overview page
    navigate('/watchlists');
  };

  // Loading state
  if (isLoading && watchlists.length === 0) {
    return (
      <div className="rounded-lg shadow bg-card p-6 h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">Watchlists</h3>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-page-bg rounded w-3/4"></div>
          <div className="h-4 bg-page-bg rounded w-1/2"></div>
          <div className="h-4 bg-page-bg rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (watchlists.length === 0) {
    return (
      <div
        onClick={() => navigate('/watchlists')}
        className="rounded-lg shadow bg-card p-6 cursor-pointer hover:shadow-md transition-shadow h-full"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">Watchlists</h3>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">
          Create a watchlist to track your favorite stocks
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="rounded-lg shadow bg-card p-6 cursor-pointer hover:shadow-md transition-shadow h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">Watchlists</h3>
        </div>
        <ChevronRight className="w-5 h-5 text-text-muted" />
      </div>

      {/* Summary Stats */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-brand" />
          <span className="text-2xl font-bold text-text-primary">{totalStocks}</span>
          <span className="text-sm text-text-muted">stocks tracked</span>
        </div>
      </div>

      {/* Watchlist previews */}
      <div className="space-y-2">
        {watchlists.slice(0, 3).map((watchlist) => {
          const WatchlistIcon = getWatchlistIcon(watchlist.icon);
          return (
            <div
              key={watchlist.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <WatchlistIcon
                  className="w-4 h-4"
                  style={{ color: watchlist.color }}
                  fill={watchlist.color}
                />
                <span className="text-text-primary truncate max-w-[120px]">
                  {watchlist.name}
                </span>
              </div>
              <span className="text-text-muted">
                {watchlist.item_count || 0}
              </span>
            </div>
          );
        })}
        {watchlists.length > 3 && (
          <p className="text-xs text-text-muted">
            +{watchlists.length - 3} more watchlist{watchlists.length - 3 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
