import { useState } from 'react';
import { Palette, Sun, Moon, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeSwitcher() {
  const { currentThemeId, currentTheme, themes, changeTheme, isDarkMode, toggleDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${isOpen ? 'z-50' : ''}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel hover:bg-panel-hover transition-colors"
      >
        <Palette className="w-4 h-4 text-brand" />
        <span className="text-sm font-medium text-text-primary">
          {currentTheme.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-72 bg-card rounded-xl shadow-xl border border-line z-50 overflow-hidden">
            {/* Dark mode toggle */}
            <div className="p-3 border-b border-line">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleDarkMode();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {isDarkMode ? (
                    <Moon className="w-5 h-5 text-brand" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                  <span className="text-sm font-medium text-text-primary">
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${isDarkMode ? 'bg-brand' : 'bg-line'} relative`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </button>
            </div>

            {/* Theme list */}
            <div className="p-2 max-h-80 overflow-y-auto">
              <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Color Themes
              </p>
              <div className="space-y-1">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      changeTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      currentThemeId === theme.id
                        ? 'bg-mint-light'
                        : 'hover:bg-card-hover'
                    }`}
                  >
                    {/* Color preview dots */}
                    <div className="flex -space-x-1">
                      <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.preview?.[0] || theme.colors.brand }}
                      />
                      <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.preview?.[1] || theme.colors.accent }}
                      />
                      <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.preview?.[2] || theme.colors.card }}
                      />
                    </div>

                    {/* Theme info */}
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-text-primary">
                        {theme.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {theme.description}
                      </p>
                    </div>

                    {/* Active checkmark */}
                    {currentThemeId === theme.id && (
                      <Check className="w-4 h-4 text-brand" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
