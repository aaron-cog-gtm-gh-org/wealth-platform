import { defineConfig } from '@playwright/test';
import path from 'node:path';

const segmentDir = path.resolve(process.env.QA_SEGMENT_DIR ?? 'qa-artifacts/_adhoc');
const videoSize = { width: 1280, height: 900 };

export default defineConfig({
  testDir: 'qa/tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: Number(process.env.QA_RETRIES ?? 0),
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: path.join(segmentDir, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(segmentDir, 'results.json') }],
    ['html', { outputFolder: path.join(segmentDir, 'html'), open: 'never' }]
  ],
  use: {
    baseURL: process.env.QA_BASE_URL ?? 'http://localhost:5173',
    viewport: videoSize,
    video: { mode: 'on', size: videoSize },
    screenshot: 'on',
    trace: 'on',
    launchOptions: {
      slowMo: Number(process.env.QA_SLOW_MO ?? 0),
      ...(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : {})
    }
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
