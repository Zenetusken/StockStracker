import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';
import NewWatchlistModal from './NewWatchlistModal';
import { ApiKeysModal } from './api-keys';
import { LogoFull } from './Logo';
import { Menu, X } from 'lucide-react';

function Layout({ children }) {
  const location = useLocation();
  const [isNewWatchlistModalOpen, setIsNewWatchlistModalOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const searchBarRef = useRef(null);
  const prevPathnameRef = useRef(location.pathname);

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

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      // Use setTimeout to avoid synchronous setState in effect
      const timeout = setTimeout(() => setIsMobileSidebarOpen(false), 0);
      return () => clearTimeout(timeout);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-page-bg flex">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden sm:block">
        <Sidebar
          key={sidebarKey}
          onCreateWatchlist={() => setIsNewWatchlistModalOpen(true)}
          onOpenApiKeysModal={() => setIsApiKeysModalOpen(true)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out sm:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full">
          <Sidebar
            key={sidebarKey}
            onCreateWatchlist={() => {
              setIsNewWatchlistModalOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            onOpenApiKeysModal={() => {
              setIsApiKeysModalOpen(true);
              setIsMobileSidebarOpen(false);
            }}
          />
          {/* Close button */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-card-hover text-text-primary hover:bg-page-bg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-panel shadow-sm border-b-2 border-line sticky top-0 z-10" role="banner" aria-label="Site header">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 rounded-lg text-text-primary hover:bg-card-hover transition-colors sm:hidden"
                aria-label="Open menu"
                aria-expanded={isMobileSidebarOpen}
              >
                <Menu className="w-5 h-5" />
              </button>

              <LogoFull size="md" className="hidden sm:flex" />

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
