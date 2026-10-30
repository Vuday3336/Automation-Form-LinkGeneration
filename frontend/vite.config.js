import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // During development, the browser calls "/api/..." on the Vite server (port 5173),
    // and Vite forwards it to the Express backend (port 5000). To the browser everything
    // looks like one site, which keeps auth cookies simple and avoids CORS surprises.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
