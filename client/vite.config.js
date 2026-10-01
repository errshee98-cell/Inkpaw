import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy keeps the API same-origin in dev, so the SameSite=strict session cookie just works.
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
