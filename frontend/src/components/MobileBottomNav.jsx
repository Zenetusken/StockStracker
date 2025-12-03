import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Star,
  Briefcase,
  Bell,
  MoreHorizontal,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

/**
 * Mobile Bottom Navigation
 * #148: Bottom navigation bar for mobile devices
 * Only visible on screens smaller than 640px (sm breakpoint)
 */
function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/watchlist', icon: Star, label: 'Watchlist' },
    { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
  ];

  const moreItems = [
    { path: '/screener', icon: Filter, label: 'Screener' },
    { path: '/market', icon: TrendingUp, label: 'Market' },
  ];

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu popup */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-line z-50 sm:hidden animate-slide-up">
          <div className="p-2 space-y-1">
            {moreItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setShowMore(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-primary hover:bg-card-hover'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-panel border-t border-line z-50 sm:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive(item.path)
                  ? 'text-brand'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              aria-label={item.label}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </button>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              showMore
                ? 'text-brand'
                : 'text-text-muted hover:text-text-primary'
            }`}
            aria-label="More options"
            aria-expanded={showMore}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-xs mt-1 font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default MobileBottomNav;
