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
        // Light mode colors
        'light-bg': '#E8E8E8',
        'light-primary': '#B1C2F0',
        'light-secondary': '#B9D7EB',
        'light-accent': '#EBBDFF',
        'light-positive': '#2E9E6B',
        'light-negative': '#C45C4A',
        // Dark mode colors
        'dark-bg': '#262625',
        'dark-primary': '#BF573F',
        'dark-text': '#BFBDB8',
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
