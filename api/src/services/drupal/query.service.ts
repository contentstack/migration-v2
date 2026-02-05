/* eslint-disable */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2';
import { getDbConnection } from '../../helper/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';

const { DATA } = MIGRATION_DATA_CONFIG;

// PHP unserialize functionality (simplified for Node.js)
// Dynamic import for phpUnserialize will be used in the function

/**
 * Interface for field data extracted from Drupal config
 */
interface DrupalFieldData {
  field_name: string;
  content_types: string;
  type: string;
  content_handler?: string;
  target_bundles?: string[]; // Content types this reference field targets
}

/**
 * Helper function to check if a reference field should be skipped
 * Returns true if the field only references 'profile' or has no valid targets
 */
function shouldSkipReferenceField(
  targetBundles: string[] | undefined
): boolean {
  if (!targetBundles || targetBundles.length === 0) {
    return false; // No specific targets, will use fallback - don't skip
  }
  // Filter out profile
  const validTargets = targetBundles.filter(
    (bundle) => bundle && bundle.toLowerCase() !== 'profile'
  );
  // Skip if empty after filtering (meaning it only had profile)
  return validTargets.length === 0;
}

/**
 * Interface for query configuration
 */
interface QueryConfig {
  page: { [contentType: string]: string };
  count: { [contentType: string]: string };
}

/**
 * Gets taxonomy reference fields for a content type by scanning actual entry data
 * Similar to upload-api's getActualTaxonomyUsage but returns field info for query generation
 *
 * @param connection - MySQL connection
 * @param contentType - Content type bundle name
 * @returns Array of field table/column info that reference taxonomies
 */
async function getTaxonomyFieldsForContentType(
  connection: mysql.Connection,
  contentType: string
): Promise<
  Array<{ tableName: string; columnName: string; fieldName: string }>
> {
  const taxonomyFields: Array<{
    tableName: string;
    columnName: string;
    fieldName: string;
  }> = [];

  try {
    // Find ALL field tables for this content type that have taxonomy references
    const [fieldTables] = (await connection.promise().query(`
      SELECT DISTINCT t.TABLE_NAME, c.COLUMN_NAME
      FROM information_schema.TABLES t
      INNER JOIN information_schema.COLUMNS c 
        ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      WHERE t.TABLE_SCHEMA = DATABASE()
        AND t.TABLE_NAME LIKE 'node__field_%'
        AND t.TABLE_NAME NOT LIKE '%revision%'
        AND c.COLUMN_NAME LIKE '%_target_id'
    `)) as any[];

    // For each field table, check if target_ids reference taxonomy terms for this content type
    for (const fieldTable of fieldTables) {
      const tableName = fieldTable.TABLE_NAME;
      const targetIdColumn = fieldTable.COLUMN_NAME;
      const fieldName = tableName.replace('node__', '');

      // Skip known image/file fields by name pattern
      if (
        fieldName.includes('image') ||
        fieldName.includes('file') ||
        fieldName.includes('photo') ||
        fieldName.includes('media') ||
        fieldName.includes('hero_image')
      ) {
        continue;
      }

      try {
        // NOTE: Removed file_managed check as it caused false positives due to ID collisions
        // (taxonomy term IDs can coincidentally match file IDs)
        // We now rely on: 1) field name patterns, 2) taxonomy_term_field_data check

        // Check if this field has taxonomy term references for this content type
        const [vocabs] = (await connection.promise().query(
          `
          SELECT DISTINCT ttfd.vid as vocabulary_uid
          FROM \`${tableName}\` ft
          INNER JOIN taxonomy_term_field_data ttfd ON ft.${targetIdColumn} = ttfd.tid
          WHERE ft.bundle = ?
            AND ft.${targetIdColumn} IS NOT NULL
          LIMIT 1
        `,
          [contentType]
        )) as any[];

        if (vocabs && vocabs.length > 0) {
          taxonomyFields.push({
            tableName,
            columnName: targetIdColumn,
            fieldName,
          });
        }
      } catch (tableError) {
        // Skip tables that don't exist or have incompatible structure
      }
    }

    // Step 3: Also check taxonomy_index as a backup (for indexed taxonomy relationships)
    // This catches taxonomy relationships that might not be in explicit field tables
    try {
      const [indexVocabs] = (await connection.promise().query(
        `
        SELECT DISTINCT ttfd.vid as vocabulary_uid
        FROM taxonomy_index ti
        INNER JOIN node_field_data nfd ON ti.nid = nfd.nid
        INNER JOIN taxonomy_term_field_data ttfd ON ti.tid = ttfd.tid
        WHERE nfd.type = ?
      `,
        [contentType]
      )) as any[];

      if (indexVocabs && indexVocabs.length > 0) {
        // Check if we already have a taxonomy field - if not, add from taxonomy_index
        // We need to check existing taxonomy fields for this content type
        // If taxonomy_index has vocabs that aren't covered by explicit fields, add it
        const hasExplicitTaxonomyField = taxonomyFields.length > 0;

        if (!hasExplicitTaxonomyField && indexVocabs.length > 0) {
          // Add taxonomy_index as a pseudo-field
          taxonomyFields.push({
            tableName: 'taxonomy_index',
            columnName: 'tid',
            fieldName: 'taxonomy_index',
          });
        }
      }
    } catch (indexError) {
      // taxonomy_index might not exist in some Drupal installations
    }

    return taxonomyFields;
  } catch (error: any) {
    console.error(
      `⚠️ Could not query taxonomy fields for ${contentType}:`,
      error.message
    );
    return taxonomyFields;
  }
}

