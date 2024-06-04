import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { HTTP_TEXTS, HTTP_CODES } from '../constants';
import logger from "../utils/logger";

const getFileName = (params: { Key: string }) => {
  const obj: { fileName?: string; fileExt?: string } = {};
  //fine Name
  obj.fileName = params?.Key?.split?.('/')?.pop?.();
  //file ext from fileName
  obj.fileExt = obj?.fileName?.split?.('.')?.pop?.();
  return obj;
};

const saveZip = async (zip: any) => {
  try {
    const keys = Object?.keys(zip.files);
    for await (const filename of keys) {
      const file = zip?.files?.[filename];
      if (!file?.dir) { // Ignore directories
        const filePath = path.join(__dirname, '../../extracted_files', filename);
        // Ignore __MACOSX folder asynchronously
        if (!(filePath.includes("__MACOSX"))) {
          // Ensure the directory exists asynchronously
          await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
          // Write the file asynchronously
          const content = await file.async('nodebuffer');
          await fs.promises.writeFile(filePath, content);
        }
      }
    }
    return true;
  } catch (err: any) {
    console.error(err);
    logger.info('Zipfile error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.ZIP_FILE_SAVE,
    });
    return false;
  }
};

const fileOperationLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 2, // Limit each IP to 2 requests per windowMs for this endpoint
  message: {
    status: "rate limit",
    message: "Rate limit exceeded. Only 2 calls allowed every 2 minutes.",
  }
});


function deleteFolderSync(folderPath: string): void {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file: string) => {
      const currentPath: string = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // Recurse
        deleteFolderSync(currentPath);
      } else {
        // Delete file
        fs.unlinkSync(currentPath);
      }
    });
    // Delete now-empty folder
    fs.rmdirSync(folderPath);
  }
}


export { getFileName, saveZip, fileOperationLimiter, deleteFolderSync };
