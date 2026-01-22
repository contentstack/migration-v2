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
 * Pattern to match all migration data folders
 * All CMS types follow the naming convention: *MigrationData
 * e.g., drupalMigrationData, contentfulMigrationData, cmsMigrationData, etc.
 */
const MIGRATION_DATA_SUFFIX = 'MigrationData';

/**
 * Clears ALL CMS migration data folders before starting a new migration
 * Dynamically finds and deletes any folder ending with 'MigrationData'
 * This ensures switching between CMS types doesn't leave stale data
 */
const clearAllMigrationData = (): void => {
  const cwd = process.cwd();
  
  logger.info(`🧹 Scanning for migration data folders (*${MIGRATION_DATA_SUFFIX})...`);
  
  try {
    // Read all items in the current working directory
    const items = fs.readdirSync(cwd);
    
    // Find all folders ending with 'MigrationData'
    const migrationFolders = items.filter((item) => {
      const itemPath = path.join(cwd, item);
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
    
    logger.info(`🔍 Found ${migrationFolders.length} migration data folder(s): ${migrationFolders.join(', ')}`);
    
    // Delete each migration data folder
    for (const folder of migrationFolders) {
      const folderPath = path.join(cwd, folder);
      
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
