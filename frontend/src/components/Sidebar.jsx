import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Star, TrendingUp, List, Settings } from 'lucide-react';

function Sidebar({ onCreateWatchlist }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlists();

    // Listen for watchlist updates
    const handleWatchlistUpdate = () => {
      fetchWatchlists();
    };

    window.addEventListener('watchlist-updated', handleWatchlistUpdate);

    return () => {
      window.removeEventListener('watchlist-updated', handleWatchlistUpdate);
    };
  }, []);

  const fetchWatchlists = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/watchlists', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWatchlists(data);
      }
    } catch (error) {
      console.error('Error fetching watchlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col">
      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/dashboard')
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Dashboard
          </button>

          <button
            onClick={() => navigate('/portfolio')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/portfolio')
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <List className="w-5 h-5" />
            Portfolio
          </button>
        </div>

        {/* Watchlists Section */}
        <div>
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Watchlists
            </h3>
            <button
              onClick={onCreateWatchlist}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Create new watchlist"
            >
              <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : watchlists.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
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
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Star
                    className="w-4 h-4"
                    style={{ color: watchlist.color }}
                    fill={watchlist.is_default ? watchlist.color : 'none'}
                  />
                  <span className="truncate flex-1 text-left">{watchlist.name}</span>
                  {watchlist.item_count > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
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
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/settings')
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