/**
 * Get field information by querying the database for a specific field
 * Enhanced to handle link fields with both URI and TITLE columns
 */
const getQuery = (
  connection: mysql.Connection,
  data: DrupalFieldData
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const tableName = `node__${data.field_name}`;

      // Check if this is a link field first
      if (data.type !== 'link') {
        // For non-link fields, use existing logic
        const value = data.field_name;
        const handlerType =
          data.content_handler === undefined ? 'invalid' : data.content_handler;
        const query = `SELECT *, '${handlerType}' as handler, '${data.type}' as fieldType FROM ${tableName}`;

        connection.query(query, (error: any, rows: any, fields: any) => {
          if (!error && fields) {
            // Look for field patterns in the database columns
            for (const field of fields) {
              const fieldName = field.name;

              // Check for various Drupal field suffixes
              if (
                fieldName === `${value}_value` ||
                fieldName === `${value}_fid` ||
                fieldName === `${value}_tid` ||
                fieldName === `${value}_status` ||
                fieldName === `${value}_target_id` ||
                fieldName === `${value}_uri`
              ) {
                const fieldTable = `node__${data.field_name}.${fieldName}`;
                resolve(fieldTable);
                return;
              }
            }
            // If no matching field was found
            resolve('');
          } else {
            console.error(`Error executing query for field ${value}:`, error);
            resolve(''); // Resolve with empty string on error to continue process
          }
        });
        return;
      }

      // For LINK fields only - get both URI and TITLE columns
      connection.query(
        `SHOW COLUMNS FROM ${tableName}`,
        (error: any, columns: any) => {
          if (error) {
            console.error(
              `Error querying columns for link field ${data.field_name}:`,
              error
            );
            resolve('');
            return;
          }

          // Filter for link-specific columns only
          const linkColumns = columns
            .map((col: any) => col.Field)
            .filter(
              (field: string) =>
                (field === `${data.field_name}_uri` ||
                  field === `${data.field_name}_title`) &&
                field.startsWith(data.field_name)
            );

          if (linkColumns.length > 0) {
            // Return both columns as MAX aggregations for link fields
            const maxColumns = linkColumns.map(
              (col: string) => `MAX(${tableName}.${col}) as ${col}`
            );
            resolve(maxColumns.join(','));
          } else {
            // Fallback to just URI if title doesn't exist
            const uriColumn = `${data.field_name}_uri`;
            resolve(`MAX(${tableName}.${uriColumn}) as ${uriColumn}`);
          }
        }
      );
    } catch (error) {
      console.error('Error in getQuery', error);
      resolve(''); // Resolve with empty string on error to continue process
    }
  });
};

/**
 * Process field data and generate SQL queries for each content type
 */
