import { parseCLIArgsFromProcess, loadConfigFile } from "./utils";
import { constants } from "./constants";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
const PORT = process.env.PORT ?? 5000;
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";

try {
  loadConfigFile(parseCLIArgsFromProcess(process.argv));
  dotenv.config();

  const app = express();
  app.use(
    helmet({
      crossOriginOpenerPolicy: false,
    })
  );

  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));

  // Routes
  app.use("/api.contentstack-migration/v2/auth", authRoutes);
  app.use("/api.contentstack-migration/v2/org", projectRoutes);

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

  app.use((error: Error, req: Request, res: Response) => {
    console.error(error);
    res
      .status(
        (error as unknown as { statusCode: number }).statusCode ||
          constants.HTTP_ERROR_CODES.SOMETHING_WRONG
      )
      .json({
        message: error.message || constants.HTTP_ERROR_TEXTS.INTERNAL_ERROR,
      });
  });

  app.listen(PORT, () => {
    console.info(`Server listening at port ${PORT}`);
  });
} catch (e) {
  console.error("Error while starting the server!");
  console.error(e);
}
