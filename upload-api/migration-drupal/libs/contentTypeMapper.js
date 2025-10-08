/* eslint-disable @typescript-eslint/no-var-requires */

const restrictedUid = require('../utils/restrictedKeyWords');
const fs = require('fs');
const path = require('path');

/**
 * Loads taxonomy schema from drupalMigrationData/taxonomySchema/taxonomySchema.json
 * If not found, attempts to generate it using extractTaxonomy
 *
 * @param {Object} dbConfig - Database configuration for fallback taxonomy extraction
 * @returns {Array} Array of taxonomy vocabularies with uid and name
 */
const loadTaxonomySchema = async (dbConfig = null) => {
  try {
    const taxonomySchemaPath = path.join(
      __dirname,
      '..',
      '..',
      'drupalMigrationData',
      'taxonomySchema',
      'taxonomySchema.json'
    );

    // Check if taxonomy schema exists
    if (fs.existsSync(taxonomySchemaPath)) {
      const taxonomyData = fs.readFileSync(taxonomySchemaPath, 'utf8');
      const taxonomies = JSON.parse(taxonomyData);
      return taxonomies;
    }

    // If not found and dbConfig available, try to generate it
    if (dbConfig) {
      const extractTaxonomy = require('./extractTaxonomy');
      const taxonomies = await extractTaxonomy(dbConfig);
      return taxonomies;
    }

    return [];
  } catch (error) {
    console.error('❌ Error loading taxonomy schema:', error.message);
    return [];
  }
};

// Load restricted keywords
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
 * Extracts advanced field configurations from a Drupal field item.
 *
 * @param {Object} item - The Drupal field item containing properties like `default_value`, `description`, etc.
 * @param {Array} [referenceFields=[]] - Optional array of reference field names to associate with the field.
 * @returns {Object} An object containing advanced field configurations, such as default value, validation rules, mandatory status, and more.
 *
 * @description
 * This function extracts advanced configuration details for a Drupal field from the provided `item`. It gathers
 * various settings like default values, mandatory status, localization settings, and description (with a maximum length of 255 characters).
 *
 * The result is an object that includes all these advanced properties, which can be used to configure fields in Contentstack.
 *
 * // Outputs an object with the advanced field configurations, including default value, mandatory, and more.
 */
const extractAdvancedFields = (item, referenceFields = []) => {
  let description = item?.description || '';
  if (description.length > 255) {
    description = description.slice(0, 255);
  }

  return {
    default_value: item?.default_value || null,
    mandatory: item?.required || false,
    multiple: item?.max > 1 || item?.cardinality === -1 || false,
    unique: false,
    nonLocalizable: false,
    validationErrorMessage: '',
    embedObjects: referenceFields.length
      ? referenceFields
      : referenceFields.length === 0 && Array.isArray(referenceFields)
        ? []
        : undefined,
    description: description
  };
};

/**
 * Creates a field object for a content type, including both the main and backup field configurations.
 *
 * @param {Object} item - The Drupal field item that contains properties like `field_name`, `field_label`, and `type`.
 * @param {string} contentstackFieldType - The type of field for Contentstack (e.g., 'text', 'json').
 * @param {string} backupFieldType - The type of backup field (e.g., 'text', 'json').
 * @param {Array} [referenceFields=[]] - Optional array of reference field names to associate with the field.
 * @returns {Object} A field object that includes the UID, CMS field names, field types, and advanced configurations.
 *
 * @description
 * This function generates a field object to be used in the context of a content management system (CMS),
 * specifically for fields that have both a primary and backup configuration. It extracts the necessary field
 * details from the provided `item` and augments it with additional information such as UID, field names, and field types.
 *
 * The advanced field properties are extracted using the `extractAdvancedFields` function, including any reference fields,
 * field types, and other metadata related to the field configuration.
 *
 * // Outputs an object containing the field configuration for Contentstack and backup fields
 */
