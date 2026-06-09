/**
 * @fileoverview
 * This file contains the implementation of the XYZ feature.
 *
 * @author Your Name
 * @copyright (c) Year Author
 * @license MIT
 */

//using for importing env
import 'dotenv/config';
import { hydrateConfig } from './utils/hydrate-config';

async function bootstrap(): Promise<void> {
  await hydrateConfig();

  const express = (await import('express')).default;
  const cors = (await import('cors')).default;
  const helmet = (await import('helmet')).default;
  const routes = (await import('./routes/index')).default;

  const PORT = process.env.PORT;
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use('/', routes);

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start upload-api:', err);
  process.exit(1);
});
