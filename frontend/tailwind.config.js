/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors via CSS custom properties
        // These are set at runtime by the theme system

        // Page background
        'page-bg': 'var(--color-page-bg)',

        // Card/panel surfaces
        'card': 'var(--color-card)',
        'card-hover': 'var(--color-card-hover)',

        // Text colors
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',

        // Brand/Primary
        'brand': 'var(--color-brand)',
        'brand-hover': 'var(--color-brand-hover)',
        'brand-light': 'var(--color-brand-light)',
        'brand-tint': 'var(--color-brand-tint)',

        // Accent
        'mint': 'var(--color-accent)',
        'mint-light': 'var(--color-accent-light)',

        // Muted/Table backgrounds
        'table-header': 'var(--color-table-header)',

        // Borders
        'line': 'var(--color-line)',
        'line-light': 'var(--color-line-light)',

        // Semantic colors for stock indicators
        'gain': 'var(--color-gain)',
        'loss': 'var(--color-loss)',

        // Dark mode colors (static - these don't change with themes)
        // NOTE: We are moving towards theme-based dark mode using the variables above.
        // These are kept for backward compatibility but should be replaced by theme variables.
        'dark-bg': 'var(--color-page-bg)', // Was #262625
        'dark-primary': 'var(--color-brand)', // Was #BF573F
        'dark-text': 'var(--color-text-primary)', // Was #BFBDB8
        'dark-positive': '#4ADE80',
        'dark-negative': '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
