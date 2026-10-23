import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve @gestion/shared a su código fuente TS (sin necesidad de compilarlo antes)
  ssr: {
    resolve: {
      conditions: ['@gestion/source', ...defaultServerConditions],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
