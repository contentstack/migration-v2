// esbuild.config.js
const esbuild = require('esbuild');
const glob = require('glob');

esbuild
  .build({
    entryPoints: [
      './packages/contentstack/bin/run',
      './packages/contentstack-audit/src/index.ts',
      ...glob.sync('./packages/contentstack/commands/**/*.ts'),
    ], // Adjust paths if needed
    bundle: true,
    platform: 'node',
    outdir: 'dist',
    minify: true,
    sourcemap: true,
    external: ['@oclif/core'], // Exclude node_modules from the bundle
    loader: {
      '.ts': 'ts', // Load TypeScript files
    },
  })
  .catch(() => process.exit(1));
