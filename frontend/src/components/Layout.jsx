import { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import NewWatchlistModal from './NewWatchlistModal';
import { ApiKeysModal } from './api-keys';
import { LogoFull } from './Logo';

function Layout({ children }) {
  const [isNewWatchlistModalOpen, setIsNewWatchlistModalOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const searchBarRef = useRef(null);

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
        onOpenApiKeysModal={() => setIsApiKeysModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Simplified: Logo + Search on one row */}
        <header className="bg-panel shadow-sm border-b-2 border-line sticky top-0 z-10" role="banner" aria-label="Site header">
          <div className="px-6 lg:px-8 py-4">
            <div className="flex items-center gap-6">
              <LogoFull size="md" />
              {/* Search Bar - Cmd+K / Ctrl+K to focus */}
              <div className="flex-1">
                <div className="max-w-xl">
                  <SearchBar ref={searchBarRef} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          id="main-content"
          className="flex-1 overflow-auto"
          tabIndex={-1}
          role="main"
          aria-label="Main content"
        >
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
