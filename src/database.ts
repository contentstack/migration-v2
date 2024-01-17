// database.ts
import mongoose from "mongoose";
import { config } from "./config";
import logger from "./utils/logger";
import MigrationModel from "./models/migration";
import AuthenticationModel from "./models/authenticationLog";
import AuditLogModel from "./models/auditLog";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);

    logger.info("Connected to MongoDB");

    // Create the collection's if it doesn't exist
    await MigrationModel.init();
    await AuthenticationModel.init();
    await AuditLogModel.init();
  } catch (error) {
    logger.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
