import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { HTTP_TEXTS, HTTP_CODES, MACOSX_FOLDER } from '../constants';
import logger from '../utils/logger';

const getFileName = (params: { Key: string }) => {
  const obj: { fileName?: string; fileExt?: string } = {};
  //fine Name
  obj.fileName = params?.Key?.split?.('/')?.pop?.();
  //file ext from fileName
  obj.fileExt = obj?.fileName?.split?.('.')?.pop?.();
  return obj;
};

/**
 * Splits a file path and returns the first folder or file name.
 * Example: "umesh/items/master/sitecore/content" => "umesh"
 */
function getFirstNameFromFilename(filename: string): string {
  if (!filename) return '';
  // Split by both Unix and Windows separators
  const parts = filename.split(/[\\/]/);
  return parts[0] || '';
}

const saveZip = async (zip: any, name: string) => {
  try {
    const JSZip = require('jszip');
    const newMainFolderName = name;
    const keys = Object.keys(zip.files);
    let filePathSaved = undefined;
    const sitecoreFolders = ['blob', 'installer', 'items', 'metadata', 'properties'];

    for await (const filename of keys) {
      const file = zip.files[filename];
      if (!file.dir) {
        // Check if this is a nested zip file that might contain Sitecore structure
        if (filename.toLowerCase().endsWith('.zip')) {
          try {
            const nestedZipBuffer = await file.async('nodebuffer');
            const nestedZip = new JSZip();
            await nestedZip.loadAsync(nestedZipBuffer);

            // Check if nested zip contains Sitecore folders
            const nestedKeys = Object.keys(nestedZip.files);
            const hasSitecoreFolders = sitecoreFolders.some((folder) =>
              nestedKeys.some((key) => key.includes(`/${folder}/`) || key.startsWith(`${folder}/`))
            );

            if (hasSitecoreFolders) {
              // Extract the nested zip contents
              for await (const nestedFilename of nestedKeys) {
                const nestedFile = nestedZip.files[nestedFilename];
                if (!nestedFile.dir) {
                  const nestedFilePath = path.join(
                    newMainFolderName,
                    'nested-extracted',
                    nestedFilename
                  );
                  const fullNestedPath = path.join(
                    __dirname,
                    '..',
                    '..',
                    'extracted_files',
                    nestedFilePath
                  );

                  if (!fullNestedPath.includes(MACOSX_FOLDER)) {
                    await fs.promises.mkdir(path.dirname(fullNestedPath), { recursive: true });
                    const nestedContent = await nestedFile.async('nodebuffer');
                    await fs.promises.writeFile(fullNestedPath, nestedContent);
                  }
                }
              }
              // Set the filePathSaved to indicate we found nested Sitecore content
              if (!filePathSaved) {
                filePathSaved = 'nested-extracted';
              }
            } else {
              // Save the zip file itself if it doesn't contain Sitecore structure
              const zipFilePath = path.join(newMainFolderName, filename);
              const fullZipPath = path.join(__dirname, '..', '..', 'extracted_files', zipFilePath);
              await fs.promises.mkdir(path.dirname(fullZipPath), { recursive: true });
              const zipContent = await file.async('nodebuffer');
              await fs.promises.writeFile(fullZipPath, zipContent);
            }
          } catch (nestedError: any) {
            // Save the zip file as-is if we can't process it
            const zipFilePath = path.join(newMainFolderName, filename);
            const fullZipPath = path.join(__dirname, '..', '..', 'extracted_files', zipFilePath);
            await fs.promises.mkdir(path.dirname(fullZipPath), { recursive: true });
            const zipContent = await file.async('nodebuffer');
            await fs.promises.writeFile(fullZipPath, zipContent);
          }
        } else {
          // Handle regular files
          let newFilePath = filename;
          if (
            !filename.startsWith(newMainFolderName + path.sep) &&
            !filename.startsWith(newMainFolderName + '/')
          ) {
            newFilePath = path.join(newMainFolderName, filename);
            if (
              !filename?.includes?.(MACOSX_FOLDER) &&
              sitecoreFolders?.includes?.(getFirstNameFromFilename(filename)) === false
            ) {
              filePathSaved = getFirstNameFromFilename(filename);
            }
          }
          const filePath = path.join(__dirname, '..', '..', 'extracted_files', newFilePath);
          if (!filePath.includes(MACOSX_FOLDER)) {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            const content = await file.async('nodebuffer');
            await fs.promises.writeFile(filePath, content);
          }
        }
      }
    }
    return { isSaved: true, filePath: filePathSaved };
  } catch (err: any) {
    console.error(err);
    logger.info('Zipfile error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.ZIP_FILE_SAVE
    });
    return { isSaved: false, filePath: undefined };
  }
};

const saveJson = async (jsonContent: string, fileName: string) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'extracted_files', fileName);
    // Ensure the directory exists asynchronously /extracted_files
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const data =
      typeof jsonContent == 'object' ? JSON.stringify(jsonContent, null, 4) : jsonContent || '{}';
    // Write the XML content to the file asynchronously
    await fs.promises.writeFile(filePath, data, 'utf8');

    return true;
  } catch (err: any) {
    console.error(err);
    logger.info('JSON file error while saving:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE
    });
    return false;
  }
};

const cleanXml = (xml: string): string => {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .trim();
};

// parse xml to json
const parseXmlToJson = async (xml: any) => {
  try {
    const xmldata = cleanXml(xml);

    const parser = new xml2js.Parser({
      attrkey: 'attributes',
      charkey: 'text',
      explicitArray: false,
      trim: true,
      normalize: true,
      normalizeTags: true
    });
    const data = await parser.parseStringPromise(xmldata);
    return data;
  } catch (err) {
    console.error(err);
    logger.info('XML file error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE
    });
    return false;
  }
};

const fileOperationLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 2, // Limit each IP to 2 requests per windowMs for this endpoint
  message: {
    status: 'rate limit',
    message: 'Rate limit exceeded. Only 2 calls allowed every 2 minutes.'
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
