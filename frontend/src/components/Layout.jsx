import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import NewWatchlistModal from './NewWatchlistModal';

function Layout({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isNewWatchlistModalOpen, setIsNewWatchlistModalOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);

  useEffect(() => {
    // Get user from sessionStorage
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      sessionStorage.removeItem('user');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleWatchlistCreated = () => {
    // Refresh the sidebar by updating its key
    setSidebarKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex">
      {/* Sidebar */}
      <Sidebar
        key={sidebarKey}
        onCreateWatchlist={() => setIsNewWatchlistModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                StockTracker Pro
              </h1>
              <div className="flex items-center gap-4">
                {user && (
                  <span className="text-sm text-gray-600 dark:text-gray-400" id="user-email">
                    {user.email}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
            {/* Search Bar */}
            <div className="flex justify-center">
              <SearchBar />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* New Watchlist Modal */}
      <NewWatchlistModal
        isOpen={isNewWatchlistModalOpen}
        onClose={() => setIsNewWatchlistModalOpen(false)}
        onSuccess={handleWatchlistCreated}
      />
    </div>
  );
}

export default Layout;
