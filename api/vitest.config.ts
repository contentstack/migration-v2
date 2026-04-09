import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        'src/server.ts',                       // Application entry point
        'src/database.ts',                     // Database setup
        'src/config/**',                       // Configuration files
        'src/validators/**',                   // Schema definitions - pure configuration
        'src/services/wordpress.service.ts',  // External CMS integrations
        'src/services/aem.service.ts',
        'src/services/contentful.service.ts',
        'src/services/sitecore.service.ts',
        'src/services/drupal.service.ts',
        'src/services/drupal/**',
        'src/services/contentful/**',
        'src/services/runCli.service.ts',     // CLI wrapper
        'src/utils/logger.ts',                // Logger configuration
        'src/utils/lowdb-lodash.utils.ts',    // Database utility wrapper
        'src/utils/content-type-creator.utils.ts',  // Complex utility with low testing value
        'src/utils/entries-field-creator.utils.ts', // Complex utility with low testing value
        'src/utils/test-folder-creator.utils.ts',   // Test utility
        'src/utils/optimized-query-builder.utils.ts', // Complex query builder
        'src/utils/custom-logger.utils.ts',         // Logger utility
        'src/utils/wordpressParseUtil.ts',          // WordPress-specific parser
        'src/utils/watch.utils.ts',                 // File watcher utility
        'src/models/types.ts',                // Type definitions only
      ],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 52,
        statements: 70,
      },
    },
  },
});
