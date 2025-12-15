import fs from "fs";
import path from "path";
import { MIGRATION_DATA_CONFIG } from "../../constants/index.js";
import { getLogMessage } from "../../utils/index.js";
import customLogger from "../../utils/custom-logger.utils.js";

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG;

/**
 * Writes data to a specified file, ensuring the target directory exists.
 */
async function writeFile(dirPath: string, filename: string, data: any) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error(`Error writing ${dirPath}/${filename}::`, err);
  }
}

/**
 * Creates a version file for the given destination stack for Drupal migration.
 */
export const createVersionFile = async (
  destination_stack_id: string,
  projectId: string
): Promise<void> => {
  const srcFunc = 'createVersionFile';
  
  try {
    const versionData = {
      contentVersion: 2,
      logsPath: "",
      migrationSource: "drupal",
      migrationTimestamp: new Date().toISOString(),
    };

    await writeFile(
      path.join(DATA, destination_stack_id), 
      EXPORT_INFO_FILE,
      versionData
    );

    const message = getLogMessage(
      srcFunc,
      `Version file has been successfully created.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
    
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error writing version file: ${err}`,
      {},
      err
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};
