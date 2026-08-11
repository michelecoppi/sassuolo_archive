import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The budget checker uses this graph to distinguish initial code from
    // route-level dynamic imports without relying on hashed filenames.
    manifest: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
});
