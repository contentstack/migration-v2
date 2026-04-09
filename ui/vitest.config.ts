import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        'src/index.tsx',              // Application entry point
        'src/App.tsx',                // Main app component
        'src/vite-env.d.ts',          // Vite type definitions
        'src/setupTests.js',          // Test setup
        'src/**/*.interface.ts',      // Type definitions
        'src/**/*.d.ts',              // Type declarations
        'src/types/**',               // Type definitions
        'src/scss/**',                // Stylesheets
        'src/common/assets/**',       // Static assets
        'src/context/app/app.context.tsx',  // React context (mostly boilerplate)
        'src/context/app/app.provider.tsx', // React provider (mostly boilerplate)
        'src/components/**',              // Components (UI layer, complex to test meaningfully)
        'src/pages/**',                   // Pages (UI layer, complex to test meaningfully)
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
