import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Resuelve @gestion/shared a su código fuente TS (Vite lo compila directamente)
    conditions: ['@gestion/source', ...defaultClientConditions],
  },
  server: {
    port: 5173,
    // En desarrollo, /api/* se reenvía a la API: mismo origen, sin problemas de CORS ni cookies
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
