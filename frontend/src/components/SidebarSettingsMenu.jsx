import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LogOut,
  Key,
  User,
  ChevronUp,
  Sun,
  Moon,
  Monitor,
  Check,
  Palette,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { useApiKeysStore } from '../stores/apiKeysStore';

// Status configuration for API keys indicator
const STATUS_CONFIG = {
  healthy: {
    color: 'bg-emerald-500',
    pulse: false,
    label: 'All keys healthy',
  },
  warning: {
    color: 'bg-amber-500',
    pulse: true,
    label: 'Rate limit warning',
  },
  critical: {
    color: 'bg-rose-500',
    pulse: true,
    label: 'Rate limit critical',
  },
  not_configured: {
    color: 'bg-gray-400',
    pulse: false,
    label: 'No keys configured',
  },
};

export default function SidebarSettingsMenu({ onOpenApiKeysModal }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Auth store
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Theme context
  const { currentThemeId, themes, changeTheme, themeMode, setThemeMode } =
    useTheme();

  // API keys status - fetch services and get status
  const services = useApiKeysStore((state) => state.services);
  const fetchServices = useApiKeysStore((state) => state.fetchServices);
  const getOverallStatus = useApiKeysStore((state) => state.getOverallStatus);

  // Fetch services on mount
  useEffect(() => {
    fetchServices().catch(() => {
      // Silently fail - user may not be authenticated yet
    });
  }, [fetchServices]);

  // Get status (returns { status: 'xxx', color: 'xxx' })
  const apiStatusResult = getOverallStatus();
  const statusKey = apiStatusResult?.status || 'not_configured';
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.not_configured;

  // Count configured keys
  const totalKeys = services.reduce((sum, s) => sum + (s.active_keys || 0), 0);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  const handleThemeChange = (themeId) => {
    changeTheme(themeId);
  };

  const handleApiKeysClick = () => {
    setIsOpen(false);
    onOpenApiKeysModal?.();
  };

  const handleSecurityClick = () => {
    setIsOpen(false);
    navigate('/security');
  };

  return (
    <div className="relative p-4 border-t-2 border-line">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isOpen
            ? 'bg-white/10 text-text-primary shadow-inner ring-1 ring-white/20'
            : 'text-text-primary hover:bg-panel-hover'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isOpen ? 'ring-2 ring-brand/30' : ''}`}>
            <User className="w-4 h-4 text-brand" />
          </div>
          <span className="truncate">{user?.email?.split('@')[0] || 'Account'}</span>
        </div>
        <ChevronUp
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-0' : 'rotate-180'
          }`}
        />
      </button>

      {/* Menu panel - expands UPWARD */}
      {isOpen && (
        <>
          {/* Backdrop for click-outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu content */}
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-card rounded-xl shadow-xl border border-line z-50 overflow-hidden">
            {/* User section */}
            <div className="px-4 py-3 border-b border-line bg-card-hover/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user?.email || 'Not signed in'}
                  </p>
                  <Link
                    to="/settings"
                    onClick={() => setIsOpen(false)}
                    className="text-xs text-brand hover:underline"
                  >
                    Account settings
                  </Link>
                </div>
              </div>
            </div>

            {/* Theme mode selector - inline layout for narrow sidebar */}
            <div className="px-3 py-2 border-b border-line">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Theme
                </span>
                <div className="flex bg-surface-light rounded-lg p-0.5">
                  {[
                    { value: 'light', label: 'Light mode', Icon: Sun },
                    { value: 'dark', label: 'Dark mode', Icon: Moon },
                    { value: 'system', label: 'System preference', Icon: Monitor },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setThemeMode(item.value)}
                      title={item.label}
                      aria-label={item.label}
                      className={`p-2 rounded-md transition-all ${
                        themeMode === item.value
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-card-hover'
                      }`}
                    >
                      <item.Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color themes section */}
            <div className="px-3 py-2 border-b border-line">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <Palette className="w-4 h-4" />
                Color Themes
              </div>
              <div className="max-h-48 overflow-y-auto">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card-hover transition-colors"
                  >
                    {/* Theme color preview */}
                    <div
                      className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: theme.colors.brand }}
                    />
                    <span className="flex-1 text-left text-sm text-text-primary">
                      {theme.name}
                    </span>
                    {currentThemeId === theme.id && (
                      <Check className="w-4 h-4 text-brand" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* API Keys button */}
            <div className="px-3 py-2 border-b border-line">
              <button
                onClick={handleApiKeysClick}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-text-secondary" />
                  <span className="text-sm text-text-primary">API Keys</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {totalKeys > 0
                      ? `${totalKeys} key${totalKeys !== 1 ? 's' : ''}`
                      : statusConfig.label}
                  </span>
                  <span className="relative flex h-2.5 w-2.5" title={statusConfig.label}>
                    {statusConfig.pulse && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.color}`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusConfig.color}`}
                    />
                  </span>
                </div>
              </button>
            </div>

            {/* Security Dashboard button */}
            <div className="px-3 py-2 border-b border-line">
              <button
                onClick={handleSecurityClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-violet-500/10 transition-colors text-violet-600 dark:text-violet-400"
              >
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">Security Dashboard</span>
              </button>
            </div>

            {/* Logout button */}
            <div className="px-3 py-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-rose-500/10 transition-colors text-rose-500"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Log out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
