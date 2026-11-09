import { defineConfig } from 'vitest/config';

// Domain suite (npm run test:domain). Existing node --test suites are not run by Vitest.
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    environment: 'node',
  },
});
