import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [react()],
  build: {
    // The budget checker uses this graph to distinguish initial code from
    // route-level dynamic imports without relying on hashed filenames.
    manifest: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:8787'
    }
  }
});
