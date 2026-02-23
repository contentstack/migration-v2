"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchemaTypes = void 0;
const genson_js_1 = require("genson-js");
/**
 * Enhances a JSON schema by adding original values alongside type information
 */
function enhanceSchemaWithValues(schema, originalData) {
    if (!schema || typeof schema !== 'object')
        return schema;
    // Create a new object for the enhanced schema
    const enhanced = Object.assign({}, schema);
    // If the schema has properties, process each property
    if (schema.properties) {
        enhanced.properties = Object.assign({}, schema.properties);
        // For each property in the schema
        Object.keys(schema.properties).forEach(key => {
            // Get the original value if it exists
            if (originalData && originalData.hasOwnProperty(key)) {
                const originalValue = originalData[key];
                const propertySchema = schema.properties[key];
                // Add the value to the schema
                enhanced.properties[key] = Object.assign(Object.assign({}, propertySchema), { value: originalValue });
                // Recursively process nested objects
                if (propertySchema.type === 'object' &&
                    originalValue &&
                    typeof originalValue === 'object') {
                    enhanced.properties[key] = enhanceSchemaWithValues(propertySchema, originalValue);
                }
                // Handle arrays with nested objects
                if (propertySchema.type === 'array' &&
                    Array.isArray(originalValue) &&
                    propertySchema.items &&
                    propertySchema.items.type === 'object') {
                    // Use the first array item as a sample for the schema
                    const sampleItem = originalValue[0];
                    if (sampleItem && typeof sampleItem === 'object') {
                        enhanced.properties[key].items = enhanceSchemaWithValues(propertySchema.items, sampleItem);
                    }
                    enhanced.properties[key].value = originalValue;
                }
            }
        });
    }
    return enhanced;
}
const createSchemaTypes = (data) => {
    const typeSchema = (0, genson_js_1.createSchema)(data === null || data === void 0 ? void 0 : data.props);
    // Create a combined schema with both types and values
    const enhancedSchema = enhanceSchemaWithValues(typeSchema, (data === null || data === void 0 ? void 0 : data.props) || {});
    return { convertedSchema: enhancedSchema };
};
exports.createSchemaTypes = createSchemaTypes;
