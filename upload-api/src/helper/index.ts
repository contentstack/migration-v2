import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import xml2js from 'xml2js'
import { HTTP_TEXTS, HTTP_CODES, MIGRATION_DATA_CONFIG } from '../constants';
import logger from "../utils/logger";

const getFileName = (params: { Key: string }) => {
  const obj: { fileName?: string; fileExt?: string } = {};
  //fine Name
  obj.fileName = params?.Key?.split?.('/')?.pop?.();
  //file ext from fileName
  obj.fileExt = obj?.fileName?.split?.('.')?.pop?.();
  return obj;
};

const saveZip = async (zip: any, name: string) => {
  try {
    const newMainFolderName = name;  
    const keys = Object?.keys(zip.files);

        // Determine if there's a top-level folder in the ZIP archive
        const hasTopLevelFolder = keys.some(key => key.startsWith('package 45/'));

      for await (const filename of keys) {
        const file = zip?.files?.[filename];
        if (!file?.dir) { // Ignore directories
          let newFilePath = filename;

          if (hasTopLevelFolder) {
            newFilePath = filename.replace(/^package 45\//, `${newMainFolderName}/`);
          }

          // Construct the full path where you want to save the file
          const filePath = path.join(__dirname, '../../extracted_files', newFilePath);

          // Ignore __MACOSX folder asynchronously
          if (!(filePath.includes("__MACOSX"))) {
            
              // Ensure the directory exists asynchronously
              await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      
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

const saveJson = async (jsonContent: string, fileName: string) => {
  try {
    const filePath = path.join(__dirname, '..', '..', MIGRATION_DATA_CONFIG.DATA, fileName);
    
    // Ensure the directory exists asynchronously /wordpressMigrationData
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const data = typeof jsonContent == "object" ? JSON.stringify(jsonContent, null, 4) : jsonContent || "{}";
    // Write the XML content to the file asynchronously
    await fs.promises.writeFile(filePath, data, 'utf8');

    return true;
  } catch (err: any) {
    console.error(err);
    logger.info('JSON file error while saving:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE,
    });
    return false;
  }
};

// parse xml to json
const parseXmlToJson = async (xml: any) => {
  try {
    const parser = new xml2js.Parser({
      attrkey: "attributes",
      charkey: "text",
      explicitArray: false,
    });
    const data = await parser.parseStringPromise(xml);
    return data
  } catch (err) {
    console.error(err);
    logger.info('XML file error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE,
    });
    return false;
  }
}

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


export { getFileName, saveZip, saveJson, fileOperationLimiter, deleteFolderSync, parseXmlToJson };