const createFieldObject = (item, contentstackFieldType, backupFieldType, referenceFields = []) => {
  // Add suffix for specific field types (following old migration pattern)
  const needsSuffix = ['reference', 'file'].includes(contentstackFieldType);
  const fieldNameWithSuffix = needsSuffix ? `${item?.field_name}_target_id` : item?.field_name;

  // 🚫 For json and html fields, always use empty embedObjects array
  const shouldUseEmptyEmbedObjects = ['json', 'html'].includes(contentstackFieldType);
  const finalReferenceFields = shouldUseEmptyEmbedObjects ? [] : referenceFields;

  return {
    uid: item?.field_name,
    otherCmsField: item?.field_label,
    otherCmsType: item?.type,
    contentstackField: item?.field_label,
    contentstackFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    contentstackFieldType: contentstackFieldType,
    backupFieldType: backupFieldType,
    backupFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    advanced: extractAdvancedFields(item, finalReferenceFields)
  };
};

/**
 * Creates a field object for boolean field types with proper display_type.
 *
 * @param {Object} item - The Drupal field item that includes field details like `type`, `widget`, etc.
 * @returns {Object} A field object that includes the field configuration for boolean fields.
 */
const createBooleanFieldObject = (item) => {
  const fieldNameWithSuffix = item?.field_name;
  const advancedFields = extractAdvancedFields(item);

  // Determine display type based on widget
  let displayType;
  const widgetType = item.widget?.type || item.widget;

  if (widgetType === 'boolean_checkbox') {
    displayType = 'checkbox';
  }
  // Add other boolean widget types as needed

  return {
    uid: item?.field_name,
    otherCmsField: item?.field_label,
    otherCmsType: item?.type,
    contentstackField: item?.field_label,
    contentstackFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    contentstackFieldType: 'boolean',
    backupFieldType: 'boolean',
    backupFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    advanced: {
      ...advancedFields,
      data_type: 'boolean',
      display_type: displayType,
      field_metadata: {
        description: advancedFields?.description || '',
        default_value: false
      }
    }
  };
};

/**
 * Creates a field object for dropdown, radio, or checkbox field types following CSV scenarios.
 * Maps Drupal field configurations to Contentstack format based on widget and cardinality.
 *
 * @param {Object} item - The Drupal field item that includes field details like `type`, `widget`, etc.
 * @param {string} baseFieldType - The base field type ('dropdown', 'radio', 'checkbox').
 * @param {string} dataType - The data type ('text' for list_string, 'number' for list_integer/list_float).
 * @returns {Object} A field object that includes the field configuration and validation options.
 *
 * @description
 * This function generates a field object for list field types based on CSV scenarios:
 * - Dropdown (options_select) → display_type: "dropdown", multiple: false
 * - Radio (options_buttons + cardinality=1) → display_type: "radio", multiple: false
 * - Checkboxes (options_buttons + cardinality=-1) → display_type: "checkbox", multiple: true
 */
