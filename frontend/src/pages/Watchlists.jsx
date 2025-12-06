import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Plus, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import { useWatchlistStore } from '../stores/watchlistStore';
import { getWatchlistIcon } from '../components/WatchlistIcons';
import NewWatchlistModal from '../components/NewWatchlistModal';

function Watchlists() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { watchlists, isLoading, fetchWatchlists } = useWatchlistStore();

  useEffect(() => {
    fetchWatchlists().catch(console.error);
  }, [fetchWatchlists]);

  const handleWatchlistClick = (watchlistId) => {
    navigate(`/watchlist/${watchlistId}`);
  };

  const handleCreateSuccess = (newWatchlist) => {
    setIsCreateModalOpen(false);
    // Navigate to the new watchlist
    if (newWatchlist?.id) {
      navigate(`/watchlist/${newWatchlist.id}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Watchlists
            </h1>
            <p className="text-text-muted">
              Track and organize your favorite stocks
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Watchlist</span>
          </button>
        </div>

        {/* Loading state */}
        {isLoading && watchlists.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-page-bg rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-page-bg rounded w-24 mb-2"></div>
                    <div className="h-3 bg-page-bg rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && watchlists.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              No watchlists yet
            </h3>
            <p className="text-text-muted mb-6 max-w-md mx-auto">
              Create your first watchlist to start tracking stocks you're interested in.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Watchlist</span>
            </button>
          </div>
        )}

        {/* Watchlist grid */}
        {watchlists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {watchlists.map((watchlist) => {
              const WatchlistIcon = getWatchlistIcon(watchlist.icon);
              return (
                <div
                  key={watchlist.id}
                  onClick={() => handleWatchlistClick(watchlist.id)}
                  className="bg-card rounded-lg p-6 cursor-pointer hover:shadow-lg hover:border-brand/30 border border-transparent transition-all group"
                >
                  {/* Icon and name */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${watchlist.color}20` }}
                      >
                        <WatchlistIcon
                          className="w-5 h-5"
                          style={{ color: watchlist.color }}
                          fill={watchlist.color}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary group-hover:text-brand transition-colors">
                          {watchlist.name}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {watchlist.item_count || 0} stock{watchlist.item_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-brand transition-colors" />
                  </div>

                  {/* Default badge */}
                  {watchlist.is_default && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-brand/10 text-brand text-xs font-medium rounded">
                      <Star className="w-3 h-3" />
                      Default
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add new watchlist card */}
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-card/50 border-2 border-dashed border-line rounded-lg p-6 cursor-pointer hover:border-brand/50 hover:bg-card transition-all flex flex-col items-center justify-center min-h-[140px]"
            >
              <div className="w-10 h-10 rounded-lg bg-page-bg flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-text-muted" />
              </div>
              <p className="text-sm text-text-muted">Add Watchlist</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <NewWatchlistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Layout>
  );
}

export default Watchlists;
