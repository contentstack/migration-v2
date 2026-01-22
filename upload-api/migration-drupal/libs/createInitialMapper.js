'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * External module dependencies.
 */
const fs = require('fs'); // for existsSync
const fsp = require('fs/promises'); // for async file operations
const path = require('path');
const contentTypeMapper = require('./contentTypeMapper');

/**
 * Internal module dependencies.
 */
const { dbConnection } = require('../utils/helper');
const config = require('../config');
const idArray = require('../utils/restrictedKeyWords');

/**
 * Helper function to check if string starts with a number
 */
function startsWithNumber(str) {
  return /^\d/.test(str);
}

/**
 * Improved UID corrector based on Sitecore implementation but adapted for Drupal
 * Handles all edge cases: restricted keywords, numbers, CamelCase, special characters
 */
const uidCorrector = (uid, prefix) => {
  if (!uid || typeof uid !== 'string' || !prefix) {
    return '';
  }

  let newUid = uid;

  // Handle restricted keywords
  if (idArray.includes(uid) || uid.startsWith('_ids') || uid.endsWith('_ids')) {
    newUid = `${prefix}_${uid}`;
  }

  // Handle UIDs that start with numbers
  if (startsWithNumber(newUid)) {
    newUid = `${prefix}_${newUid}`;
  }

  // Clean up the UID
  newUid = newUid
    .replace(/[ -]/g, '_') // Replace spaces and hyphens with underscores
    .replace(/[^a-zA-Z0-9_]+/g, '_') // Replace non-alphanumeric characters (except underscore)
    .replace(/\$/g, '') // Remove dollar signs
    .toLowerCase() // Convert to lowercase
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`) // Handle camelCase
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Ensure UID doesn't start with underscore (Contentstack requirement)
  if (newUid.startsWith('_')) {
    newUid = newUid.substring(1);
  }

  return newUid;
};

/**
 * Gets actually used taxonomy vocabularies per content type from entry data
 * This queries ACTUAL entry data, not just field configuration
 * 
 * IMPORTANT: Drupal's taxonomy_index table does NOT track all taxonomy references!
 * It only indexes certain fields (free-tagging). We need to scan ALL node__field_* tables
 * for taxonomy term references.
 * 
 * @param {Object} connection - Database connection
 * @param {string} contentType - Content type bundle name
 * @returns {Promise<Set>} Set of vocabulary uids actually used by this content type
 */
const getActualTaxonomyUsage = async (connection, contentType) => {
  const usedVocabs = new Set();
  
  try {
    // Step 1: Find ALL field tables for this content type that might have taxonomy references
    // These are tables named node__field_* that have a *_target_id column
    const [fieldTables] = await connection.promise().query(`
      SELECT DISTINCT t.TABLE_NAME, c.COLUMN_NAME
      FROM information_schema.TABLES t
      INNER JOIN information_schema.COLUMNS c 
        ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      WHERE t.TABLE_SCHEMA = DATABASE()
        AND t.TABLE_NAME LIKE 'node__field_%'
        AND t.TABLE_NAME NOT LIKE '%revision%'
        AND c.COLUMN_NAME LIKE '%_target_id'
    `);
    
    console.info(`🔍 Found ${fieldTables.length} potential taxonomy reference tables for ${contentType}`);
    
    // Step 2: For each field table, check if target_ids reference taxonomy terms
    for (const fieldTable of fieldTables) {
      const tableName = fieldTable.TABLE_NAME;
      const targetIdColumn = fieldTable.COLUMN_NAME;
      
      try {
        // Query: Get vocabularies for any target_ids that exist in taxonomy_term_field_data
        // This checks if the target_id references a taxonomy term (not a node or other entity)
        const [vocabs] = await connection.promise().query(`
          SELECT DISTINCT ttfd.vid as vocabulary_uid
          FROM \`${tableName}\` ft
          INNER JOIN taxonomy_term_field_data ttfd ON ft.${targetIdColumn} = ttfd.tid
          WHERE ft.bundle = ?
            AND ft.${targetIdColumn} IS NOT NULL
        `, [contentType]);
        
        for (const row of vocabs) {
          if (row.vocabulary_uid) {
            usedVocabs.add(row.vocabulary_uid);
          }
        }
      } catch (tableError) {
        // Skip tables that don't exist or have incompatible structure
        // This is expected for non-taxonomy reference fields
      }
    }
    
    // Step 3: Also check taxonomy_index as a backup (for fields that ARE indexed)
    try {
      const [indexVocabs] = await connection.promise().query(`
        SELECT DISTINCT ttfd.vid as vocabulary_uid
        FROM taxonomy_index ti
        INNER JOIN node_field_data nfd ON ti.nid = nfd.nid
        INNER JOIN taxonomy_term_field_data ttfd ON ti.tid = ttfd.tid
        WHERE nfd.type = ?
      `, [contentType]);
      
      for (const row of indexVocabs) {
        if (row.vocabulary_uid) {
          usedVocabs.add(row.vocabulary_uid);
        }
      }
    } catch (indexError) {
      // taxonomy_index might not exist in some Drupal installations
    }
    
    return usedVocabs;
  } catch (error) {
    console.error(`⚠️ Could not query taxonomy usage for ${contentType}:`, error.message);
    return usedVocabs;
  }
};

