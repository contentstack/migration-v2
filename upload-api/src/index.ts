/**
 * @fileoverview
 * This file contains the implementation of the XYZ feature.
 *
 * @author Your Name
 * @copyright (c) Year Author
 * @license MIT
 */

import express from 'express';
//using for importing env
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index';

const PORT = process.env.PORT;
const app = express();

app.use(cors());

// Use the helmet middleware to enhance security
app.use(helmet());

// for the routes creation create in routes/index.ts
app.use('/', routes);

app.listen(PORT, () => {
  console.info(`Server is running at http://localhost:${PORT}`);
});
