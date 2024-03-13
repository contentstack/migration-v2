// database.ts
import mongoose from "mongoose";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import ProjectModel from "./models/project.js";
import AuthenticationModel from "./models/authentication.js";
import ContentTypesMapperModel from "./models/contentTypesMapper.js";
import FieldMapperModel from "./models/FieldMapper.js";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      ...(config.APP_ENV === "production" ? { autoIndex: false } : {}),
    });

    logger.info("Connected to MongoDB");

    // Create the collection's if it doesn't exist
    await ProjectModel.init();
    await AuthenticationModel.init();
    await ContentTypesMapperModel.init();
    await FieldMapperModel.init();
  } catch (error) {
    logger.error("Error while connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
