// Import modular Drupal services
import { createAssets } from './drupal/assets.service.js';
import { createEntry } from './drupal/entries.service.js';
import { createLocale } from './drupal/locales.service.js';
import { createRefrence } from './drupal/references.service.js';
import { createTaxonomy } from './drupal/taxonomy.service.js';
import { createVersionFile } from './drupal/version.service.js';
import { createQuery, createQueryConfig } from './drupal/query.service.js';
import type { DbConfig, AssetsConfig } from './drupal/interface.js';

/**
 * Drupal migration service with SQL-based data extraction.
 *
 * All functions use direct database connections to extract data from Drupal
 * following the original migration patterns.
 *
 * IMPORTANT: Run in this order for proper dependency resolution:
 * 1. createQuery - Generate dynamic queries from database analysis (MUST RUN FIRST)
 * 2. generateContentTypeSchemas - Convert upload-api schema to API content types (MUST RUN AFTER upload-api)
 * 3. createAssets - Extract assets first (needed by entries)
 * 4. createRefrence - Create reference mappings (needed by entries)
 * 5. createTaxonomy - Extract taxonomies (needed by entries for taxonomy references)
 * 6. createEntry - Process entries (uses assets, references, and taxonomies)
 * 7. createLocale - Create locale configurations
 * 8. createVersionFile - Create version metadata file
 */
export const drupalService = {
  createQuery, // Generate dynamic queries from database analysis (MUST RUN FIRST)
  createQueryConfig, // Helper: Create query configuration file for dynamic SQL
  
  createAssets: (
    dbConfig: DbConfig,
    destination_stack_id: string,
    projectId: string,
    isTest = false,
    assetsConfig?: AssetsConfig
  ) => {
    return createAssets(
      dbConfig,
      destination_stack_id,
      projectId,
      assetsConfig?.base_url || '',
      assetsConfig?.public_path || '',
      isTest
    );
  },
  createRefrence, // Create reference mappings for relationships (run before entries)
  createTaxonomy, // Extract and process Drupal taxonomies (vocabularies and terms)
  createEntry: (
    dbConfig: DbConfig,
    destination_stack_id: string,
    projectId: string,
    isTest = false,
    masterLocale = 'en-us',
    project: Record<string, unknown> | null = null,
    contentTypes: Record<string, unknown>[] = []
  ) => {
    return createEntry(
      dbConfig,
      destination_stack_id,
      projectId,
      isTest,
      masterLocale,
      project,
      contentTypes
    );
  },
  createLocale, // Create locale configurations
  createVersionFile, // Create version metadata file
};