const createDropdownOrRadioFieldObject = (
  item,
  baseFieldType,
  dataType = 'text',
  numericType = null
) => {
  // Determine display type and multiple based on CSV scenarios
  let displayType = 'dropdown';
  let multiple = false;

  // Map based on CSV scenarios from drupal_field_mapping.csv
  const widgetType = item.widget?.type || item.widget;
  if (widgetType) {
    switch (widgetType) {
      case 'options_select':
        // Dropdown scenario
        displayType = 'dropdown';
        multiple = false;
        break;
      case 'options_buttons':
        // Radio or Checkbox based on cardinality
        if (item.cardinality === -1 || item.max === -1 || item.max > 1) {
          // Checkboxes (cardinality=-1)
          displayType = 'checkbox';
          multiple = true;
        } else {
          // Radio buttons (cardinality=1)
          displayType = 'radio';
          multiple = false;
        }
        break;
      default:
        // Fallback to dropdown
        displayType = 'dropdown';
        multiple = false;
    }
  } else {
    // Fallback based on field configuration
    displayType = baseFieldType;
    multiple = item.max > 1 || item.cardinality === -1;
  }

  const fieldNameWithSuffix = item?.field_name;
  const advancedFields = extractAdvancedFields(item);

  // Extract actual choices from field settings (allowed_values)
  let actualChoices = [];

  if (item.settings && item.settings.allowed_values) {
    // Convert allowed_values object to choices array
    // Drupal format: { stored_key: display_label } -> Contentstack format: [{ value: display_label, key: stored_key }]
    actualChoices = Object.entries(item.settings.allowed_values).map(([key, value]) => {
      let processedKey = key;

      // For numeric fields, ensure the key (stored value) is properly typed
      if (dataType === 'number') {
        if (numericType === 'float') {
          // For float fields, preserve decimal precision in the key
          processedKey = isNaN(key) ? key : parseFloat(key);
        } else if (numericType === 'integer') {
          // For integer fields, convert key to integer
          processedKey = isNaN(key) ? key : parseInt(key, 10);
        } else {
          // Default number handling for key
          processedKey = isNaN(key) ? key : Number(key);
        }
      }

      return {
        value: value, // Display label (e.g., "1.5 Stars", "$10.50")
        key: processedKey // Stored value (e.g., 1.5, 10.50)
      };
    });
  } else {
    // Fallback: generate minimal choices if no allowed_values found
    if (dataType === 'number') {
      if (numericType === 'float') {
        actualChoices = [
          { value: 1.0, key: 'option_1' },
          { value: 2.0, key: 'option_2' }
        ];
      } else {
        actualChoices = [
          { value: 1, key: 'option_1' },
          { value: 2, key: 'option_2' }
        ];
      }
    } else {
      actualChoices = [
        { value: 'Option 1', key: 'option_1' },
        { value: 'Option 2', key: 'option_2' }
      ];
    }
  }

  return {
    uid: item?.field_name,
    otherCmsField: item?.field_label,
    otherCmsType: item?.type,
    contentstackField: item?.field_label,
    contentstackFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    contentstackFieldType: baseFieldType,
    backupFieldType: baseFieldType,
    backupFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    advanced: {
      ...advancedFields,
      data_type: dataType,
      display_type: displayType,
      multiple: multiple,
      enum: {
        advanced: true,
        choices: actualChoices
      },
      field_metadata: {
        description: advancedFields?.description || '',
        default_value: '',
        default_key: ''
      }
    }
  };
};

/**
 * Creates a date range field object with specialized structure for Contentstack
 *
 * @param {Object} item - The Drupal field item containing field details
 * @returns {Object} A date range field object with date_range: true metadata
 */
const createDateRangeFieldObject = (item) => {
  const fieldNameWithSuffix = item?.field_name;
  const advancedFields = extractAdvancedFields(item);

  return {
    uid: item?.field_name,
    otherCmsField: item?.field_label,
    otherCmsType: item?.type,
    contentstackField: item?.field_label,
    contentstackFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    contentstackFieldType: 'isodate',
    backupFieldType: 'isodate',
    backupFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    advanced: {
      ...advancedFields,
      date_range: true, // This enables start/end date functionality
      description: advancedFields?.description || '',
      default_value: {}
    }
  };
};

/**
 * Creates a taxonomy field object with specialized structure for Contentstack
 *
 * @param {Object} item - The Drupal field item containing field details
 * @param {Array} taxonomySchema - Array of taxonomy vocabularies from taxonomySchema.json
 * @param {Array} targetVocabularies - Optional array of specific vocabularies this field references
 * @returns {Object} A taxonomy field object with the required structure
 */
