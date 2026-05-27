// file deepcode ignore UseCsurfForExpress: We've app_token for all the API calls, so we don't need CSRF token.
import { config } from './config/index.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/projects.routes.js';
import orgRoutes from './routes/org.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import loggerMiddleware from './middlewares/logger.middleware.js';
import connectToDatabase from './database.js';
import { authenticateUser } from './middlewares/auth.middleware.js';
import { requestHeadersMiddleware } from './middlewares/req-headers.middleware.js';
import { unmatchedRoutesMiddleware } from './middlewares/unmatched-routes.middleware.js';
import logger from './utils/logger.js';
import contentMapperRoutes from './routes/contentMapper.routes.js';
import migrationRoutes from './routes/migration.routes.js';
import chokidar from 'chokidar';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { getSafePath } from './utils/sanitize-path.utils.js';
// Tail log file for Socket.IO. awaitWriteFinish must be OFF: the CLI appends frequently via
// appendFileSync; each write resets awaitWriteFinish’s stability timer so "change" fired only
// after long quiet periods — logs appeared very late. Polling interval trades CPU vs latency.
const watcher = chokidar.watch(config.LOG_FILE_PATH, {
  usePolling: true,
  interval: 15,
  awaitWriteFinish: false,
  persistent: true,
});

let io: Server; // Socket.IO server instance

/** Byte offset for tailing the active log file; must reset when switching files. */
let logTailByteOffset = 0;

// Dynamically change the log file path and update the watcher
export async function setLogFilePath(newPath: string) {
  try {
    // Ensure the new log file path is absolute and valid
    const absolutePath = getSafePath(path.resolve(newPath));
    const previousResolved = config.LOG_FILE_PATH
      ? path.resolve(config.LOG_FILE_PATH)
      : '';
    if (previousResolved && previousResolved !== absolutePath) {
      logTailByteOffset = 0;
    }
    // Check if the new log file exists
    // Stop watching the old log file
    if (config.LOG_FILE_PATH) {
      watcher.unwatch(config.LOG_FILE_PATH);
    }
    // Update the config to use the new log file path
    config.LOG_FILE_PATH = absolutePath;

    // Start watching the new log file
    watcher.add(absolutePath);
  } catch (error: any) {
    console.error(`Failed to set new log file path: ${error.message}`);
    // Optional: fallback to default or previous log file if the new path is invalid
    if (config.LOG_FILE_PATH) {
      watcher.add(config.LOG_FILE_PATH); // Re-watch previous log file
    }
  }
}

try {
  const app = express();

  // Set security-related HTTP headers
  app.use(
    helmet({
      crossOriginOpenerPolicy: false, // Disable to allow cross-origin resource sharing
    })
  );

  // Enable CORS for all origins
  app.use(cors({ origin: '*' }));

  // Parsing request bodies
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));

  // Custom middleware for logging and request headers
  app.use(loggerMiddleware);
  app.use(requestHeadersMiddleware);

  // Define routes
  app.use('/v2/auth', authRoutes);
  app.use('/v2/user', authenticateUser, userRoutes);
  app.use('/v2/org/:orgId', authenticateUser, orgRoutes);
  app.use('/v2/org/:orgId/project', authenticateUser, projectRoutes);
  app.use('/v2/mapper', authenticateUser, contentMapperRoutes);
  app.use('/v2/migration', authenticateUser, migrationRoutes);

  // Handle unmatched routes
  app.use(unmatchedRoutesMiddleware);

  // Handle errors
  app.use(errorMiddleware);

  // Start the server and establish DB connection
  (async () => {
    await connectToDatabase(); // Establish DB connection

    const server = app.listen(config.PORT, () =>
      logger.info(`Server listening at port ${config.PORT}`)
    );

    // Initialize Socket.IO for real-time log updates
    io = new Server(server, {
      cors: {
        origin: '*', // Allow all origins; adjust for production
        methods: ['GET', 'POST'],
        allowedHeaders: ['my-custom-header'],
        credentials: true,
      },
    });
    const CHUNK_SIZE = 1024 * 1024; // Limit batch size to 1MB

    // Emit initial log file content to connected clients
    //  File watcher for log file changes
    watcher.on('change', async (path) => {
      try {
        const fileStats = await fs.promises.stat(path);

        // Read the entire file if there is an update (new logs or changes)
        const stream = fs.createReadStream(path, { start: logTailByteOffset });
        let fileData = '';

        stream.on('data', (chunk) => {
          fileData += chunk.toString(); // Collect the file data as a string
        });

        stream.on('end', () => {
          // Emit the file content in chunks
          let index = 0;
          while (index < fileData?.length) {
            const chunk = fileData?.slice(index, index + CHUNK_SIZE); // Get the next chunk

            io.emit('logUpdate', chunk);
            index += CHUNK_SIZE; // Move to the next chunk
          }

          // Update the file offset for the next read
          logTailByteOffset = fileStats.size;
        });

        stream.on('error', (err) => {
          console.error('Error reading log file:', err);
        });
      } catch (error) {
        logger.error(`Error emitting log data: ${error}`);
      }
    });
  })();
} catch (e) {
  logger.error('Error while starting the server!');
  logger.error(e);
}
