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
import http from "http";
import fs from "fs";
try {
  const app = express();
  app.use(
    helmet({
      crossOriginOpenerPolicy: false,
    })
  );

  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));
  app.use(loggerMiddleware);
  app.use(requestHeadersMiddleware);

  // Routes
  app.use("/v2/auth", authRoutes);
  app.use("/v2/user", authenticateUser, userRoutes);
  app.use("/v2/org/:orgId", authenticateUser, orgRoutes);
  app.use("/v2/org/:orgId/project", authenticateUser, projectRoutes);
  app.use("/v2/mapper", authenticateUser, contentMapperRoutes);
  app.use("/v2/migration", authenticateUser, migrationRoutes);

  //For unmatched route patterns
  app.use(unmatchedRoutesMiddleware);

  // Error Middleware
  app.use(errorMiddleware);

  // starting the server & DB connection.
  (async () => {
    await connectToDatabase();
    const server = app.listen(config.PORT, () =>
      logger.info(`Server listening at port ${config.PORT}`)
    );
    // Chokidar - Watch for log file changes
    ///Users/rohit/migration-v2-node-server/api/combine.log
    const logFilePath = "/Users/rohit/migration-v2-node-server/api/combine.log"; // Replace with the actual path to your log file
    const watcher = chokidar.watch(logFilePath);
    // Socket.IO - Send logs to client
    const io = new Server(
      server,
      (http,
      {
        cors: {
          origin: "*", // This allows all origins. For production, specify exact origins for security.
          methods: ["GET", "POST"], // Specify which HTTP methods are allowed.
          allowedHeaders: ["my-custom-header"], // Specify which headers are allowed.
          credentials: true, // If your client needs to send cookies or credentials with the requests.
        },
      })
    );

    watcher.on("change", (path) => {
      // Read the updated log file
      fs.readFile(path, "utf8", (err, data) => {
        if (err) {
          logger.error(`Error reading log file: ${err}`);
          return;
        }
        // Get just the updated data
        // const updatedData = data.slice(data.lastIndexOf("\n") + 1);
        console.info("updates", data);
        // Emit the updated data to all connected clients
        try {
          const parsedData = data;
          io.emit("logUpdate", parsedData);
        } catch (error) {
          logger.error(`Error parsing data: ${error}`);
        }
      });
    });
  })();
} catch (e) {
  logger.error("Error while starting the server!");
  logger.error(e);
}
