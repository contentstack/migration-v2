import mysql from 'mysql2';
import { getDbConnection } from '../../helper/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { getLogMessage } from '../../utils/index.js';
// Dynamic import for phpUnserialize will be used in the function

interface FieldInfo {
  field_name: string;
  content_types: string;
  field_type: string;
  content_handler?: string;
  target_type?: string;
  handler_settings?: any;
}

export interface TaxonomyFieldMapping {
  [contentType: string]: {
    [fieldName: string]: {
      vocabulary?: string;
      handler: string;
      field_type: string;
    };
  };
}

export interface ReferenceFieldMapping {
  [contentType: string]: {
    [fieldName: string]: {
      target_type: string;
      handler: string;
      field_type: string;
    };
  };
}

export interface AssetFieldMapping {
  [contentType: string]: {
    [fieldName: string]: {
      field_type: string;
      file_extensions?: string[];
      upload_location?: string;
      max_filesize?: string;
    };
  };
}

/**
 * List of dangerous property names that could lead to prototype pollution
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates that a key is safe to use as an object property
 * Prevents prototype pollution attacks
 */
const isSafeKey = (key: string): boolean => {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    !DANGEROUS_KEYS.has(key) &&
    !key.includes('__proto__') &&
    !key.includes('constructor') &&
    !key.includes('prototype')
  );
};

/**
 * Creates a null-prototype object to prevent prototype pollution
 */
const createSafeMapping = <T>(): Record<string, T> => {
  return Object.create(null) as Record<string, T>;
};

/**
 * Safely sets a value in a mapping object with prototype pollution protection
 */
const safeSetMapping = <T>(
  mapping: Record<string, Record<string, T>>,
  contentType: string,
  fieldName: string,
  value: T
): boolean => {
  if (!isSafeKey(contentType) || !isSafeKey(fieldName)) {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(mapping, contentType)) {
    mapping[contentType] = createSafeMapping<T>();
  }
  mapping[contentType][fieldName] = value;
  return true;
};

/**
 * Execute SQL query with promise support
 */
const executeQuery = async (
  connection: mysql.Connection,
  query: string
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results as any[]);
    });
  });
};

/**
 * Analyze field configuration to identify taxonomy and reference fields
 * Based on the original query.js logic that checks content_handler
 */
