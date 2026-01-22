import fs from 'fs';
import path from 'path';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { convertToSchemaFormate } from '../../utils/content-type-creator.utils.js';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import FieldMapperModel from '../../models/FieldMapper.js';
import ContentTypesMapperModelLowdb from '../../models/contentTypesMapper-lowdb.js';

const { DATA, CONTENT_TYPES_DIR_NAME, CONTENT_TYPES_SCHEMA_FILE } =
  MIGRATION_DATA_CONFIG;

/**
 * Generates API content types from upload-api drupal schema
 * This service reads the upload-api generated schema and converts it to final API content types
 * following the same pattern as other CMS services (Contentful, WordPress, Sitecore)
 */
export const generateContentTypeSchemas = async (
  destination_stack_id: string,
  projectId: string
): Promise<void> => {
  const srcFunc = 'generateContentTypeSchemas';

  try {
    const message = getLogMessage(
      srcFunc,
      `Generating content type schemas from upload-api drupal schema...`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Path to upload-api generated schema
    const uploadApiSchemaPath = path.join(
      process.cwd(),
      '..',
      'upload-api',
      'drupalMigrationData',
      'drupalSchema'
    );

    // Path to API content types directory
    const apiContentTypesPath = path.join(
      DATA,
      destination_stack_id,
      CONTENT_TYPES_DIR_NAME
    );

    // Ensure API content types directory exists
    await fs.promises.mkdir(apiContentTypesPath, { recursive: true });

    if (!fs.existsSync(uploadApiSchemaPath)) {
      throw new Error(
        `Upload-API schema not found at: ${uploadApiSchemaPath}. Please run upload-api migration first.`
      );
    }

    // Read all schema files from upload-api
    const schemaFiles = fs
      .readdirSync(uploadApiSchemaPath)
      .filter((file) => file.endsWith('.json'));

    if (schemaFiles.length === 0) {
      throw new Error(
        `No schema files found in upload-api directory: ${uploadApiSchemaPath}`
      );
    }

    // Load saved field mappings from database to get UI selections
    await FieldMapperModel.read();
    await ContentTypesMapperModelLowdb.read();

    const savedFieldMappings = FieldMapperModel.data.field_mapper.filter(
      (field: any) => field && field.projectId === projectId
    );

    // Log fields with UI changes
    const fieldsWithTypeChanges = savedFieldMappings.filter(
      (field: any) =>
        field.contentstackFieldType &&
        field.backupFieldType !== field.contentstackFieldType
    );

    if (fieldsWithTypeChanges.length > 0) {
      fieldsWithTypeChanges.forEach((field: any) => {});
    }

    // Build complete schema array (NO individual files)
    const allApiSchemas = [];

    for (const schemaFile of schemaFiles) {
      try {
        const uploadApiSchemaFilePath = path.join(
          uploadApiSchemaPath,
          schemaFile
        );
        const uploadApiSchema = JSON.parse(
          fs.readFileSync(uploadApiSchemaFilePath, 'utf8')
        );

        // Convert upload-api schema to API format WITH saved field mappings from UI
        const apiSchema = convertUploadApiSchemaToApiSchema(
          uploadApiSchema,
          savedFieldMappings,
          projectId
        );

        // Add to combined schema array (NO individual files)
        allApiSchemas.push(apiSchema);

        const fieldMessage = getLogMessage(
          srcFunc,
          `Converted content type ${uploadApiSchema.uid} with ${
            uploadApiSchema.schema?.length || 0
          } fields`,
          {}
        );
        await customLogger(
          projectId,
          destination_stack_id,
          'info',
          fieldMessage
        );
      } catch (error: any) {
        const errorMessage = getLogMessage(
          srcFunc,
          `Failed to convert schema file ${schemaFile}: ${error.message}`,
          {},
          error
        );
        await customLogger(
          projectId,
          destination_stack_id,
          'error',
          errorMessage
        );
      }
    }

    // Write ONLY the combined schema.json file
    const combinedSchemaPath = path.join(
      apiContentTypesPath,
      CONTENT_TYPES_SCHEMA_FILE
    );
    await fs.promises.writeFile(
      combinedSchemaPath,
      JSON.stringify(allApiSchemas, null, 2),
      'utf8'
    );

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully generated ${schemaFiles.length} content type schemas from upload-api`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);
  } catch (error: any) {
    const errorMessage = getLogMessage(
      srcFunc,
      `Failed to generate content type schemas: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', errorMessage);
    throw error;
  }
};

/**
 * Converts upload-api drupal schema format to API content type format
 * This preserves the original field types and user selections from the upload-api
 * AND applies user's UI selections from Content Mapper for reference/taxonomy fields
 */
function convertUploadApiSchemaToApiSchema(
  uploadApiSchema: any,
  savedFieldMappings: any[] = [],
  projectId?: string
): any {
  const apiSchema = {
    title: uploadApiSchema.title,
    uid: uploadApiSchema.uid,
    schema: [] as any[],
  };

  if (!uploadApiSchema.schema || !Array.isArray(uploadApiSchema.schema)) {
    return apiSchema;
  }

  // Convert each field from upload-api format to API format
  for (const uploadField of uploadApiSchema.schema) {
    try {
      // Find saved field mapping from database FIRST to get user's field type selection
      const savedMapping = savedFieldMappings.find(
        (mapping: any) =>
          mapping.contentstackFieldUid === uploadField.contentstackFieldUid ||
          mapping.contentstackFieldUid === uploadField.uid ||
          mapping.uid === uploadField.contentstackFieldUid ||
          mapping.uid === uploadField.uid
      );

      // Use UI-selected field type if available, otherwise use upload-api type
      const fieldType =
        savedMapping?.contentstackFieldType ||
        uploadField.contentstackFieldType;

      // Map upload-api field to API format using convertToSchemaFormate
      const apiField = convertToSchemaFormate({
        field: {
          title: uploadField.contentstackField || uploadField.otherCmsField,
          uid: uploadField.contentstackFieldUid,
          contentstackFieldType: fieldType, // Use UI selection if available
          advanced: {
            ...uploadField.advanced,
            mandatory: uploadField.advanced?.mandatory || false,
            multiple: uploadField.advanced?.multiple || false,
            unique: uploadField.advanced?.unique || false,
            nonLocalizable: uploadField.advanced?.non_localizable || false,
            default_value: uploadField.advanced?.default_value || '',
            validationRegex: uploadField.advanced?.format || '',
            validationErrorMessage: uploadField.advanced?.error_message || '',
          },
          // For reference fields, preserve reference_to from upload-api
          referenceTo:
            uploadField.advanced?.reference_to ||
            uploadField.advanced?.embedObjects ||
            [],
          // For taxonomy fields, preserve taxonomies from upload-api
          taxonomies: uploadField.advanced?.taxonomies || [],
        },
        advanced: true,
      });

      if (apiField) {
        // Use UI selections if available, otherwise fall back to upload-api data
        // Check against the FINAL field type (which may have been changed in UI)
        if (fieldType === 'reference') {
          if (
            savedMapping?.referenceTo &&
            Array.isArray(savedMapping.referenceTo) &&
            savedMapping.referenceTo.length > 0
          ) {
            // MERGE: Combine old upload-api data with new UI selections (no duplicates)
            // Check both embedObjects AND reference_to
            const oldReferences =
              uploadField.advanced?.embedObjects ||
              uploadField.advanced?.reference_to ||
              [];
            const newReferences = savedMapping.referenceTo || [];
            const mergedReferences = [
              ...new Set([...oldReferences, ...newReferences]),
            ].filter((ref) => ref && ref.toLowerCase() !== 'profile'); // Filter out profile

            apiField.reference_to = mergedReferences;
          } else {
            // Fall back to upload-api data only (check both embedObjects and reference_to)
            const fallbackReferences = (
              uploadField.advanced?.embedObjects ||
              uploadField.advanced?.reference_to ||
              []
            ).filter((ref: string) => ref && ref.toLowerCase() !== 'profile'); // Filter out profile

            if (fallbackReferences && fallbackReferences.length > 0) {
              apiField.reference_to = fallbackReferences;
            }
          }
        }

        if (fieldType === 'taxonomy') {
          if (
            savedMapping?.referenceTo &&
            Array.isArray(savedMapping.referenceTo) &&
            savedMapping.referenceTo.length > 0
          ) {
            // MERGE: Combine old upload-api taxonomies with new UI selections (no duplicates)
            const oldTaxonomyUIDs = (
              uploadField.advanced?.taxonomies || []
            ).map((t: any) => t.taxonomy_uid || t);
            const newTaxonomyUIDs = savedMapping.referenceTo || [];
            const mergedTaxonomyUIDs = [
              ...new Set([...oldTaxonomyUIDs, ...newTaxonomyUIDs]),
            ];

            // Convert UIDs to taxonomy format
            apiField.taxonomies = mergedTaxonomyUIDs.map((taxUid: string) => ({
              taxonomy_uid: taxUid,
              mandatory: uploadField.advanced?.mandatory || false,
              multiple: uploadField.advanced?.multiple !== false, // Default to true for taxonomies
              non_localizable: uploadField.advanced?.non_localizable || false,
            }));
          } else if (uploadField.advanced?.taxonomies) {
            // Fall back to upload-api data only
            apiField.taxonomies = uploadField.advanced.taxonomies;
          }
        }

        // Preserve field metadata for proper field type conversion
        if (uploadField.advanced?.multiline !== undefined) {
          apiField.field_metadata = apiField.field_metadata || {};
          apiField.field_metadata.multiline = uploadField.advanced.multiline;
        }

        apiSchema.schema.push(apiField);
      }
    } catch (error: any) {
      // Fallback: create basic field structure
      apiSchema.schema.push({
        display_name:
          uploadField.contentstackField ||
          uploadField.otherCmsField ||
          uploadField.uid,
        uid: uploadField.contentstackFieldUid || uploadField.uid,
        data_type: mapFieldTypeToDataType(uploadField.contentstackFieldType),
        mandatory: uploadField.advanced?.mandatory || false,
        unique: uploadField.advanced?.unique || false,
        field_metadata: { _default: true },
        format: '',
        error_messages: { format: '' },
        multiple: uploadField.advanced?.multiple || false,
        non_localizable: uploadField.advanced?.non_localizable || false,
      });
    }
  }

  return apiSchema;
}

/**
 * Maps upload-api field types to API data types
 * This ensures proper field type preservation from upload-api to API
 */
function mapFieldTypeToDataType(fieldType: string): string {
  const fieldTypeMap: { [key: string]: string } = {
    single_line_text: 'text',
    multi_line_text: 'text',
    text: 'text',
    html: 'html',
    json: 'json',
    markdown: 'text',
    number: 'number',
    boolean: 'boolean',
    isodate: 'isodate',
    file: 'file',
    reference: 'reference',
    taxonomy: 'taxonomy',
    link: 'link',
    dropdown: 'text',
    radio: 'text',
    checkbox: 'boolean',
    global_field: 'global_field',
    group: 'group',
    url: 'text',
  };

  return fieldTypeMap[fieldType] || 'text';
}

// Removed regenerateCombinedSchemaFromIndividualFiles function
// We now generate ONLY schema.json directly, no individual files
