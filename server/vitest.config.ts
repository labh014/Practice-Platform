import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests must never reach the network. The MockLlmClient is always used.
    // See PRD 7.5.
    restoreMocks: true,
  },
});
