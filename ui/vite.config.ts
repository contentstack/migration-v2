import { createLogger } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes('@import must precede')) return;
  originalWarn(msg, options);
};

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  customLogger: logger,
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'build'
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import']
      }
    }
  }
});
