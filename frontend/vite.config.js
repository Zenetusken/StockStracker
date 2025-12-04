import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // L3: Disable source maps in production builds to prevent source code exposure
  build: {
    // eslint-disable-next-line no-undef
    sourcemap: process.env.NODE_ENV !== 'production'
  }
})
