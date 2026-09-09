import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,

    root: path.resolve(__dirname),

    setupFiles: [
      './tests/setup/env.ts'
    ],

    include: [
      'tests/**/*.test.ts'
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/types/**'
      ]
    }
  }
});