/**
 * Creates an initial mapping for content types by processing Drupal database data.
 */
const createInitialMapper = async (systemConfig, prefix) => {
  try {
    const drupalFolderPath = path.resolve(config.data, config.drupal.drupal);

    // Create fresh directory (cleanup is now handled at service level)
    if (!fs.existsSync(drupalFolderPath)) {
      await fsp.mkdir(drupalFolderPath, { recursive: true });
    }

    // Get database connection
    const connection = dbConnection(systemConfig);

    // SQL query to get field configurations
    const query =
      "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    // Execute query
    const [rows] = await connection.promise().query(query);

    const details_data = [];

    // Process each row to extract field data
    let profileFieldsFiltered = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        const { unserialize } = require('php-serialize');
        const conv_details = unserialize(rows[i].data);

        // Filter out profile content type fields (case-insensitive)
        const bundleName = conv_details?.bundle?.toLowerCase();
        if (bundleName === 'profile') {
          profileFieldsFiltered++;
          continue; // Skip profile fields
        }

        // Double check - don't add if content_types would be 'profile'
        if (conv_details?.bundle?.toLowerCase() === 'profile') {
          continue;
        }

        details_data.push({
          field_label: conv_details?.label,
          description: conv_details?.description,
          field_name: conv_details?.field_name,
          content_types: conv_details?.bundle,
          type: conv_details?.field_type,
          handler: conv_details?.settings?.handler,
          reference: conv_details?.settings?.handler_settings?.target_bundles,
          min: conv_details?.settings?.min,
          max: conv_details?.settings?.max,
          default_value: conv_details?.default_value?.[0]?.value
        });
      } catch (error) {
        console.error(`Couldn't parse row ${i}:`, error.message);
      }
    }

    if (details_data.length === 0) {
      return { contentTypes: [] };
    }

    const initialMapper = [];
    const allContentTypes = Object.keys(require('lodash').keyBy(details_data, 'content_types'));
    // Aggressive filter: remove profile (case-insensitive) and any null/undefined
    const contentTypes = allContentTypes.filter(
      (contentType) => contentType && contentType.toLowerCase() !== 'profile'
    );

    // Process each content type
    for (const contentType of contentTypes) {
      // Extra safety check - skip if contentType is profile (case-insensitive)
      if (!contentType || contentType.toLowerCase() === 'profile') {
        continue;
      }

      // 🏷️ Get ACTUALLY used taxonomy vocabularies for this content type from entry data
      const actualTaxonomyUsage = await getActualTaxonomyUsage(connection, contentType);
      if (actualTaxonomyUsage.size > 0) {
        console.info(`✓ Found ${actualTaxonomyUsage.size} taxonomy vocabularies actually used in ${contentType}: ${[...actualTaxonomyUsage].join(', ')}`);
      }

      const contentTypeFields = require('lodash').filter(details_data, {
        content_types: contentType
      });
      const contenttypeTitle = contentType.split('_').join(' ');

      const contentTypeObject = {
        status: 1,
        isUpdated: false,
        updateAt: '',
        otherCmsTitle: contenttypeTitle,
        otherCmsUid: contenttypeTitle,
        contentstackTitle: contenttypeTitle.charAt(0).toUpperCase() + contenttypeTitle.slice(1),
        contentstackUid: uidCorrector(contenttypeTitle, prefix),
        type: 'content_type',
        fieldMapping: []
      };

      // Map fields using contentTypeMapper, passing actual taxonomy usage
      const contentstackFields = await contentTypeMapper(
        contentTypeFields,
        contentTypes,
        prefix,
        systemConfig.mysql,
        actualTaxonomyUsage // Pass actual usage to contentTypeMapper
      );
      contentTypeObject.fieldMapping = contentstackFields;

      initialMapper.push(contentTypeObject);

      // Save individual content type file
      const main = {
        title: contenttypeTitle,
        uid: contentType,
        schema: contentstackFields,
        description: `Schema for ${contenttypeTitle}`,
        options: {
          is_page: true,
          singleton: false,
          sub_title: [],
          title: `title`,
          url_pattern: '/:title',
          url_prefix: `/${contenttypeTitle.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()}/`
        }
      };

      // Final safety check before writing file - NEVER write profile.json
      if (contentType.toLowerCase() === 'profile') {
        continue;
      }

      const filePath = path.join(drupalFolderPath, `${contentType}.json`);
      await fsp.writeFile(filePath, JSON.stringify(main, null, 4));
    }

    // Close database connection
    connection.end();
    return { contentTypes: initialMapper };
  } catch (error) {
    console.error('Error in content type extraction:', error);
    throw error;
  }
};

module.exports = createInitialMapper;
