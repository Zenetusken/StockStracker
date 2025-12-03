import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import NewWatchlistModal from './NewWatchlistModal';
import { ApiKeyStatusIndicator, ApiKeysModal } from './api-keys';
import ThemeSwitcher from './ThemeSwitcher';
import { LogoFull } from './Logo';
import { useAuthStore } from '../stores/authStore';

function Layout({ children }) {
  const navigate = useNavigate();
  const [isNewWatchlistModalOpen, setIsNewWatchlistModalOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const searchBarRef = useRef(null);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Global Cmd+K / Ctrl+K shortcut to focus search
  const handleGlobalKeyDown = useCallback((event) => {
    // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      searchBarRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const handleLogout = async () => {
    try {
      await logout();
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
    <div className="min-h-screen bg-page-bg flex">
      {/* Sidebar */}
      <Sidebar
        key={sidebarKey}
        onCreateWatchlist={() => setIsNewWatchlistModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-panel shadow-sm border-b-2 border-line">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <LogoFull size="md" />
              <div className="flex items-center gap-4">
                {user && (
                  <span className="text-sm text-text-muted" id="user-email">
                    {user.email}
                  </span>
                )}
                <ThemeSwitcher />
                <ApiKeyStatusIndicator onClick={() => setIsApiKeysModalOpen(true)} />
                <Link
                  to="/settings"
                  className="p-2 rounded-lg text-text-muted hover:bg-panel-hover hover:text-text-primary transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-panel-hover hover:text-text-primary transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
            {/* Search Bar - Cmd+K / Ctrl+K to focus */}
            <div className="flex justify-center">
              <SearchBar ref={searchBarRef} />
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

      {/* API Keys Modal */}
      <ApiKeysModal
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
      />
    </div>
  );
}

export default Layout;
