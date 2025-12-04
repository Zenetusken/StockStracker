/* eslint-disable react-refresh/only-export-components -- Context file exports both Provider and hook */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTheme, getStoredTheme, applyTheme, getAllThemes, defaultTheme } from '../themes';

const ThemeContext = createContext(null);

// Get stored theme mode preference (light/dark/system)
function getStoredThemeMode() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('stocktracker-theme-mode') || 'system';
  }
  return 'system';
}

// Check if system prefers dark mode
function getSystemDarkMode() {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function ThemeProvider({ children }) {
  const [currentThemeId, setCurrentThemeId] = useState(defaultTheme);

  // Theme mode: 'light' | 'dark' | 'system'
  const [themeMode, setThemeModeState] = useState(() => getStoredThemeMode());

  // Computed dark mode based on theme mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const mode = getStoredThemeMode();
    if (mode === 'system') {
      return getSystemDarkMode();
    }
    return mode === 'dark';
  });

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setCurrentThemeId(storedTheme);
    applyTheme(storedTheme, isDarkMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount
  }, []);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Change theme
  const changeTheme = useCallback((themeId) => {
    setCurrentThemeId(themeId);
    applyTheme(themeId, isDarkMode);
  }, [isDarkMode]);

  // Toggle dark mode (switches between light and dark, exits system mode)
  const toggleDarkMode = useCallback(() => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    setThemeModeState(newDarkMode ? 'dark' : 'light');
    localStorage.setItem('stocktracker-theme-mode', newDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Set dark mode explicitly
  const setDarkMode = useCallback((value) => {
    setIsDarkMode(value);
    setThemeModeState(value ? 'dark' : 'light');
    localStorage.setItem('stocktracker-theme-mode', value ? 'dark' : 'light');
  }, []);

  // Set theme mode (light/dark/system)
  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    localStorage.setItem('stocktracker-theme-mode', mode);

    if (mode === 'system') {
      setIsDarkMode(getSystemDarkMode());
    } else {
      setIsDarkMode(mode === 'dark');
    }
  }, []);

  // Apply dark mode class whenever isDarkMode changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Re-apply theme to update colors based on new dark mode state
    applyTheme(currentThemeId, isDarkMode);
  }, [isDarkMode, currentThemeId]);

  const currentTheme = getTheme(currentThemeId);
  const themes = getAllThemes();

  const value = {
    currentThemeId,
    currentTheme,
    themes,
    changeTheme,
    isDarkMode,
    toggleDarkMode,
    setDarkMode,
    themeMode,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
