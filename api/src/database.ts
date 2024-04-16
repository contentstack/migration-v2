// database.ts
import mongoose from "mongoose";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import ProjectModel from "./models/project.js";
import ContentTypesMapperModel from "./models/contentTypesMapper.js";
import fs from "fs";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      ...(config.APP_ENV === "production" ? { autoIndex: false } : {}),
    });

    //check if the database folder exists
    if (!fs.existsSync("./database")) {
      fs.mkdirSync("./database");
    }

    // Create the collection's if it doesn't exist
    await ProjectModel.init();
    await ContentTypesMapperModel.init();
  } catch (error) {
    logger.error("Error while connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;