export const analyzeFieldTypes = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string
): Promise<{
  taxonomyFields: TaxonomyFieldMapping;
  referenceFields: ReferenceFieldMapping;
  assetFields: AssetFieldMapping;
}> => {
  const srcFunc = 'analyzeFieldTypes';
  let connection: mysql.Connection | null = null;

  try {
    const message = getLogMessage(
      srcFunc,
      `Analyzing field types to identify taxonomy fields...`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Create database connection
    connection = await getDbConnection(
      dbConfig,
      projectId,
      destination_stack_id
    );

    // Query to get field configurations (same as original ct_mapped query)
    const fieldConfigQuery = `
      SELECT *, CONVERT(data USING utf8) as data 
      FROM config 
      WHERE name LIKE '%field.field.node%'
    `;

    const fieldConfigs = await executeQuery(connection, fieldConfigQuery);

    // Use null-prototype objects to prevent prototype pollution
    const taxonomyFieldMapping: TaxonomyFieldMapping = createSafeMapping();
    const referenceFieldMapping: ReferenceFieldMapping = createSafeMapping();
    const assetFieldMapping: AssetFieldMapping = createSafeMapping();
    let taxonomyFieldCount = 0;
    let referenceFieldCount = 0;
    let assetFieldCount = 0;
    let totalFieldCount = 0;

    for (const fieldConfig of fieldConfigs) {
      try {
        // Unserialize the PHP data to get field details
        const { unserialize } = await import('php-serialize');
        const fieldData = unserialize(fieldConfig.data);

        if (fieldData && fieldData.field_name && fieldData.bundle) {
          totalFieldCount++;

          const fieldInfo: FieldInfo = {
            field_name: fieldData.field_name,
            content_types: fieldData.bundle,
            field_type: fieldData.field_type || 'unknown',
            content_handler: fieldData?.settings?.handler,
            target_type: fieldData?.settings?.target_type,
            handler_settings: fieldData?.settings?.handler_settings,
          };

          // Validate keys to prevent prototype pollution
          if (
            !isSafeKey(fieldInfo.content_types) ||
            !isSafeKey(fieldInfo.field_name)
          ) {
            const warnMessage = getLogMessage(
              srcFunc,
              `Skipping field with unsafe key: ${fieldInfo.content_types}.${fieldInfo.field_name}`,
              {}
            );
            await customLogger(
              projectId,
              destination_stack_id,
              'warn',
              warnMessage
            );
            continue;
          }

          // Initialize content type mappings if not exists (using safe null-prototype objects)
          if (
            !Object.prototype.hasOwnProperty.call(
              taxonomyFieldMapping,
              fieldInfo.content_types
            )
          ) {
            taxonomyFieldMapping[fieldInfo.content_types] = createSafeMapping();
          }
          if (
            !Object.prototype.hasOwnProperty.call(
              referenceFieldMapping,
              fieldInfo.content_types
            )
          ) {
            referenceFieldMapping[fieldInfo.content_types] =
              createSafeMapping();
          }
          if (
            !Object.prototype.hasOwnProperty.call(
              assetFieldMapping,
              fieldInfo.content_types
            )
          ) {
            assetFieldMapping[fieldInfo.content_types] = createSafeMapping();
          }

          // Check if this is a taxonomy reference field
          const isTaxonomyField =
            // Check handler for taxonomy references
            (fieldInfo.content_handler &&
              fieldInfo.content_handler.includes('taxonomy_term')) ||
            // Check target_type for entity references to taxonomy terms
            fieldInfo.target_type === 'taxonomy_term' ||
            // Check field type for direct taxonomy reference fields
            (fieldInfo.field_type === 'entity_reference' &&
              fieldInfo.target_type === 'taxonomy_term') ||
            fieldInfo.field_type === 'taxonomy_term_reference' ||
            // Check handler settings for vocabulary restrictions (taxonomy specific)
            (fieldInfo.handler_settings?.target_bundles &&
              Object.keys(fieldInfo.handler_settings.target_bundles).some(
                (bundle) => fieldInfo.target_type === 'taxonomy_term'
              ));

          // Check if this is a node reference field (non-taxonomy entity reference)
          const isReferenceField =
            // Check for entity_reference field type
            (fieldInfo.field_type === 'entity_reference' &&
              // Check handler for node references
              fieldInfo.content_handler &&
              fieldInfo.content_handler.includes('node')) ||
            // Check target_type for entity references to nodes
            (fieldInfo.target_type === 'node' &&
              // Make sure it's NOT a taxonomy field
              !isTaxonomyField);

          if (isTaxonomyField) {
            taxonomyFieldCount++;

            // Try to determine the vocabulary from handler settings
            let vocabulary = 'unknown';
            if (fieldInfo.handler_settings?.target_bundles) {
              const vocabularies = Object.keys(
                fieldInfo.handler_settings.target_bundles
              );
              vocabulary =
                vocabularies.length === 1
                  ? vocabularies[0]
                  : vocabularies.join(',');
            }

            // Use safe setter to prevent prototype pollution
            safeSetMapping(
              taxonomyFieldMapping,
              fieldInfo.content_types,
              fieldInfo.field_name,
              {
                vocabulary,
                handler: fieldInfo.content_handler || 'default:taxonomy_term',
                field_type: fieldInfo.field_type,
              }
            );

            const taxonomyMessage = getLogMessage(
              srcFunc,
              `Found taxonomy field: ${fieldInfo.content_types}.${fieldInfo.field_name} → vocabulary: ${vocabulary}`,
              {}
            );
            await customLogger(
              projectId,
              destination_stack_id,
              'info',
              taxonomyMessage
            );
          } else if (isReferenceField) {
            referenceFieldCount++;

            // Use safe setter to prevent prototype pollution
            safeSetMapping(
              referenceFieldMapping,
              fieldInfo.content_types,
              fieldInfo.field_name,
              {
                target_type: fieldInfo.target_type || 'node',
                handler: fieldInfo.content_handler || 'default:node',
                field_type: fieldInfo.field_type,
              }
            );

            const referenceMessage = getLogMessage(
              srcFunc,
              `Found reference field: ${fieldInfo.content_types}.${
                fieldInfo.field_name
              } → target_type: ${fieldInfo.target_type || 'node'}`,
              {}
            );
            await customLogger(
              projectId,
              destination_stack_id,
              'info',
              referenceMessage
            );
          }

          // Check if this is an asset/file field
          const isAssetField =
            // Check for file field type
            fieldInfo.field_type === 'file' ||
            // Check for image field type
            fieldInfo.field_type === 'image' ||
            // Check for managed_file field type
            fieldInfo.field_type === 'managed_file' ||
            // Check for entity_reference to file entities
            (fieldInfo.field_type === 'entity_reference' &&
              fieldInfo.target_type === 'file');

          if (isAssetField) {
            assetFieldCount++;

            // Extract file-related settings
            const fileExtensions = fieldData?.settings?.file_extensions
              ? fieldData.settings.file_extensions.split(' ')
              : [];
            const uploadLocation =
              fieldData?.settings?.file_directory ||
              fieldData?.settings?.uri_scheme ||
              'public://';
            const maxFilesize =
              fieldData?.settings?.max_filesize ||
              fieldData?.settings?.file_size ||
              '';

            // Use safe setter to prevent prototype pollution
            safeSetMapping(
              assetFieldMapping,
              fieldInfo.content_types,
              fieldInfo.field_name,
              {
                field_type: fieldInfo.field_type,
                file_extensions: fileExtensions,
                upload_location: uploadLocation,
                max_filesize: maxFilesize,
              }
            );

            const assetMessage = getLogMessage(
              srcFunc,
              `Found asset field: ${fieldInfo.content_types}.${
                fieldInfo.field_name
              } → type: ${
                fieldInfo.field_type
              }, extensions: [${fileExtensions.join(', ')}]`,
              {}
            );
            await customLogger(
              projectId,
              destination_stack_id,
              'info',
              assetMessage
            );
          }
        }
      } catch (parseError: any) {
        // Log parsing error but continue with other fields
        const parseMessage = getLogMessage(
          srcFunc,
          `Could not parse field config: ${parseError.message}`,
          {},
          parseError
        );
        await customLogger(
          projectId,
          destination_stack_id,
          'warn',
          parseMessage
        );
      }
    }

    const summaryMessage = getLogMessage(
      srcFunc,
      `Field analysis complete: ${taxonomyFieldCount} taxonomy fields, ${referenceFieldCount} reference fields, and ${assetFieldCount} asset fields found out of ${totalFieldCount} total fields.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', summaryMessage);

    return {
      taxonomyFields: taxonomyFieldMapping,
      referenceFields: referenceFieldMapping,
      assetFields: assetFieldMapping,
    };
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error analyzing field types: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  } finally {
    if (connection) {
      connection.end();
    }
  }
};

/**
 * Check if a specific field is a taxonomy field
 */
export const isTaxonomyField = (
  fieldName: string,
  contentType: string,
  taxonomyMapping: TaxonomyFieldMapping
): boolean => {
  return !!(
    taxonomyMapping[contentType] && taxonomyMapping[contentType][fieldName]
  );
};

/**
 * Check if a specific field is a reference field
 */
export const isReferenceField = (
  fieldName: string,
  contentType: string,
  referenceMapping: ReferenceFieldMapping
): boolean => {
  return !!(
    referenceMapping[contentType] && referenceMapping[contentType][fieldName]
  );
};

/**
 * Check if a specific field is an asset field
 */
export const isAssetField = (
  fieldName: string,
  contentType: string,
  assetMapping: AssetFieldMapping
): boolean => {
  return !!(assetMapping[contentType] && assetMapping[contentType][fieldName]);
};

/**
 * Get taxonomy field information
 */
export const getTaxonomyFieldInfo = (
  fieldName: string,
  contentType: string,
  taxonomyMapping: TaxonomyFieldMapping
) => {
  return taxonomyMapping[contentType]?.[fieldName] || null;
};

/**
 * Get reference field information
 */
export const getReferenceFieldInfo = (
  fieldName: string,
  contentType: string,
  referenceMapping: ReferenceFieldMapping
) => {
  return referenceMapping[contentType]?.[fieldName] || null;
};

/**
 * Get asset field information
 */
export const getAssetFieldInfo = (
  fieldName: string,
  contentType: string,
  assetMapping: AssetFieldMapping
) => {
  return assetMapping[contentType]?.[fieldName] || null;
};

/**
 * Transform taxonomy field value to Contentstack format
 * Converts tid to taxonomy term uid based on our taxonomy data
 *
 * The taxonomyData should contain individual vocabulary files:
 * - taxonomies/list.json
 * - taxonomies/news.json
 * etc.
 */
export const transformTaxonomyValue = async (
  value: any,
  fieldName: string,
  contentType: string,
  taxonomyMapping: TaxonomyFieldMapping,
  taxonomyBasePath: string
): Promise<any> => {
  const fieldInfo = getTaxonomyFieldInfo(
    fieldName,
    contentType,
    taxonomyMapping
  );

  if (!fieldInfo || !value) {
    return value;
  }

  // If it's a taxonomy field with tid value, try to find the corresponding term
  if (
    typeof value === 'number' ||
    (typeof value === 'string' && /^\d+$/.test(value))
  ) {
    const tid = parseInt(value.toString());

    try {
      // Try to determine which vocabulary to look in based on field info
      const vocabularies = fieldInfo.vocabulary
        ? fieldInfo.vocabulary.split(',')
        : ['unknown'];

      for (const vocabulary of vocabularies) {
        try {
          const fs = await import('fs');
          const path = await import('path');

          const taxonomyFilePath = path.join(
            taxonomyBasePath,
            `${vocabulary}.json`
          );

          if (fs.existsSync(taxonomyFilePath)) {
            const taxonomyContent = JSON.parse(
              fs.readFileSync(taxonomyFilePath, 'utf8')
            );

            if (taxonomyContent.terms && Array.isArray(taxonomyContent.terms)) {
              for (const term of taxonomyContent.terms) {
                if (term.drupal_term_id === tid) {
                  return term.uid;
                }
              }
            }
          }
        } catch (vocabError) {
          // Continue to next vocabulary if this one fails
          continue;
        }
      }

      // If we couldn't find it in specific vocabularies, try all taxonomy files
      const fs = await import('fs');
      const path = await import('path');

      if (fs.existsSync(taxonomyBasePath)) {
        const taxonomyFiles = fs
          .readdirSync(taxonomyBasePath)
          .filter(
            (file) => file.endsWith('.json') && file !== 'taxonomies.json'
          );

        for (const file of taxonomyFiles) {
          try {
            const taxonomyContent = JSON.parse(
              fs.readFileSync(path.join(taxonomyBasePath, file), 'utf8')
            );

            if (taxonomyContent.terms && Array.isArray(taxonomyContent.terms)) {
              for (const term of taxonomyContent.terms) {
                if (term.drupal_term_id === tid) {
                  return term.uid;
                }
              }
            }
          } catch (fileError) {
            // Continue to next file if this one fails
            continue;
          }
        }
      }
    } catch (error) {
      // Return original value if transformation fails
      return value;
    }
  }

  return value;
};
