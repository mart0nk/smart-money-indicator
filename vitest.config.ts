import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'smart-money-indicator': resolve('./core/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
