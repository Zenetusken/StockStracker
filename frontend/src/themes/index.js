/**
 * Theme Configuration
 *
 * Each theme defines colors for the light mode palette.
 * Dark mode colors are handled separately via Tailwind's dark: prefix.
 *
 * Color tokens:
 * - pageBg: Main page background
 * - card: Card/surface background
 * - cardHover: Card hover state
 * - textPrimary: Main text color
 * - textSecondary: Secondary text
 * - textMuted: Muted/subtle text
 * - brand: Primary brand color (buttons, links)
 * - brandHover: Brand hover state
 * - brandLight: Lighter brand variant
 * - accent: Accent highlight color
 * - accentLight: Light accent variant
 * - tableHeader: Table header background
 * - line: Border color
 * - lineLight: Light border
 * - input: Input field background (should contrast with card)
 * - gain: Positive stock change
 * - loss: Negative stock change
 */

export const themes = {
  jadeRequiem: {
    id: 'jadeRequiem',
    name: 'Jade Requiem',
    description: 'A funeral hymn sung in emerald and shadow',
    // Preview: crimson, jade sidebar, mint bg
    preview: ['#8C162C', '#98C8A8', '#E5F2E8'],
    colors: {
      // Light mode - jade green gradient (BG lightest → Panel → Cards darkest)
      pageBg: '#E5F2E8',      // Lightest - very light mint
      panel: '#98C8A8',       // Second lightest - sage green
      panelHover: '#88B898',
      card: '#68A080',        // Darkest - deep jade green
      cardHover: '#589070',
      textPrimary: '#0D1F15',
      textSecondary: '#1A3628',
      textMuted: '#2D5040',
      brand: '#356850',
      brandHover: '#284838',
      brandLight: '#5A9E75',
      brandTint: '#E5F2E8',
      accent: '#8C162C',
      accentLight: '#F5D5DA',  // Light rose for selections
      tableHeader: '#98C8A8',
      line: '#78A890',        // Border between panel and cards
      lineLight: '#B8D8C0',   // Subtle border on lighter elements
      input: '#B8D8C0',       // Light mint for input fields (contrasts with card)
      gain: '#2E7D32',
      loss: '#8C162C',
    },
    colorsDark: {
      // Dark mode - midnight blue-green tones, sidebar darker but lightest element
      pageBg: '#0A1215',
      panel: '#2A4548',
      panelHover: '#355558',
      card: '#152028',
      cardHover: '#1E2D38',
      textPrimary: '#E8F2F2',
      textSecondary: '#A0C5C5',
      textMuted: '#608080',
      brand: '#58B8B0',
      brandHover: '#70D0C8',
      brandLight: '#2A4548',
      brandTint: '#152028',
      accent: '#8C162C',
      accentLight: '#3D1520',  // Dark rose for selections
      tableHeader: '#152028',
      line: '#3A5858',        // Lighter border for visibility
      lineLight: '#2A4548',   // Subtle border
      input: '#1E2D38',       // Slightly lighter than card for input fields
      gain: '#4CAF50',
      loss: '#8C162C',
    },
  },

  charredSienna: {
    id: 'charredSienna',
    name: 'Charred Sienna',
    description: 'Burned wood meeting raw earth',
    // Preview dots show the original gradient: charcoal → sienna → taupe
    preview: ['#353535', '#816E5C', '#887E74'],
    colors: {
      // Light mode - warm cream with ashy/charred undertones, high contrast
      pageBg: '#EAE3DB',
      panel: '#DDD4C8',
      panelHover: '#D0C5B6',
      card: '#C9BBAA',
      cardHover: '#BBA999',
      textPrimary: '#181412',
      textSecondary: '#3A332C',
      textMuted: '#5C544A',
      brand: '#6B4D3A',
      brandHover: '#4E3828',
      brandLight: '#8B6B55',
      brandTint: '#F5EDE5',
      accent: '#816E5C',
      accentLight: '#DDD4C8',
      tableHeader: '#DDD4C8',
      line: '#C9BBAA',
      lineLight: '#DDD4C8',
      input: '#EAE3DB',       // Page background color for better contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      // Dark mode - the charred gradient: #353535 → #816E5C → #887E74
      pageBg: '#1A1816',
      panel: '#353535',
      panelHover: '#454240',
      card: '#2A2725',
      cardHover: '#353535',
      textPrimary: '#F5F0EB',
      textSecondary: '#D4C7B8',
      textMuted: '#887E74',
      brand: '#C4A882',
      brandHover: '#E8D5B5',
      brandLight: '#816E5C',
      brandTint: '#2A2520',
      accent: '#816E5C',
      accentLight: '#353535',
      tableHeader: '#353535',
      line: '#454240',
      lineLight: '#353535',
      input: '#353535',       // Panel color for input contrast
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  forestDawn: {
    id: 'forestDawn',
    name: 'Forest Dawn',
    description: 'Natural greens with warm earth tones',
    colors: {
      pageBg: '#C8E6C9',
      panel: '#A5D6A7',
      panelHover: '#81C784',
      card: '#66BB6A',
      cardHover: '#57A05B',
      textPrimary: '#022C22',
      textSecondary: '#064E3B',
      textMuted: '#065F46',
      brand: '#064E3B',
      brandHover: '#022C22',
      brandLight: '#1B5E20',
      brandTint: '#E8F5E9',
      accent: '#1B5E20',
      accentLight: '#81C784',
      tableHeader: '#81C784',
      line: '#43A047',
      lineLight: '#81C784',
      input: '#C8E6C9',       // Light green for input contrast
      gain: '#022C22',
      loss: '#7F1D1D',
    },
    colorsDark: {
      pageBg: '#0E1719',
      panel: '#3B4A38',
      panelHover: '#4A5C47',
      card: '#1C2D2A',
      cardHover: '#263C39',
      textPrimary: '#F1F8E9',
      textSecondary: '#C8E6C9',
      textMuted: '#A5D6A7',
      brand: '#C8E6C9',
      brandHover: '#F1F8E9',
      brandLight: '#A5D6A7',
      brandTint: '#1C2D2A',
      accent: '#6B765C',
      accentLight: '#3B4A38',
      tableHeader: '#263C39',
      line: '#263C39',
      lineLight: '#3B4A38',
      input: '#263C39',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  oceanBreeze: {
    id: 'oceanBreeze',
    name: 'Ocean Breeze',
    description: 'Cool blues with crisp white surfaces',
    colors: {
      pageBg: '#E3F2FD',
      panel: '#BBDEFB',
      panelHover: '#90CAF9',
      card: '#90CAF9',
      cardHover: '#64B5F6',
      textPrimary: '#0D47A1',
      textSecondary: '#1565C0',
      textMuted: '#1976D2',
      brand: '#0277BD',
      brandHover: '#01579B',
      brandLight: '#4FC3F7',
      brandTint: '#E1F5FE',
      accent: '#29B6F6',
      accentLight: '#B3E5FC',
      tableHeader: '#BBDEFB',
      line: '#90CAF9',
      lineLight: '#E3F2FD',
      input: '#E3F2FD',       // Lightest blue for input contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      pageBg: '#0B1121',
      panel: '#2D4059',
      panelHover: '#3B5270',
      card: '#1B263B',
      cardHover: '#24324D',
      textPrimary: '#E1F5FE',
      textSecondary: '#B3E5FC',
      textMuted: '#81D4FA',
      brand: '#81D4FA',
      brandHover: '#E1F5FE',
      brandLight: '#4FC3F7',
      brandTint: '#1B263B',
      accent: '#4FC3F7',
      accentLight: '#1B263B',
      tableHeader: '#24324D',
      line: '#24324D',
      lineLight: '#2D4059',
      input: '#24324D',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  midnightPurple: {
    id: 'midnightPurple',
    name: 'Midnight Purple',
    description: 'Deep purples with elegant lavender highlights',
    colors: {
      pageBg: '#F3E0F7',
      panel: '#E1BEE7',
      panelHover: '#D6A6E3',
      card: '#D6A6E3',
      cardHover: '#BA68C8',
      textPrimary: '#2E1A36',
      textSecondary: '#4A148C',
      textMuted: '#5E2C6D',
      brand: '#5E2C6D',
      brandHover: '#3D1C4A',
      brandLight: '#9D5FB3',
      brandTint: '#F3E0F7',
      accent: '#7B3F8F',
      accentLight: '#E1BEE7',
      tableHeader: '#E1BEE7',
      line: '#BA68C8',
      lineLight: '#F3E0F7',
      input: '#F3E0F7',       // Lightest purple for input contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      pageBg: '#120616',
      panel: '#3D1C4A',
      panelHover: '#4A235A',
      card: '#24102B',
      cardHover: '#2E1437',
      textPrimary: '#F3E0F7',
      textSecondary: '#D6A6E3',
      textMuted: '#BF82D1',
      brand: '#D6A6E3',
      brandHover: '#F3E0F7',
      brandLight: '#9D5FB3',
      brandTint: '#2E1437',
      accent: '#9D5FB3',
      accentLight: '#361840',
      tableHeader: '#2E1437',
      line: '#3D1C4A',
      lineLight: '#24102B',
      input: '#2E1437',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  sunsetGlow: {
    id: 'sunsetGlow',
    name: 'Sunset Glow',
    description: 'Warm oranges and coral with cream backgrounds',
    colors: {
      pageBg: '#FFF8E1',
      panel: '#FFECB3',
      panelHover: '#FFE082',
      card: '#FCDC91',
      cardHover: '#FDE6A8',
      textPrimary: '#78350F',
      textSecondary: '#92400E',
      textMuted: '#B45309',
      brand: '#F57C00',
      brandHover: '#E65100',
      brandLight: '#FFB74D',
      brandTint: '#FFF8E1',
      accent: '#FFC107',
      accentLight: '#FFECB3',
      tableHeader: '#FFECB3',
      line: '#FFE0B2',
      lineLight: '#FFF8E1',
      input: '#FFF8E1',       // Lightest cream for input contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      pageBg: '#180802',
      panel: '#402005',
      panelHover: '#542A08',
      card: '#2A1204',
      cardHover: '#3D1A06',
      textPrimary: '#FFF9C4',
      textSecondary: '#FFE0B2',
      textMuted: '#FFCC80',
      brand: '#FFB74D',
      brandHover: '#FFF9C4',
      brandLight: '#FFCC80',
      brandTint: '#2A1204',
      accent: '#FFD54F',
      accentLight: '#FF6F00',
      tableHeader: '#3D1A06',
      line: '#3D1A06',
      lineLight: '#402005',
      input: '#3D1A06',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  roseGarden: {
    id: 'roseGarden',
    name: 'Rose Garden',
    description: 'Soft pinks with romantic rose accents',
    colors: {
      pageBg: '#F7DAE7',
      panel: '#E2B4C1',
      panelHover: '#F7DAE7',
      card: '#D38C9D',
      cardHover: '#E2B4C1',
      textPrimary: '#360D1B',
      textSecondary: '#631932',
      textMuted: '#880E4F',
      brand: '#A55166',
      brandHover: '#880E4F',
      brandLight: '#E2B4C1',
      brandTint: '#F7DAE7',
      accent: '#E2B4C1',
      accentLight: '#F7DAE7',
      tableHeader: '#E2B4C1',
      line: '#E2B4C1',
      lineLight: '#F7DAE7',
      input: '#F7DAE7',       // Lightest pink for input contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      pageBg: '#14050A',
      panel: '#631932',
      panelHover: '#962F56',
      card: '#360D1B',
      cardHover: '#631932',
      textPrimary: '#FFF5F8',
      textSecondary: '#FFCCDE',
      textMuted: '#FF99BB',
      brand: '#FF80AB',
      brandHover: '#FFF5F8',
      brandLight: '#FF4081',
      brandTint: '#360D1B',
      accent: '#962F56',
      accentLight: '#631932',
      tableHeader: '#631932',
      line: '#631932',
      lineLight: '#631932',
      input: '#4A1527',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  slateModern: {
    id: 'slateModern',
    name: 'Slate Modern',
    description: 'Clean grays with a professional feel',
    colors: {
      pageBg: '#ECEFF1',
      panel: '#CFD8DC',
      panelHover: '#B0BEC5',
      card: '#B0BEC5',
      cardHover: '#90A4AE',
      textPrimary: '#263238',
      textSecondary: '#37474F',
      textMuted: '#455A64',
      brand: '#455A64',
      brandHover: '#263238',
      brandLight: '#78909C',
      brandTint: '#ECEFF1',
      accent: '#78909C',
      accentLight: '#CFD8DC',
      tableHeader: '#CFD8DC',
      line: '#B0BEC5',
      lineLight: '#ECEFF1',
      input: '#ECEFF1',       // Lightest gray for input contrast
      gain: '#2E7D32',
      loss: '#C62828',
    },
    colorsDark: {
      pageBg: '#090F15',
      panel: '#37474F',
      panelHover: '#455A64',
      card: '#262E36',
      cardHover: '#6C6D74',
      textPrimary: '#FFFFFF',
      textSecondary: '#E2E8F0',
      textMuted: '#CBD5E1',
      brand: '#83878A',
      brandHover: '#D3D1CE',
      brandLight: '#6C6D74',
      brandTint: '#262E36',
      accent: '#6C6D74',
      accentLight: '#262E36',
      tableHeader: '#6C6D74',
      line: '#6C6D74',
      lineLight: '#262E36',
      input: '#37474F',       // Panel color for better contrast
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },

  espresso: {
    id: 'espresso',
    name: 'Espresso',
    description: 'Rich coffee tones with cream highlights',
    colors: {
      pageBg: '#D7CCC8',
      panel: '#BCAAA4',
      panelHover: '#D7CCC8',
      card: '#A1887F',
      cardHover: '#BCAAA4',
      textPrimary: '#1B0F0A',
      textSecondary: '#2C1810',
      textMuted: '#4E342E',
      brand: '#2C1810',
      brandHover: '#1B0F0A',
      brandLight: '#4E342E',
      brandTint: '#D7CCC8',
      accent: '#4E342E',
      accentLight: '#EFEBE9',
      tableHeader: '#EFEBE9',
      line: '#D7CCC8',
      lineLight: '#EFEBE9',
      input: '#D7CCC8',       // Light cream for input contrast
      gain: '#1B5E20',
      loss: '#B71C1C',
    },
    colorsDark: {
      pageBg: '#25140C',
      panel: '#4E342E',
      panelHover: '#5D4037',
      card: '#492617',
      cardHover: '#5D3320',
      textPrimary: '#EFEBE9',
      textSecondary: '#D7CCC8',
      textMuted: '#A1887F',
      brand: '#D7CCC8',
      brandHover: '#EFEBE9',
      brandLight: '#A1887F',
      brandTint: '#492617',
      accent: '#A1887F',
      accentLight: '#492617',
      tableHeader: '#5D3320',
      line: '#5D3320',
      lineLight: '#492617',
      input: '#5D3320',       // Slightly lighter than card
      gain: '#4CAF50',
      loss: '#EF5350',
    },
  },
};

// Default theme
export const defaultTheme = 'jadeRequiem';

// Get theme by ID
export function getTheme(themeId) {
  // Handle migration from old theme ID
  if (themeId === 'slovakiaVilla') {
    return themes.forestDawn;
  }
  return themes[themeId] || themes[defaultTheme];
}

// Get all themes as array for selection UI
export function getAllThemes() {
  return Object.values(themes);
}

// Apply theme to document (sets CSS custom properties)
export function applyTheme(themeId, isDark = false) {
  // Handle migration
  const actualThemeId = themeId === 'slovakiaVilla' ? 'forestDawn' : themeId;
  const theme = getTheme(actualThemeId);
  const root = document.documentElement;
  
  // Use dark colors if available and isDark is true, otherwise fallback to light colors
  const colors = (isDark && theme.colorsDark) ? theme.colorsDark : theme.colors;

  Object.entries(colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variable names
    const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVarName, value);
  });

  // Store preference (store the new ID if it was the old one)
  localStorage.setItem('stocktracker-theme', actualThemeId);
}

// Get stored theme preference
export function getStoredTheme() {
  const stored = localStorage.getItem('stocktracker-theme');
  if (stored === 'slovakiaVilla') return 'forestDawn';
  return stored || defaultTheme;
}