const generateQueriesForFields = async (
  connection: mysql.Connection,
  fieldData: DrupalFieldData[],
  projectId: string,
  destination_stack_id: string
): Promise<QueryConfig> => {
  try {
    const select: { [contentType: string]: string } = {};
    const countQuery: { [contentType: string]: string } = {};

    // Group fields by content type and filter out profile
    const contentTypes = [
      ...new Set(fieldData.map((field) => field.content_types)),
    ].filter((contentType) => contentType !== 'profile');

    const message = `Processing ${contentTypes.length} content types for query generation...`;
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Process each content type
    for (const contentType of contentTypes) {
      const fieldsForType = fieldData.filter(
        (field) => field.content_types === contentType
      );
      const fieldCount = fieldsForType.length;
      const maxJoinLimit = 50; // Conservative limit to avoid MySQL's 61-table limit

      // Check if content type has too many fields for single query
      if (fieldCount > maxJoinLimit) {
        const warningMessage = `Content type '${contentType}' has ${fieldCount} fields (>${maxJoinLimit} limit). Using optimized base query only.`;
        await customLogger(
          projectId,
          destination_stack_id,
          'warn',
          warningMessage
        );

        // Generate simple base query without field JOINs to avoid MySQL limit
        const baseQuery = `
          SELECT 
            node.nid, 
            node.title, 
            node.langcode, 
            node.type,
            users.name as author_name
          FROM node_field_data node
          LEFT JOIN users ON users.uid = node.uid
          WHERE node.type = '${contentType}'
          GROUP BY node.nid
        `
          .replace(/\s+/g, ' ')
          .trim();

        const baseCountQuery = `
          SELECT COUNT(DISTINCT node.nid) as countentry 
          FROM node_field_data node 
          WHERE node.type = '${contentType}'
        `
          .replace(/\s+/g, ' ')
          .trim();

        select[contentType] =
          baseQuery + ` /* OPTIMIZED_NO_JOINS:${fieldCount} */`;
        countQuery[`${contentType}Count`] = baseCountQuery;

        const optimizedMessage = `Generated optimized base query for ${contentType} (avoiding ${fieldCount} JOINs)`;
        await customLogger(
          projectId,
          destination_stack_id,
          'info',
          optimizedMessage
        );

        continue; // Skip to next content type
      }

      const tableJoins: string[] = [];
      const queries: Promise<string>[] = [];

      // Collect all field queries (only for content types with manageable field count)
      if (fieldsForType && Array.isArray(fieldsForType)) {
        fieldsForType.forEach((fieldData) => {
          if (!fieldData?.field_name) return;
          tableJoins.push(`node__${fieldData.field_name}`);
          queries.push(getQuery(connection, fieldData));
        });
      }

      // 🏷️ TAXONOMY FIX: Check for taxonomy fields that might not be in field config
      // but have actual usage in entry data (similar to upload-api's approach)
      const taxonomyFields = await getTaxonomyFieldsForContentType(
        connection,
        contentType
      );

      // Add taxonomy fields that aren't already in the query
      for (const taxField of taxonomyFields) {
        if (!tableJoins.includes(taxField.tableName)) {
          tableJoins.push(taxField.tableName);
          // Add the column directly to queries as a resolved promise
          const taxColumnQuery = `${taxField.tableName}.${taxField.columnName}`;
          queries.push(Promise.resolve(taxColumnQuery));
        }
      }

      try {
        // Wait for all field queries to complete
        const results = await Promise.all(queries);

        // Filter out empty results
        const validResults = results.filter((item) => item);

        if (validResults.length === 0) {
          continue;
        }

        // Build the SELECT clause with proper handling for link fields
        const modifiedResults = validResults.map((item) => {
          // Check if this is already a MAX aggregation (link fields)
          if (item.includes('MAX(') && item.includes(' as ')) {
            return item; // Link fields are already properly formatted
          }
          // For other fields, apply MAX aggregation
          return `MAX(${item}) as ${item.split('.').pop()}`;
        });

        // Build LEFT JOIN clauses
        const leftJoins = tableJoins.map((table) => {
          // Handle taxonomy_index specially - it joins on nid, not entity_id
          if (table === 'taxonomy_index') {
            return `LEFT JOIN ${table} ON ${table}.nid = node.nid`;
          }
          return `LEFT JOIN ${table} ON ${table}.entity_id = node.nid`;
        });
        leftJoins.push('LEFT JOIN users ON users.uid = node.uid');

        // Construct the complete query
        const selectClause = [
          'SELECT node.nid, MAX(node.title) AS title, MAX(node.langcode) AS langcode, MAX(node.type) as type',
          ...modifiedResults,
        ].join(',');

        const fromClause = 'FROM node_field_data node';
        const joinClause = leftJoins.join(' ');
        const whereClause = `WHERE node.type = '${contentType}'`;
        const groupClause = 'GROUP BY node.nid';

        // Final query construction
        const finalQuery = `${selectClause} ${fromClause} ${joinClause} ${whereClause} ${groupClause}`;

        // Clean up any double commas
        select[contentType] = finalQuery
          .replace(/,,/g, ',')
          .replace(/, ,/g, ',');

        // Build count query
        const countQueryStr = `SELECT count(distinct(node.nid)) as countentry ${fromClause} ${joinClause} ${whereClause}`;
        countQuery[`${contentType}Count`] = countQueryStr;

        const fieldMessage = `Generated queries for content type: ${contentType} with ${validResults.length} fields`;
        await customLogger(
          projectId,
          destination_stack_id,
          'info',
          fieldMessage
        );
      } catch (error) {
        const errorMessage = `Error processing queries for content type: ${contentType}`;
        await customLogger(
          projectId,
          destination_stack_id,
          'error',
          errorMessage
        );
        console.error(
          'Error processing queries for content type:',
          contentType,
          error
        );
      }
    }

    return {
      page: select,
      count: countQuery,
    };
  } catch (error: any) {
    const errorMessage = `Error in generateQueriesForFields: ${error.message}`;
    await customLogger(projectId, destination_stack_id, 'error', errorMessage);
    throw error;
  }
};

