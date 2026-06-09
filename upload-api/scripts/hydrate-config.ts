/**
 * CLI entrypoint: hydrate src/config/index.json from process.env.
 * Used by Docker entrypoint and `npm run hydrate-config`.
 */
import 'dotenv/config';
import { hydrateConfig } from '../src/utils/hydrate-config';

hydrateConfig()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('hydrate-config failed:', err);
    process.exit(1);
  });
