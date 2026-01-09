/**
 * Content Type Extraction Module
 * 
 * This module extracts content types from ZIP archives, processes JSON files,
 * and generates schema definitions for Contentful migration.
 */

import fs from "fs";
import path from "path";
import when from "when";
import unzipper from "unzipper";
import readdirRecursive from "fs-readdir-recursive";
import chalk from "chalk";
// import { MIGRATION_DATA_CONFIG } from "../../migration-sitecore/constants";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createSchema = require("./createSchema");

// Load configuration for content types module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../config");
const contenttypeFolder = config?.modules?.contentTypes;

// Array to accumulate all processed schema objects
const Schema_Array = [];

// Path to the master schema file where all content type schemas will be written
const schemaPath = path.join(
  process.cwd(),
  config.data,
  contenttypeFolder?.dirName,
  contenttypeFolder?.masterfile
);

/**
 * Main constructor function for content type extraction
 */
function ExtractContentTypes() {}

/**
 * Processes a single file and extracts content type schema if it's a JSON file
 * 
 * @param {string} filePath - Path to the file to process
 */
async function processEachFile(filePath) {
  // Get file extension to determine file type
  const ext = path.extname(filePath).toLowerCase();
  //console.log(chalk.blue(`Processing file: ${filePath}`));
  
  // Read file contents as UTF-8 text
  const allData = fs.readFileSync(filePath, "utf8");
  //const jsonData = JSON.parse(allData);
  //const data = jsonData?.data;

  // Only process JSON files
  if (ext === ".json") {
    try {
      // Parse JSON content
      const jsonData = JSON.parse(allData);
      const data = jsonData?.data;
      
      if (data) {
        // Generate schema object from the data using createSchema module
        const contentObject = await createSchema(data);

        // Add the schema object to the array if it was successfully created
        contentObject && Schema_Array.push(contentObject);
      } else {
        // Log warning if JSON file doesn't have expected "data" property
        console.log(chalk.gray(`No "data" property in ${filePath}`));
      }
    } catch (err) {
      // Silently handle JSON parsing errors (commented out error logging)
      //console.error(
      //chalk.red(`Invalid JSON in file: ${filePath}, error: ${err.message}`)
      //);
    }
  } 

}

/**
 * Extracts a ZIP archive and processes all files inside it
 * 
 * @param {string} zipPath - Path to the ZIP file to extract
 * @returns {string} Path where the ZIP was extracted
 */
async function processZip(zipPath) {
  // Extract filename without extension and replace underscores with spaces
  const fileNameWithoutExt = path
    .basename(zipPath, path.extname(zipPath))
    .replace(/_/g, " ");
  
  // Set extraction path to current module directory
  const extractPath = path.join(__dirname);
  // Create extraction directory if it doesn't exist
  fs.mkdirSync(extractPath, { recursive: true });

  // Extract ZIP file contents to the extraction path
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractPath }))
    .promise();

  // Recursively get all files from the extracted directory
  const allFiles = readdirRecursive(path.join(extractPath, fileNameWithoutExt));

  // Process each file in the extracted archive
  for (const file of allFiles) {
    //if (path.extname(file).toLowerCase() === ".xml") {
    // Process the file and extract schema if applicable
    await processEachFile(path.join(extractPath, fileNameWithoutExt, file));
    
    // Write updated schema array to master file after each file is processed
    // This ensures incremental updates in case of interruption
    await fs.writeFileSync(
      schemaPath,
      JSON.stringify(Schema_Array, null, 2),
      "utf-8"
    );
    //}
  }
  return extractPath;
}

/**
 * Prototype methods for ExtractContentTypes class
 */
ExtractContentTypes.prototype = {
  /**
   * Entry point: Starts the content type extraction process
   * Processes the ZIP file specified in global config
   */
  start: async function () {
    const csFilePath = await processZip(process?.env?.localPath);
  },
};

module.exports = ExtractContentTypes;
