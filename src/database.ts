// database.ts
import mongoose from "mongoose";
import { config } from "./config";
import logger from "./utils/logger";
import ProjectModel from "./models/project";
import AuthenticationModel from "./models/authentication";
import AuditLogModel from "./models/auditLog";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      ...(config.APP_ENV === "production" ? { autoIndex: false } : {}),
    });

    logger.info("Connected to MongoDB");

    // Create the collection's if it doesn't exist
    await ProjectModel.init();
    await AuthenticationModel.init();
    await AuditLogModel.init();
  } catch (error) {
    logger.error("Error while connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
