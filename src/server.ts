import { config } from "./config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import loggerMiddleware from "./middlewares/logger.middleware";
import mongoose from "mongoose";
import logger from "./utils/logger";
import MigrationModel from "./models/migration";
import AuthenticationModel from "./models/authenticationLog";
import AuditLogModel from "./models/auditLog";
import connectToDatabase from "./database";

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
  app.use("/v2/org", projectRoutes);

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

  app.use("/", (req, res) => {
    res.status(200).json("Welcome to Migration APIs");
  });

  // Connect to DB
  connectToDatabase();

  // Error Middleware
  app.use(errorMiddleware);

  app.listen(7000, () => {
    console.info(`Server listening at port ${7000}`);
  });
  logger.info("Connected node");
} catch (e) {
  console.error("Error while starting the server!");
  console.error(e);
}
