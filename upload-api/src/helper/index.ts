import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import mysql from "mysql2";
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

function dbConnect2({host, user, password, database}: {host: string, user: string, password: string, database: string}) {
  var connection = mysql.createConnection({
    host: host,
    user:user,
    password: password,
    database: database,
  });
  return connection;
}



function dbConnect({
  host,
  user,
  password,
  database,
}: {
  host: string;
  user: string;
  password: string;
  database: string;
}): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const mysqlConfig ={
        host: host,
        user: user,
        password: password,
        database: database,
      }
      const connection = mysql.createConnection(mysqlConfig);
   
      connection.connect((err) => {
        if (err) {
          console.error('Connection failed:', err.message);
          reject(false); 
          return;
        }

        console.log('Connection successful. Running query...');
        
        // Execute the query
        const query = 'SELECT * FROM node LIMIT 1;'; // Query to test
        connection.query(query, (queryErr, results) => {
          if (queryErr) {
            console.error('Query failed:', queryErr.message);
            connection.end();
            reject(false); 
            return;
          }
          const filePath = path.join(__dirname, '../../extracted_files', "mysqlConfig.json");
          fs.writeFile(filePath, JSON.stringify(mysqlConfig, null, 2), (writeErr) => {
            connection.end(); 
            if (writeErr) {
              console.error('Failed to write JSON file:', writeErr.message);
              reject(writeErr);
              return;
            }
            console.log(`Results written to ${filePath}`);
            resolve(true);            
          });
          console.log('Query executed successfully:', results);
          connection.end();
          resolve(true); 
        });
      });
    } catch (error) {
      console.error('Unexpected error during database connection:', error);
      reject(false);
    }
  });
}



export { getFileName, saveZip, fileOperationLimiter, deleteFolderSync, dbConnect };
