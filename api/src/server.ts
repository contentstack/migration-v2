// file deepcode ignore UseCsurfForExpress: We've app_token for all the API calls, so we don't need CSRF token.
import { config } from "./config/index.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import projectRoutes from "./routes/projects.routes.js";
import orgRoutes from "./routes/org.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import loggerMiddleware from "./middlewares/logger.middleware.js";
import connectToDatabase from "./database.js";
import { authenticateUser } from "./middlewares/auth.middleware.js";
import { requestHeadersMiddleware } from "./middlewares/req-headers.middleware.js";
import { unmatchedRoutesMiddleware } from "./middlewares/unmatched-routes.middleware.js";
import logger from "./utils/logger.js";
import contentMapperRoutes from "./routes/contentMapper.routes.js";
import migrationRoutes from "./routes/migration.routes.js";
import chokidar from "chokidar";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";

// Initialize file watcher for the log file
const watcher = chokidar.watch(config.LOG_FILE_PATH, {
  usePolling: true,     // Enables polling to detect changes in all environments
  interval: 1,        // Poll every 100ms (you can adjust this if needed)
  awaitWriteFinish: {   // Wait for file to finish being written before triggering
    stabilityThreshold: 1,  // Time to wait before considering the file stable
    pollInterval: 1,        // Interval at which to poll for file stability
  },
  persistent: true,     // Keeps watching the file even after initial change
}); // Initialize with initial log path

let io: Server; // Socket.IO server instance

// Dynamically change the log file path and update the watcher
export async function setLogFilePath(newPath: string) {
  try {
    // Ensure the new log file path is absolute and valid
    const absolutePath = path.resolve(newPath);
    console.info(`Attempting to set new log file path: ${absolutePath}`);
    // Check if the new log file exists
    // Stop watching the old log file
    if (config.LOG_FILE_PATH) {
      console.info(`Stopping watcher for previous log file: ${config.LOG_FILE_PATH}`);
      watcher.unwatch(config.LOG_FILE_PATH);
    }
    // Update the config to use the new log file path
    config.LOG_FILE_PATH = absolutePath;

    // Start watching the new log file
    console.info(`Starting watcher for new log file: ${absolutePath}`);
    watcher.add(absolutePath);

  } catch (error: any) {
    console.error(`Failed to set new log file path: ${error.message}`);
    // Optional: fallback to default or previous log file if the new path is invalid
    if (config.LOG_FILE_PATH) {
      console.info(`Reverting to previous log file path: ${config.LOG_FILE_PATH}`);
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
  app.use(cors({ origin: "*" }));

  // Parsing request bodies
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));

  // Custom middleware for logging and request headers
  app.use(loggerMiddleware);
  app.use(requestHeadersMiddleware);

  // Define routes
  app.use("/v2/auth", authRoutes);
  app.use("/v2/user", authenticateUser, userRoutes);
  app.use("/v2/org/:orgId", authenticateUser, orgRoutes);
  app.use("/v2/org/:orgId/project", authenticateUser, projectRoutes);
  app.use("/v2/mapper", authenticateUser, contentMapperRoutes);
  app.use("/v2/migration", authenticateUser, migrationRoutes);

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
        origin: "*", // Allow all origins; adjust for production
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true,
      },
    });

    // Emit initial log file content to connected clients
    //  File watcher for log file changes
    watcher.on("change", async (path) => {
      console.info(`File changed: ${path}`);
      // Read the updated file content
      try {
        const data = await fs.promises.readFile(path, "utf8")
        // Emit the updated log content to connected clients
        io.emit("logUpdate", data);
      } catch (error) {
        logger.error(`Error emitting log data: ${error}`);
      }
    });
  })();

} catch (e) {
  logger.error("Error while starting the server!");
  logger.error(e);
}