/**
 * Extract field configuration from Drupal database and generate dynamic queries
 * Based on upload-api/migration-drupal/libs/extractQueries.js
 */
/**
 * Validates that query configuration file exists (legacy compatibility)
 *
 * NOTE: This function is for backward compatibility.
 * The new dynamic query system uses createQuery() which generates queries
 * based on actual database field analysis.
 */
export const createQueryConfig = async (
  destination_stack_id: string,
  customQueries?: any
): Promise<void> => {
  const queryDir = path.join(DATA, destination_stack_id, 'query');
  const queryPath = path.join(queryDir, 'index.json');

  try {
    // Check if dynamic query file exists (should be created by createQuery service)
    await fs.promises.access(queryPath);
  } catch (error) {
    // If no dynamic queries exist, this is an error since we removed hardcoded fallbacks
    throw new Error(
      `❌ No query configuration found at ${queryPath}. Dynamic queries must be generated first using createQuery() service.`
    );
  }
};

export const createQuery = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string
): Promise<void> => {
  let connection: mysql.Connection | null = null;

  try {
    const queryDir = path.join(DATA, destination_stack_id, 'query');
    const queryPath = path.join(queryDir, 'index.json');

    // Create query directory
    await fs.promises.mkdir(queryDir, { recursive: true });

    connection = await getDbConnection(
      dbConfig,
      projectId,
      destination_stack_id
    );

    // SQL query to extract field configuration from Drupal
    const configQuery =
      "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    // Execute query using promise-based approach
    const [rows] = (await connection.promise().query(configQuery)) as any[];

    let fieldData: DrupalFieldData[] = [];
    let skippedProfileFields = 0;

    // Process results and extract field information
    for (let i = 0; i < rows.length; i++) {
      try {
        const { unserialize } = await import('php-serialize');
        const convDetails = unserialize(rows[i].data);
        if (
          convDetails &&
          typeof convDetails === 'object' &&
          'field_name' in convDetails &&
          convDetails.bundle !== 'profile' // Filter out profile content type fields
        ) {
          // Extract target_bundles for entity_reference fields
          const targetBundles = convDetails?.settings?.handler_settings
            ?.target_bundles
            ? Object.keys(convDetails.settings.handler_settings.target_bundles)
            : undefined;

          // Skip entity_reference fields that ONLY reference 'profile'
          const isEntityReference =
            convDetails.field_type === 'entity_reference';
          if (isEntityReference && shouldSkipReferenceField(targetBundles)) {
            skippedProfileFields++;
            continue;
          }

          fieldData.push({
            field_name: convDetails.field_name,
            content_types: convDetails.bundle,
            type: convDetails.field_type,
            content_handler: convDetails?.settings?.handler,
            target_bundles: targetBundles,
          });
        }
      } catch (err: any) {
        console.error(`Couldn't parse row ${i}:`, err.message);
      }
    }

    if (skippedProfileFields > 0) {
      const skipMessage = `Skipped ${skippedProfileFields} reference field(s) that only reference 'profile'`;
      await customLogger(projectId, destination_stack_id, 'info', skipMessage);
    }

    if (fieldData.length === 0) {
      throw new Error('No field configuration found in Drupal database');
    }

    const fieldMessage = `Found ${fieldData.length} field configurations in database (profile fields filtered out)`;
    await customLogger(projectId, destination_stack_id, 'info', fieldMessage);

    // Generate queries based on field data
    const queryConfig = await generateQueriesForFields(
      connection,
      fieldData,
      projectId,
      destination_stack_id
    );

    // Write query configuration to file
    await fs.promises.writeFile(
      queryPath,
      JSON.stringify(queryConfig, null, 4),
      'utf8'
    );

    const successMessage = `Successfully generated and saved dynamic queries to: ${queryPath}`;
    await customLogger(projectId, destination_stack_id, 'info', successMessage);
  } catch (error: any) {
    const errorMessage = `Failed to generate dynamic queries: ${error.message}`;
    await customLogger(projectId, destination_stack_id, 'error', errorMessage);

    console.error('❌ Error generating dynamic queries:', error);
    throw new Error(
      `Failed to connect to database or generate queries: ${error.message}`
    );
  } finally {
    // Always close the connection when done
    if (connection) {
      try {
        connection.end();
      } catch (err: any) {
        console.warn('Connection was already closed:', err.message);
      }
    }
  }
};
