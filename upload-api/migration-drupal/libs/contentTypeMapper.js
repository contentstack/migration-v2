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
    const taxonomySchemaPath = path.join(__dirname, '..', '..', 'drupalMigrationData', 'taxonomySchema', 'taxonomySchema.json');
    
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

/**
 * Corrects the UID by applying a custom affix and sanitizing the string.
 *
 * @param {string} uid - The original UID that needs to be corrected.
 * @param {string} affix - The affix to be prepended to the UID if it's restricted.
 * @returns {string} The corrected UID with the affix (if applicable) and sanitized characters.
 *
 * @description
 * This function checks if the provided `uid` is included in the `restrictedUid` list. If it is, the function will:
 * 1. Prepend the provided `affix` to the `uid`.
 * 2. Replace any non-alphanumeric characters in the `uid` with underscores.
 * 
 * It then converts any uppercase letters to lowercase and prefixes them with an underscore (to match a typical snake_case format).
 *
 * If the `uid` is not restricted, the function simply returns it after converting uppercase letters to lowercase and adding an underscore before each uppercase letter.
 * // Outputs: 'prefix_my_restricted_uid'
 */
const uidCorrector = (uid, affix) => {
  let newId = uid;
  if (restrictedUid?.includes?.(uid) || uid?.startsWith?.('_ids') || uid?.endsWith?.('_ids')) {
    newId = uid?.replace?.(uid, `${affix}_${uid}`);
    newId = newId?.replace?.(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `${match?.toLowerCase?.()}`);
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
    multiple: item?.max > 1 || false,
    unique: false,
    nonLocalizable: false,
    validationErrorMessage: '',
    embedObjects: referenceFields.length ? referenceFields : (referenceFields.length === 0 && Array.isArray(referenceFields) ? [] : undefined),
    description: description,
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
 * Creates a field object for dropdown or radio field types with appropriate options and validations.
 *
 * @param {Object} item - The Drupal field item that includes field details like `type`, etc.
 * @param {string} fieldType - The type of field being created (e.g., 'dropdown', 'radio').
 * @returns {Object} A field object that includes the field configuration and validation options.
 *
 * @description
 * This function generates a field object for dropdown or radio field types based on the provided item.
 * It ensures that the field's advanced properties are extracted from the item, including validation options.
 * 
 */
const createDropdownOrRadioFieldObject = (item, fieldType) => {
  return {
    ...createFieldObject(item, fieldType, fieldType),
    advanced: {
      ...extractAdvancedFields(item),
      options: [{ value: 'value', key: 'key' }]
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
    taxonomiesToInclude = taxonomySchema.filter(taxonomy => 
      targetVocabularies.includes(taxonomy.uid) || targetVocabularies.includes(taxonomy.name)
    );
  } else {
    // If no specific vocabularies, include all available taxonomies
    taxonomiesToInclude = taxonomySchema;
  }
  
  // Build taxonomies array with default properties
  const taxonomiesArray = taxonomiesToInclude.map(taxonomy => ({
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
      data_type: "taxonomy",
      display_name: item?.field_label || item?.field_name,
      uid: uidCorrector(fieldNameWithSuffix, item?.prefix),
      taxonomies: taxonomiesArray,
      field_metadata: { 
        description: advancedFields?.field_metadata?.description || "", 
        default_value: advancedFields?.field_metadata?.default_value || "" 
      },
      format: "",
      error_messages: { format: "" },
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
        const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'json', 'html', referenceFields));
        break;
      }
      case 'text': {
        // Single line with switching options: single_line → multiline → HTML RTE → JSON RTE
        const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'single_line_text', 'multi_line_text', referenceFields));
        break;
      }
      case 'string_long':
      case 'comment': {
        // Rich text with switching options: JSON RTE → HTML RTE → multiline → text
        const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'json', 'html', referenceFields));
        break;
      }
      case 'string':
      case 'list_string': {
        // Single line with switching options: single_line → multiline → HTML RTE → JSON RTE
        const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
        const referenceFields = availableContentTypes.slice(0, 10);
        acc.push(createFieldObject(item, 'single_line_text', 'multi_line_text', referenceFields));
        break;
      }
      case 'email': {
        acc.push(createFieldObject(item, 'text', 'text'));
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
            targetVocabularies.forEach(vocab => {
              if (!collectedTaxonomies.includes(vocab)) {
                collectedTaxonomies.push(vocab);
              }
            });
          } else {
            // Backup: Use all available taxonomies from taxonomySchema.json
            taxonomySchema.forEach(taxonomy => {
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
        // Check if this is a taxonomy field by handler
        if (item.handler === 'default:taxonomy_term') {
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
              targetVocabularies.forEach(vocab => {
                if (!collectedTaxonomies.includes(vocab)) {
                  collectedTaxonomies.push(vocab);
                }
              });
            } else {
              // Backup: Use all available taxonomies from taxonomySchema.json
              taxonomySchema.forEach(taxonomy => {
                if (!collectedTaxonomies.includes(taxonomy.uid)) {
                  collectedTaxonomies.push(taxonomy.uid);
                }
              });
            }
          } else {
            // Fallback to regular reference field if no taxonomy schema available
            // Use available content types instead of generic 'taxonomy'
            const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
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
            const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
            referenceFields = availableContentTypes.slice(0, 10);
          }
          
          acc.push(createFieldObject(item, 'reference', 'reference', referenceFields));
        } else {
          // Handle other entity references - exclude taxonomy and limit to 10 content types
          const availableContentTypes = contentTypes?.filter(ct => ct !== item.content_types) || [];
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
        acc.push(createFieldObject(item, 'boolean', 'boolean'));
        break;
      }
      case 'datetime':
      case 'timestamp': {
        acc.push(createFieldObject(item, 'isodate', 'isodate'));
        break;
      }
      case 'integer':
      case 'decimal':
      case 'float':
      case 'list_integer':
      case 'list_float': {
        acc.push(createFieldObject(item, 'number', 'number'));
        break;
      }
      case 'link': {
        acc.push(createFieldObject(item, 'link', 'link'));
        break;
      }
      case 'list_text': {
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown'));
        break;
      }
      case 'list_number': {
        acc.push(createDropdownOrRadioFieldObject(item, 'dropdown'));
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
  const hasTitle = schemaArray.some(field => field.uid === 'title');
  const hasUrl = schemaArray.some(field => field.uid === 'url');

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
        taxonomies: collectedTaxonomies.map(taxonomyUid => ({
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