const createTaxonomyFieldObject = (item, taxonomySchema, targetVocabularies = []) => {
  // Determine which taxonomies to include
  let taxonomiesToInclude = [];

  if (targetVocabularies && targetVocabularies.length > 0) {
    // If specific vocabularies are provided, use only those
    taxonomiesToInclude = taxonomySchema.filter(
      (taxonomy) =>
        targetVocabularies.includes(taxonomy.uid) || targetVocabularies.includes(taxonomy.name)
    );
  } else {
    // If no specific vocabularies, include all available taxonomies
    taxonomiesToInclude = taxonomySchema;
  }

  // Build taxonomies array with default properties
  const taxonomiesArray = taxonomiesToInclude.map((taxonomy) => ({
    taxonomy_uid: taxonomy.uid,
    mandatory: false,
    multiple: true,
    non_localizable: false
  }));

  // Get advanced field properties from the original field
  const advancedFields = extractAdvancedFields(item);

  // Add _target_id suffix for taxonomy fields (following old migration pattern)
  const fieldNameWithSuffix = `${item?.field_name}_target_id`;

  return {
    uid: item?.field_name,
    otherCmsField: item?.field_label,
    otherCmsType: item?.type,
    contentstackField: item?.field_label,
    contentstackFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    contentstackFieldType: 'taxonomy',
    backupFieldType: 'reference',
    backupFieldUid: uidCorrector(fieldNameWithSuffix, item?.prefix),
    advanced: {
      data_type: 'taxonomy',
      display_name: item?.field_label || item?.field_name,
      uid: uidCorrector(fieldNameWithSuffix, item?.prefix),
      taxonomies: taxonomiesArray,
      field_metadata: {
        description: advancedFields?.field_metadata?.description || '',
        default_value: advancedFields?.field_metadata?.default_value || ''
      },
      format: '',
      error_messages: { format: '' },
      mandatory: advancedFields?.mandatory || false,
      multiple: advancedFields?.multiple !== undefined ? advancedFields?.multiple : true,
      non_localizable: advancedFields?.non_localizable || false,
      unique: advancedFields?.unique || false
    }
  };
};

/**
 * Maps a collection of Drupal content type items to a schema array with specific field types and properties.
 *
 * @param {Array} data - An array of Drupal field items, each containing metadata like type, field_name, field_label, etc.
 * @param {Array} contentTypes - Array of available content types for reference resolution.
 * @param {string} prefix - The prefix to be used for UID correction.
 * @param {Object} dbConfig - Database configuration for taxonomy extraction fallback.
 * @returns {Promise<Array>} A schema array with field objects and corresponding properties based on the Drupal field item.
 *
 * @description
 * This function processes each Drupal field item from the input data and maps them to a specific schema structure.
 * It handles various Drupal field types and maps them to Contentstack field types with the following adaptations:
 *
 * Field Type Mappings:
 * - Single line text → Multiline/HTML RTE/JSON RTE
 * - Multiline text → HTML RTE/JSON RTE
 * - HTML RTE → JSON RTE
 * - JSON RTE → HTML RTE
 * - Taxonomy term references → Taxonomy fields with vocabulary mappings
 *
 * The function supports processing of:
 * - Text fields with various widget types
 * - Rich text fields with associated reference fields
 * - Integer/Number fields with widget-specific mappings
 * - Date, Link, Array, Boolean, Object, and Location fields
 * - Special handling for complex types like Entity references, File fields, and Taxonomy terms.
 * - Taxonomy fields with automatic vocabulary detection and mapping.
 */
