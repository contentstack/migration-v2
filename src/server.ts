// file deepcode ignore UseCsurfForExpress: We've app_token for all the API calls, so we don't need CSRF token.
import { config } from "./config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import loggerMiddleware from "./middlewares/logger.middleware";
import connectToDatabase from "./database";
import { authenticateUser } from "./middlewares/auth.middleware";
import { requestHeadersMiddleware } from "./middlewares/req-headers.middleware";
import { unmatchedRoutesMiddleware } from "./middlewares/unmatched-routes.middleware";

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
  app.use("/v2/org/:orgId/project", authenticateUser, projectRoutes);

  //For unmatched route patterns
  app.use(unmatchedRoutesMiddleware);

  // Connect to DB
  connectToDatabase();

  // Error Middleware
  app.use(errorMiddleware);

  app.listen(config.PORT, () => {
    console.info(`Server listening at port ${config.PORT}`);
  });
} catch (e) {
  console.error("Error while starting the server!");
  console.error(e);
}
