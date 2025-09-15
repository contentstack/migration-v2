// Import modular Drupal services
import { createAssets } from './drupal/assets.service.js';
import { createEntry } from './drupal/entries.service.js';
import { createLocale } from './drupal/locales.service.js';
import { createRefrence } from './drupal/references.service.js';
import { createTaxonomy } from './drupal/taxonomy.service.js';
import { createVersionFile } from './drupal/version.service.js';
import { createQuery, createQueryConfig } from './drupal/query.service.js';
import { generateContentTypeSchemas } from './drupal/content-types.service.js';

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
  generateContentTypeSchemas, // Convert upload-api schema to API content types (MUST RUN AFTER upload-api)
  createAssets: (dbConfig: any, destination_stack_id: string, projectId: string, isTest = false, drupalAssetsConfig?: any) => {
    console.info('🔍 === DRUPAL SERVICE - ASSETS WRAPPER ===');
    console.info('📋 Received DB Config from Migration Service:', JSON.stringify(dbConfig, null, 2));
    console.info('📋 Received Assets Config from Migration Service:', JSON.stringify(drupalAssetsConfig, null, 2));
    console.info('📋 Stack ID:', destination_stack_id);
    console.info('📋 Project ID:', projectId);
    console.info('📋 Is Test:', isTest);
    console.info('==========================================');
    return createAssets(
      dbConfig, 
      destination_stack_id, 
      projectId, 
      drupalAssetsConfig?.base_url || "", 
      drupalAssetsConfig?.public_path || "/sites/default/files/", 
      isTest
    );
  },
  createRefrence,  // Create reference mappings for relationships (run before entries)
  createTaxonomy,  // Extract and process Drupal taxonomies (vocabularies and terms)
  createEntry: (dbConfig: any, destination_stack_id: string, projectId: string, isTest = false, masterLocale = 'en-us', contentTypeMapping: any[] = []) => {
    console.info('🔍 === DRUPAL SERVICE - ENTRIES WRAPPER ===');
    console.info('📋 Received Config from Migration Service:', JSON.stringify(dbConfig, null, 2));
    console.info('📋 Stack ID:', destination_stack_id);
    console.info('📋 Project ID:', projectId);
    console.info('📋 Is Test:', isTest);
    console.info('📋 Master Locale:', masterLocale);
    console.info('📋 Content Type Mapping Count:', contentTypeMapping.length);
    console.info('============================================');
    return createEntry(dbConfig, destination_stack_id, projectId, isTest, masterLocale, contentTypeMapping);
  },
  createLocale,    // Create locale configurations
  createVersionFile, // Create version metadata file
};
