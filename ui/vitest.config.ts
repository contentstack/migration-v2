import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
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
        'src/index.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
        'src/setupTests.js',
        'src/**/*.interface.ts',
        'src/**/*.d.ts',
        'src/types/**',
        'src/scss/**',
        'src/common/assets/**',
        'src/pages/**',
        'src/components/**',
        'src/context/app/app.context.tsx',
        'src/context/app/app.provider.tsx',
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
