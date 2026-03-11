import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'migration-aem': path.resolve(__dirname, 'tests/__mocks__/migration-aem.ts'),
      'migration-sitecore': path.resolve(__dirname, 'tests/__mocks__/migration-sitecore.ts'),
      'migration-wordpress': path.resolve(__dirname, 'tests/__mocks__/migration-wordpress.ts'),
      'migration-contentful': path.resolve(__dirname, 'tests/__mocks__/migration-contentful.ts'),
      'migration-drupal': path.resolve(__dirname, 'tests/__mocks__/migration-drupal.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        'src/index.ts',
        'src/main.ts',
        'src/config/index.ts',
        'src/utils/logger.ts',
        'src/models/types.ts',
        'src/generate-schema.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 60,
        statements: 80,
      },
    },
  },
});
