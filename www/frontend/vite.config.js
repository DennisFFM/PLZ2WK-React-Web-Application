import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './', // wichtig: relativ zum frontend-Verzeichnis
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // falls du z. B. `@/components/...` nutzt
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    }
  }
});
