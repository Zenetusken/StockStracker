import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTheme, getStoredTheme, applyTheme, getAllThemes, defaultTheme } from '../themes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentThemeId, setCurrentThemeId] = useState(defaultTheme);
  
  // Initialize state lazily from localStorage to ensure it matches initial render if possible
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('stocktracker-dark-mode') === 'true';
    }
    return false;
  });

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setCurrentThemeId(storedTheme);
    // We need to know if it's dark mode to apply the correct colors immediately
    // But isDarkMode state might not be ready if we rely on the lazy init above?
    // Actually, the lazy init runs synchronously during render, so isDarkMode is ready.
    applyTheme(storedTheme, isDarkMode);
  }, []);

  // Change theme
  const changeTheme = useCallback((themeId) => {
    setCurrentThemeId(themeId);
    applyTheme(themeId, isDarkMode);
  }, [isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Set dark mode explicitly
  const setDarkMode = useCallback((value) => {
    setIsDarkMode(value);
  }, []);

  // Apply dark mode class whenever isDarkMode changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('stocktracker-dark-mode', 'true');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('stocktracker-dark-mode', 'false');
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
