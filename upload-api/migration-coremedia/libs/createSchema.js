/**
 * Schema Creation Module
 * 
 * This module converts CoreMedia content type definitions into Contentstack
 * schema format. It maps property types and creates JSON schema files
 * for each content type.
 */
const config = require("../config");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const handleStructType = require("../utils/handleStruct.js");
const contenttypeFolder = config?.modules?.contentTypes?.dirName;

// Ensure the content type folder exists before writing schema files
if (!fs.existsSync(path.join(process.cwd(), config.data, contenttypeFolder))) {
  mkdirp.sync(path.join(process.cwd(), config.data, contenttypeFolder));
}

// Track processed content types to avoid duplicate schema creation
const templetes = [];

// List of property keys to skip during schema mapping
// These are CoreMedia-specific metadata fields not needed in Contentstack schema
const skipKeys = [
  "notSearchable",
  "externalId",
  "externalRefId",
  "ignoreUpdates",
  "masterVersion",
  "notSearchable",
  "validFrom",
  "validTo",
  "locale",
  "htmlDescription",
  "keywords",
];
/**
 * Maps CoreMedia properties to Contentstack schema field definitions
 * 
 * @param {Object} properties - Object containing property definitions from CoreMedia
 * @returns {Array} Array of Contentstack field schema objects
 */
async function schemaMapper(properties) {
  // Return empty array if no properties provided
  if (!properties) return [];

  const fieldMapping = [];

  // Process all properties
  for (const [key, prop] of Object.entries(properties)) {
    // Skip certain properties
    if (skipKeys.includes(key)) continue;

    const type = prop?.type?.toLowerCase?.();
    const uid = uidCorrector(key);
    const contentstackFieldType = mapFieldType(type);

        // Map each CoreMedia type to corresponding Contentstack field type
        switch (type) {
          case "string":
            // Title field is mandatory, other string fields are optional
            return key === "title" ?
              {
                  data_type: "text",
                  display_name: key,
                  uid: key.toLowerCase(),
                  field_metadata: {
                    description: "",
                    default_value: "",
                  },
                  format: "",
                  error_messages: {
                    format: "",
                  },
                  mandatory: true,
                  multiple: false,
                  non_localizable: false,
                  unique: false,
                }
              : { 
                  data_type: "text",
                  display_name: key,
                  uid: key.toLowerCase(),
                  field_metadata: {
                    description: "",
                    default_value: "",
                  },
                  multiple: false,
                  mandatory: false,
                  unique: false,
              };
            
          case "integer":
            // Map integer type to Contentstack number field
            return {
              data_type: "number",
              display_name: key,
              uid: key.toLowerCase(),
              field_metadata: {
                description: "",
                default_value: "",
              },
              multiple: false,
              mandatory: false,
              unique: false,
            };
            
          case "date":
            // Map date type to Contentstack ISO date field
            return {
              data_type: "isodate",
              display_name: key,
              startDate: null,
              endDate: null,
              uid: key.toLowerCase(),
              field_metadata: {
                description: "",
                default_value: "",
              },
              multiple: false,
              mandatory: false,
              unique: false,
            };
            
          case "boolean":
            // Map boolean type to Contentstack boolean field
            return {
              data_type: "boolean",
              display_name: key,
              uid: key.toLowerCase(),
              field_metadata: {
                description: "",
                default_value: "",
              },
              multiple: false,
              mandatory: false,
              unique: false,
            };
            
          case "struct": {
            // Handle complex structured types by delegating to handleStructType
            const structSchema = await handleStructType(key, prop);
        
            // Return null if struct schema is empty or invalid
            if (structSchema?.length === 0) {
              return null;
            } else if (structSchema) {
              // Return group field with nested schema
              return {
                data_type: "group",
                display_name: key,
                uid: key.toLowerCase(),
                schema: structSchema,
              };
            } else {
              return null;
            }
            
          }
          case "linklist": {
            // Handle reference lists (links to other content types)
            if (prop?.references?.length > 0) {
              //const parts = data?.id.split("/").filter(Boolean);
              //const lastTwo = parts.slice(-2).join("_");
              
              // Extract referenced content type IDs, removing "CM" prefix
              const referencedId = prop?.references?.map((item) =>
                item?.type?.replace(/^CM/, "")?.toLowerCase()
              );

              // Create reference field that can link to multiple content types
              return {
                data_type: "reference",
                display_name: key,
                reference_to: [referencedId[0]],
                field_metadata: {
                  ref_multiple: true,
                  ref_multiple_content_types: true,
                },
                uid: key?.toLowerCase(),
                unique: false,
                mandatory: false,
                multiple: false,
              };
            }
            break;
          }
          default:
            // Return null for unmapped types
            return null;
        }
      })
  );

  // Ensure URL field exists
  const hasUrl = fieldMapping.find((item) => item.contentstackFieldUid === 'url');
  if (!hasUrl) {
    fieldMapping.push({
      uid: 'url',
      otherCmsField: 'url',
      otherCmsType: 'String',
      contentstackField: 'Url',
      contentstackFieldUid: 'url',
      contentstackFieldType: 'url',
      backupFieldType: 'url',
      backupFieldUid: 'url',
      advanced: { default_value: null }
    });
  }

  return fieldMapping;
}

/**
 * Creates a content type object from CoreMedia data (matching Sitecore format)
 * 
 * @param {Object} data - CoreMedia content type data object
 * @returns {Object|null} Content type object or null if already processed
 */
async function createSchema(data) {
  console.log("data ==================", data);
  // Map CoreMedia properties to fieldMapping format
  const fieldMapping = await schemaMapper(data.properties);

  // Extract content type name by removing "CM" prefix from type
  const type = data?.type?.replace(/^CM/, "");
  const uid = uidCorrector(type);
  let contentObject;
  
  // Only create schema if this content type hasn't been processed before
  if (!templetes.includes(data?.type)) {
  
    // Build content type object (matching Sitecore format for API compatibility)
    contentObject = {
      id: uid,
      status: 1,
      otherCmsTitle: type,
      otherCmsUid: data?.type || type,
      isUpdated: false,
      updateAt: '',
      contentstackTitle: type,
      contentstackUid: uid,
      fieldMapping: fieldMapping,
      type: 'content_type'
    };

    // Convert to JSON with pretty formatting
    const contentJSON = JSON.stringify(contentObject, null, 2);
    
    // Write schema file to disk
    fs.writeFileSync(
      path.join(
        process.cwd(),
        config.data,
        contenttypeFolder,
        `${uid}.json`
      ),
      contentJSON
    );

    console.log(`✅ Created content type: ${type} with ${fieldMapping.length} fields`);
  }
  
  // Track this content type as processed to avoid duplicates
  templetes.push(data?.type);

  return contentObject;
}

module.exports = createSchema;
