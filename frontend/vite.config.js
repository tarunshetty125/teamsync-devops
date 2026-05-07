import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration
 * 
 * - React plugin for JSX/Fast Refresh
 * - Proxy API requests to backend during development
 * - Configure build output for production
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Proxy API requests to backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:5006',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
