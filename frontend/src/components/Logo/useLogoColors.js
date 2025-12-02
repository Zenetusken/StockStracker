import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Custom hook that provides theme-aware colors for logo components.
 * Maps theme tokens to logo-specific color roles.
 */
export function useLogoColors() {
  const { currentTheme, isDarkMode } = useTheme();

  return useMemo(() => {
    const colors = isDarkMode ? currentTheme.colorsDark : currentTheme.colors;

    return {
      // Crystal gradient colors (dark to light progression)
      crystalDark: colors.panel,
      crystalMid: colors.card,
      crystalLight: colors.brand,
      crystalHighlight: colors.brandLight,

      // Trend line colors
      trendStroke: colors.gain,
      trendGlow: colors.gain,

      // Wordmark colors
      wordmarkStart: colors.brand,
      wordmarkEnd: colors.brandLight,
      wordmarkSolid: colors.textPrimary,

      // Sparkle accents (always white for contrast)
      sparkle: '#FFFFFF',
      sparkleOpacity: isDarkMode ? 0.7 : 0.8,
    };
  }, [currentTheme, isDarkMode]);
}
