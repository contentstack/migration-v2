import fs from 'fs';
import path from 'path';
import { createAemMapper } from '../controllers/aem';
import createSitecoreMapper from '../controllers/sitecore';
import createWordpressMapper from '../controllers/wordpress';
import { Config } from '../models/types';
import createContentfulMapper from './contentful';
import createDrupalMapper from './drupal';
import { deleteFolderSync } from '../helper';
import logger from '../utils/logger';

/**
 * Suffix pattern to match migration data folders
 */
const MIGRATION_DATA_SUFFIX = 'MigrationData';

/**
 * Get the upload-api root directory
 * This ensures we only delete folders within the upload-api directory,
 * regardless of where the process is started from
 */
const getUploadApiRoot = (): string => {
  // This file is at: upload-api/src/services/createMapper.ts
  // So upload-api root is 2 levels up from __dirname
  return path.resolve(__dirname, '..', '..');
};

/**
 * Clears ALL CMS migration data folders before starting a new migration
 * Deletes any folder ending with 'MigrationData' within the upload-api directory
 * This ensures switching between CMS types doesn't leave stale data
 */
const clearAllMigrationData = (): void => {
  const uploadApiRoot = getUploadApiRoot();

  logger.info(`🧹 Scanning for migration data folders (*${MIGRATION_DATA_SUFFIX})...`);

  try {
    // Read all items in the upload-api directory (not CWD)
    const items = fs.readdirSync(uploadApiRoot);

    // Find all folders ending with 'MigrationData'
    const migrationFolders = items.filter((item) => {
      const itemPath = path.join(uploadApiRoot, item);
      return (
        item.endsWith(MIGRATION_DATA_SUFFIX) &&
        fs.existsSync(itemPath) &&
        fs.statSync(itemPath).isDirectory()
      );
    });

    if (migrationFolders.length === 0) {
      logger.info(`📁 No migration data folders found to clear`);
      return;
    }

    logger.info(
      `🔍 Found ${migrationFolders.length} migration data folder(s): ${migrationFolders.join(', ')}`
    );

    // Delete each migration data folder
    for (const folder of migrationFolders) {
      const folderPath = path.join(uploadApiRoot, folder);

      try {
        logger.info(`🗑️ Deleting: ${folder}`);
        deleteFolderSync(folderPath);
        logger.info(`✅ Cleared: ${folder}`);
      } catch (error: any) {
        logger.warn(`⚠️ Could not delete ${folder}: ${error.message}`);
      }
    }

    logger.info(`✅ Migration data cleanup complete`);
  } catch (error: any) {
    logger.warn(`⚠️ Error scanning for migration folders: ${error.message}`);
  }
};

const createMapper = async (
  filePath: string = '',
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: Config
) => {
  const CMSIdentifier = config?.cmsType?.toLowerCase();

  // 🧹 CRITICAL: Clear ALL CMS migration data BEFORE starting any migration
  // This ensures:
  // 1. Switching between CMS types doesn't leave stale data
  // 2. Re-running migrations always starts fresh
  // 3. Old cached schemas don't interfere with new migrations
  clearAllMigrationData();

  switch (CMSIdentifier) {
    case 'sitecore': {
      return await createSitecoreMapper(filePath, projectId, app_token, affix, config);
    }

    case 'contentful': {
      return await createContentfulMapper(projectId, app_token, affix, config);
    }

    case 'wordpress': {
      return createWordpressMapper(filePath, projectId, app_token, affix);
    }

    case 'aem': {
      return createAemMapper(filePath, projectId, app_token, affix);
    }

    case 'drupal': {
      return createDrupalMapper(config, projectId, app_token, affix);
    }

    default:
      return false;
  }
};

export default createMapper;
