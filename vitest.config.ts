import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@trader-agent/smart-money-indicator-core': resolve('./core/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
