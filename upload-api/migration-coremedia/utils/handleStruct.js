const xml2js = require('xml2js');

const transformStruct = async (parsedStruct, key) => {
  return Object.entries(parsedStruct?.Struct || {}).map(([key, prop]) => {
    if (key === "attributes") return null;

    switch (key) {
      case "StringProperty":
        return {
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

      case "LinkProperty": {
        const parts = prop?.attributes?.["xlink:href"]
          ?.split("/")
          .filter(Boolean);

        const lastTwo = parts?.slice(-2)?.join("_");
        return {
          data_type: "reference",
          display_name: key,
          reference_to: [lastTwo],
          field_metadata: {
            ref_multiple: true,
            ref_multiple_content_types: true,
          },
          uid: key?.toLowerCase(),
          unique: false,
          mandatory: false,
          multiple: false,
          non_localizable: false,
        };
      }

      case "BooleanProperty":
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

      case "StructListProperty":
        return {
          data_type: "link",
          display_name: prop?.attributes?.Name,
          uid: "link",
          field_metadata: {
            description: "",
            default_value: {
              title: "test",
              url: prop?.attributes?.["xlink:href"],
            },
          },
          mandatory: false,
          multiple: false,
          non_localizable: false,
          unique: false,
        };

      case "StructProperty": {
        const nestedSchema = transformStruct(prop?.Struct ?? prop);

        if (nestedSchema?.length === 0) {
          return null; // don't return anything if nested schema is empty/undefined
        } else {
          return {
            data_type: "group",
            uid: key?.toLowerCase(),
            display_name: key,
            schema: nestedSchema, // recursive call for nested struct
          };
        }
      }

      default:
        return null;
    }
  }).filter(Boolean);
};

const handleStructType = async (key, prop) => {
  if (prop?.value && typeof prop?.value === "string") {
    const parser = new xml2js.Parser({
      attrkey: 'attributes',
      charkey: 'text',
      explicitArray: false
    });
    const parsedStruct = await parser?.parseStringPromise(prop?.value);
    const structSchema = transformStruct(parsedStruct, key);

    return structSchema;
  }
};

module.exports = handleStructType;