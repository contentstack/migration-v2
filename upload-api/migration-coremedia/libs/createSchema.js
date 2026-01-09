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

  // Process all properties in parallel, filtering out skipped keys
  const mapped = await Promise.all(
    Object.entries(properties)
      // Filter out properties that should be skipped
      .filter(([key]) => !skipKeys.includes(key))
      .map(async ([key, prop]) => {
        // Special handling for htmlTitle - map it to a global SEO field
        if (key === "htmlTitle") {
          return {
            data_type: "global_field",
            display_name: "Seo",
            reference_to: "seo",
            field_metadata: {
              description: "",
            },
            uid: "seo",
            mandatory: false,
            multiple: false,
            non_localizable: false,
            unique: false,
          };
        }
        // Add htmlTitle to skip list after processing to avoid duplicate handling
        skipKeys.push("htmlTitle");
        
        // Get the property type in lowercase for case-insensitive matching
        const type = prop?.type?.toLowerCase?.();

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

  // Filter out null values from the mapped array
  const filtered = mapped?.filter(Boolean);
  
  // Ensure URL field exists in schema (required for Contentstack)
  // Add it if not already present
  if (
    !filtered?.find((item) => item?.data_type === "text" && item?.uid === "url")
  ) {
    filtered.push({
      display_name: "Url",
      uid: "url",
      data_type: "text",
      mandatory: true,
      unique: false,
      field_metadata: { _default: true },
      format: "",
      error_messages: { format: "" },
      multiple: false,
      non_localizable: false,
    });
  }
  return filtered.filter(Boolean);
}

/**
 * Creates a Contentstack content type schema from CoreMedia data
 * 
 * @param {Object} data - CoreMedia content type data object
 * @returns {Object|null} Contentstack content type schema object or null if already processed
 */
async function createSchema(data) {
  // Map CoreMedia properties to Contentstack schema fields
  const schema = await schemaMapper(data.properties);

  // Extract content type name by removing "CM" prefix from type
  const type = data?.type?.replace(/^CM/, "");
  const len = data?.path?.length;
  const title = data?.path?.split("/").pop();
  let contentObject;
  
  // Extract ID parts for potential reference building
  const parts = data?.id.split("/").filter(Boolean);
  const lastTwo = parts.slice(-2).join("_");

  console.log("data ==================", data);
 
  // Only create schema if this content type hasn't been processed before
  if (!templetes.includes(data?.type)) {
  
    // Build Contentstack content type schema object
    contentObject = {
      title: type,
      uid: type?.toLowerCase(),
      schema: schema,
      options: {
        is_page: true,
        title: "title",
        sub_title: [],
        url_pattern: "/:year/:month/:title",
        _version: 1,
        url_prefix: `/${data?.uid}/`,
        description: "",
        singleton: false,
      },
      description: "",
      type: data?.type,
    };

    // Convert to JSON with pretty formatting
    const contentJSON = JSON.stringify(contentObject, null, 2);
    
    // Write schema file to disk
    fs.writeFileSync(
      path.join(
        process.cwd(),
        config.data,
        contenttypeFolder,
        `${type?.toLowerCase()}.json`
      ),
      contentJSON
    );
  }
  
  // Track this content type as processed to avoid duplicates
  templetes.push(data?.type);

  return contentObject;
}

module.exports = createSchema;
