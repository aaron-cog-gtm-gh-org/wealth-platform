import { defineConfig } from '@playwright/test';

// Custody area browser tests (specs/001-custody-portfolio-viewer, T026). They drive the real UI against the
// real API and PostgreSQL; nothing is stubbed. State is reset before each test through the loopback-only
// POST /api/test/reset, so the API must run with ENABLE_TEST_RESET=1 (started here if not already up).
const apiUrl = process.env.CUSTODY_API_URL ?? 'http://127.0.0.1:3001';
const viewport = { width: 1280, height: 900 };

export default defineConfig({
  testDir: 'e2e/custody',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/custody',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/custody', open: 'never' }]],
  use: {
    baseURL: process.env.CUSTODY_BASE_URL ?? 'http://127.0.0.1:5173',
    viewport,
    video: process.env.CUSTODY_E2E_VIDEO === 'on' ? { mode: 'on', size: viewport } : 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'ENABLE_TEST_RESET=1 npm run dev:full',
    url: `${apiUrl}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