const contentTypeMapper = async (data, contentTypes, prefix, dbConfig = null) => {
  // Load taxonomy schema for taxonomy field processing
  const taxonomySchema = await loadTaxonomySchema(dbConfig);

  // 🏷️ Collect taxonomy fields for consolidation
  const collectedTaxonomies = [];

  const schemaArray = data.reduce((acc, item) => {
    // Add prefix to item for UID correction
    item.prefix = prefix;

    switch (item.type) {
      case 'text_with_summary':
      case 'text_long': {
        // Rich text with switching options: JSON RTE → HTML RTE → multiline → text
        const availableContentTypes = contentTypes?.filter((ct) => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'json', 'html', referenceFields));
        break;
      }
      case 'text': {
        // Multi Line Text Fields
        acc.push(createFieldObject(item, 'multi_line_text', 'multi_line_text'));
        break;
      }
      case 'string_long': {
        // Multi Line Text Fields
        acc.push(createFieldObject(item, 'multi_line_text', 'multi_line_text'));
        break;
      }
      case 'comment': {
        // Comment Field - multiline
        acc.push(createFieldObject(item, 'multi_line_text', 'multi_line_text'));
        break;
      }
      case 'string': {
        // Single line with switching options: single_line → multiline → HTML RTE → JSON RTE
        const availableContentTypes = contentTypes?.filter((ct) => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'single_line_text', 'multi_line_text', referenceFields));
        break;
      }
      case 'telephone': {
        // Telephone field - number field
        acc.push(createFieldObject(item, 'number', 'number'));
        break;
      }
      case 'email': {
        // Email field - single line text
        acc.push(createFieldObject(item, 'single_line_text', 'single_line_text'));
        break;
      }
      case 'list_string': {
        // Select/Dropdown field for string values (supports radio/checkbox/dropdown)
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown', 'text'));
        break;
      }
      case 'taxonomy_term_reference': {
        // 🏷️ Collect taxonomy field for consolidation instead of creating individual fields
        if (taxonomySchema && taxonomySchema.length > 0) {
          // Try to determine specific vocabularies this field references
          let targetVocabularies = [];

          // Check if field has handler settings that specify target vocabularies
          if (item.handler_settings && item.handler_settings.target_bundles) {
            targetVocabularies = Object.keys(item.handler_settings.target_bundles);
          }

          // Add vocabularies to collection (avoid duplicates)
          if (targetVocabularies && targetVocabularies.length > 0) {
            targetVocabularies.forEach((vocab) => {
              if (!collectedTaxonomies.includes(vocab)) {
                collectedTaxonomies.push(vocab);
              }
            });
          } else {
            // Backup: Use all available taxonomies from taxonomySchema.json
            taxonomySchema.forEach((taxonomy) => {
              if (!collectedTaxonomies.includes(taxonomy.uid)) {
                collectedTaxonomies.push(taxonomy.uid);
              }
            });
          }
        } else {
          // Fallback to regular reference field if no taxonomy schema available
          acc.push(createFieldObject(item, 'reference', 'reference', ['taxonomy']));
        }
        break;
      }
      case 'entity_reference': {
        // Check if this is a media field by handler
        if (item.handler === 'default:media') {
          // Media entity references should be treated as file fields
          acc.push(createFieldObject(item, 'file', 'file'));
        } else if (item.handler === 'default:taxonomy_term') {
          // 🏷️ Collect taxonomy field for consolidation instead of creating individual fields

          // Try to determine specific vocabularies this field references
          let targetVocabularies = [];

          // Check if field has handler settings that specify target vocabularies
          if (item.reference) {
            targetVocabularies = Object.keys(item.reference);
          }

          if (taxonomySchema && taxonomySchema.length > 0) {
            // Add vocabularies to collection (avoid duplicates)
            if (targetVocabularies && targetVocabularies.length > 0) {
              targetVocabularies.forEach((vocab) => {
                if (!collectedTaxonomies.includes(vocab)) {
                  collectedTaxonomies.push(vocab);
                }
              });
            } else {
              // Backup: Use all available taxonomies from taxonomySchema.json
              taxonomySchema.forEach((taxonomy) => {
                if (!collectedTaxonomies.includes(taxonomy.uid)) {
                  collectedTaxonomies.push(taxonomy.uid);
                }
              });
            }
          } else {
            // Fallback to regular reference field if no taxonomy schema available
            // Use available content types instead of generic 'taxonomy'
            const availableContentTypes =
              contentTypes?.filter((ct) => ct !== item.content_types) || [];
            const referenceFields = availableContentTypes.slice(0, 10);
            acc.push(createFieldObject(item, 'reference', 'reference', referenceFields));
          }
        } else if (item.handler === 'default:node') {
          // Handle node reference fields - use specific content types from reference settings
          let referenceFields = [];

          if (item.reference && Object.keys(item.reference).length > 0) {
            // Use specific content types from field configuration
            referenceFields = Object.keys(item.reference);
          } else {
            // Backup: Use up to 10 content types from available content types
            const availableContentTypes =
              contentTypes?.filter((ct) => ct !== item.content_types) || [];
            referenceFields = availableContentTypes.slice(0, 10);
          }

          acc.push(createFieldObject(item, 'reference', 'reference', referenceFields));
        } else {
          // Handle other entity references - exclude taxonomy and limit to 10 content types
          const availableContentTypes =
            contentTypes?.filter((ct) => ct !== item.content_types) || [];
          const referenceFields = availableContentTypes.slice(0, 10);
          acc.push(createFieldObject(item, 'reference', 'reference', referenceFields));
        }
        break;
      }
      case 'image':
      case 'file': {
        acc.push(createFieldObject(item, 'file', 'file'));
        break;
      }
      case 'list_boolean':
      case 'boolean': {
        acc.push(createBooleanFieldObject(item));
        break;
      }
      case 'datetime':
      case 'timestamp': {
        acc.push(createFieldObject(item, 'isodate', 'isodate'));
        break;
      }
      case 'daterange': {
        // Date range field - isodate with date_range: true
        acc.push(createDateRangeFieldObject(item));
        break;
      }
      case 'integer':
      case 'decimal':
      case 'float': {
        acc.push(createFieldObject(item, 'number', 'number'));
        break;
      }
      case 'list_integer': {
        // Select/Dropdown field for integer values (supports radio/checkbox/dropdown)
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown', 'number', 'integer'));
        break;
      }
      case 'list_float': {
        // Select/Dropdown field for float values (supports radio/checkbox/dropdown)
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown', 'number', 'float'));
        break;
      }
      case 'link': {
        acc.push(createFieldObject(item, 'link', 'link'));
        break;
      }
      case 'list_text': {
        // Select/Dropdown field for text values (supports radio/checkbox/dropdown)
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown', 'text'));
        break;
      }
      case 'list_number': {
        // Select/Dropdown field for number values (supports radio/checkbox/dropdown)
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown', 'number'));
        break;
      }
      default: {
        // Default to single line text for unknown types
        acc.push(createFieldObject(item, 'single_line_text', 'single_line_text'));
        break;
      }
    }
    return acc;
  }, []);

  // Add default title and url fields if not present
  const hasTitle = schemaArray.some((field) => field.uid === 'title');
  const hasUrl = schemaArray.some((field) => field.uid === 'url');

  if (!hasTitle) {
    schemaArray.unshift({
      uid: 'title',
      otherCmsField: 'title',
      otherCmsType: 'text',
      contentstackField: 'title',
      contentstackFieldUid: 'title',
      contentstackFieldType: 'text',
      backupFieldType: 'text',
      backupFieldUid: 'title',
      advanced: { mandatory: true }
    });
  }

  if (!hasUrl) {
    schemaArray.splice(1, 0, {
      uid: 'url',
      otherCmsField: 'url',
      otherCmsType: 'text',
      contentstackField: 'Url',
      contentstackFieldUid: 'url',
      contentstackFieldType: 'url',
      backupFieldType: 'url',
      backupFieldUid: 'url',
      advanced: { mandatory: true }
    });
  }

  // 🏷️ TAXONOMY CONSOLIDATION: Create single consolidated taxonomy field if any taxonomies were collected
  if (collectedTaxonomies.length > 0) {
    // Create consolidated taxonomy field with fixed properties
    const consolidatedTaxonomyField = {
      uid: 'taxonomies',
      otherCmsField: 'Taxonomy',
      otherCmsType: 'taxonomy',
      contentstackField: 'Taxonomy',
      contentstackFieldUid: 'taxonomies',
      contentstackFieldType: 'taxonomy',
      backupFieldType: 'taxonomy',
      backupFieldUid: 'taxonomies',
      advanced: {
        taxonomies: collectedTaxonomies.map((taxonomyUid) => ({
          taxonomy_uid: taxonomyUid,
          mandatory: false,
          multiple: true,
          non_localizable: false
        })),
        mandatory: false,
        multiple: true,
        non_localizable: false,
        unique: false
      }
    };

    // Add consolidated taxonomy field at the end of schema
    schemaArray.push(consolidatedTaxonomyField);
  }

  return schemaArray;
};

module.exports = contentTypeMapper;
