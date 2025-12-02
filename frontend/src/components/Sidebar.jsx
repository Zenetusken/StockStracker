import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, TrendingUp, List, Settings } from 'lucide-react';
import { useWatchlistStore } from '../stores/watchlistStore';
import { getWatchlistIcon } from './WatchlistIcons';

function Sidebar({ onCreateWatchlist }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Get watchlists from centralized store
  const watchlists = useWatchlistStore((state) => state.watchlists);
  const loading = useWatchlistStore((state) => state.isLoading);
  const fetchWatchlists = useWatchlistStore((state) => state.fetchWatchlists);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside className="w-64 bg-panel border-r-2 border-line h-screen flex flex-col shadow-sm">
      {/* Sidebar Header - aligns with main header */}
      <div className="px-4 py-4 border-b border-line">
        <h2 className="text-lg font-semibold text-text-primary tracking-tight">Navigation</h2>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/dashboard')
                ? 'bg-accent-light text-accent'
                : 'text-text-primary hover:bg-panel-hover'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Dashboard
          </button>

          <button
            onClick={() => navigate('/portfolio')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/portfolio')
                ? 'bg-accent-light text-accent'
                : 'text-text-primary hover:bg-panel-hover'
            }`}
          >
            <List className="w-5 h-5" />
            Portfolio
          </button>
        </div>

        {/* Watchlists Section */}
        <div>
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Watchlists
            </h3>
            <button
              onClick={onCreateWatchlist}
              className="p-1 hover:bg-panel-hover rounded transition-colors"
              title="Create new watchlist"
            >
              <Plus className="w-4 h-4 text-brand" />
            </button>
          </div>

          {loading ? (
            <div className="px-3 py-2 text-sm text-text-secondary">
              Loading...
            </div>
          ) : watchlists.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-secondary">
              No watchlists yet
            </div>
          ) : (
            <div className="space-y-1">
              {watchlists.map((watchlist) => (
                <button
                  key={watchlist.id}
                  onClick={() => navigate(`/watchlist/${watchlist.id}`)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === `/watchlist/${watchlist.id}`
                      ? 'bg-accent-light text-accent'
                      : 'text-text-primary hover:bg-panel-hover'
                  }`}
                >
                  {(() => {
                    const WatchlistIcon = getWatchlistIcon(watchlist.icon);
                    return (
                      <WatchlistIcon
                        className="w-4 h-4"
                        style={{ color: watchlist.color }}
                        fill={watchlist.is_default ? watchlist.color : 'none'}
                      />
                    );
                  })()}
                  <span className="truncate flex-1 text-left">{watchlist.name}</span>
                  {watchlist.item_count > 0 && (
                    <span className="text-xs text-text-secondary">
                      {watchlist.item_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="p-4 border-t-2 border-line">
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/settings')
              ? 'bg-accent-light text-accent'
              : 'text-text-primary hover:bg-panel-hover'
          }`}
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
