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
    exclude: [
      '**/node_modules/**',
      'tests/unit/migration-wordpress/schemaMapper.test.ts', // Exclude complex WordPress schema tests
      'tests/unit/controllers/wordpress.controller.test.ts', // Exclude WordPress controller tests
      'tests/unit/services/aws-client.test.ts', // Exclude AWS client test for now
    ],
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
        'migration-*/libs/**',  // Exclude migration-specific libraries
        'migration-*/utils/**', // Exclude migration-specific utilities
      ],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 50,
        statements: 70,
      },
    },
  },
});
