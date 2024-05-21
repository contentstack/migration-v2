// database.ts
import logger from "./utils/logger.js";
import fs from "fs";

const connectToDatabase = async () => {
  try {
    if (!fs.existsSync("./database")) {
      fs.mkdirSync("./database");
    }
    logger.info("successfully connecting to Low DB");
  } catch (error) {
    logger.error("Error while connecting to Low DB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
