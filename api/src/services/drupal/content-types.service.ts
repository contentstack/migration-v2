import fs from 'fs';
import path from 'path';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { convertToSchemaFormate } from '../../utils/content-type-creator.utils.js';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';

const { DATA, CONTENT_TYPES_DIR_NAME } = MIGRATION_DATA_CONFIG;

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

    for (const schemaFile of schemaFiles) {
      try {
        const uploadApiSchemaFilePath = path.join(
          uploadApiSchemaPath,
          schemaFile
        );
        const uploadApiSchema = JSON.parse(
          fs.readFileSync(uploadApiSchemaFilePath, 'utf8')
        );

        // Convert upload-api schema to API format
        const apiSchema = convertUploadApiSchemaToApiSchema(uploadApiSchema);

        // Write API schema file
        const apiSchemaFilePath = path.join(apiContentTypesPath, schemaFile);
        await fs.promises.writeFile(
          apiSchemaFilePath,
          JSON.stringify(apiSchema, null, 2),
          'utf8'
        );

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

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully generated ${schemaFiles.length} content type schemas from upload-api`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);

    console.log(
      `🎉 Successfully converted ${schemaFiles.length} content type schemas`
    );
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
 */
function convertUploadApiSchemaToApiSchema(uploadApiSchema: any): any {
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
      // Map upload-api field to API format using convertToSchemaFormate
      const apiField = convertToSchemaFormate({
        field: {
          title: uploadField.contentstackField || uploadField.otherCmsField,
          uid: uploadField.contentstackFieldUid,
          contentstackFieldType: uploadField.contentstackFieldType,
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
          refrenceTo:
            uploadField.advanced?.reference_to ||
            uploadField.advanced?.embedObjects ||
            [],
          // For taxonomy fields, preserve taxonomies from upload-api
          taxonomies: uploadField.advanced?.taxonomies || [],
        },
        advanced: true,
      });

      if (apiField) {
        // Preserve additional metadata from upload-api
        if (
          uploadField.contentstackFieldType === 'reference' &&
          uploadField.advanced?.reference_to
        ) {
          apiField.reference_to = uploadField.advanced.reference_to;
        }

        if (
          uploadField.contentstackFieldType === 'taxonomy' &&
          uploadField.advanced?.taxonomies
        ) {
          apiField.taxonomies = uploadField.advanced.taxonomies;
        }

        // Preserve field metadata for proper field type conversion
        if (uploadField.advanced?.multiline !== undefined) {
          apiField.field_metadata = apiField.field_metadata || {};
          apiField.field_metadata.multiline = uploadField.advanced.multiline;
        }

        apiSchema.schema.push(apiField);
      }
    } catch (error: any) {
      console.warn(
        `Failed to convert field ${uploadField.uid}:`,
        error.message
      );

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
