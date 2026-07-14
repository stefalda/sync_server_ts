import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    testMatch: ['test/**/*.test.ts'],
    sequence: {
      concurrent: false,
    },
    deps: {
      interopDefaultInCjs: true,
    },
  },
  resolve: {
    alias: {
      '../config.json': path.resolve(__dirname, 'config.test.json'),
      '../../config.json': path.resolve(__dirname, 'config.test.json'),
    },
  },
});
