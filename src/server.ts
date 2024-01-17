import { config } from "./config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import loggerMiddleware from "./middlewares/logger.middleware";
import logger from "./utils/logger";
import connectToDatabase from "./database";
import { authenticateUser } from "./middlewares/auth.middleware";
import { constants } from "./constants";

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

  // Routes
  app.use("/v2/auth", authRoutes);
  app.use("/v2/org/:orgId/project", authenticateUser, projectRoutes);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "OPTIONS, GET, POST, PUT, PATCH, DELETE"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  });

  //For unmatched route patterns
  app.use((req: Request, res: Response) => {
    const status = constants.HTTP_CODES.NOT_FOUND;
    res.status(status).json({
      error: { code: status, message: constants.HTTP_TEXTS.ROUTE_ERROR },
    });
  });

  // Connect to DB
  connectToDatabase();

  // Error Middleware
  app.use(errorMiddleware);

  app.listen(config.PORT, () => {
    console.info(`Server listening at port ${config.PORT}`);
  });
  logger.info("Connected node");
} catch (e) {
  console.error("Error while starting the server!");
  console.error(e);
}
