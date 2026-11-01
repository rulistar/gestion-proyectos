import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta (TEC-06). `pnpm test:e2e` compila la web y Playwright arranca el
 * servidor de pruebas (apps/api/src/test/e2e-server.ts) con su propia BD, vacía en cada corrida.
 */
const PORT = 3100; // no choca con `pnpm dev` (3000 y 5173)
process.env.E2E_PORT = String(PORT);
// Cuenta del Admin de la BD de pruebas. La contraseña se genera en cada corrida: no hay secretos
// en el código. Los procesos de las pruebas heredan estas variables, así que usan las mismas.
process.env.E2E_ADMIN_EMAIL ??= 'admin@e2e.example.com';
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(18).toString('base64url');

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests',
  // Una sola BD compartida: las pruebas van en serie
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'navegador',
      use: {
        ...devices['Desktop Chrome'],
        // En la PC del PO, el Edge instalado: Smart App Control bloquea navegadores descargados.
        // En el CI, el Chromium de Playwright (`playwright install chromium`)
        ...(!ci && { channel: 'msedge' }),
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @gestion/api e2e:serve',
    url: `http://127.0.0.1:${PORT}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
