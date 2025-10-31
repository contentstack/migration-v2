import { createSchema } from 'genson-js';

/**
 * Enhances a JSON schema by adding original values alongside type information
 */
function enhanceSchemaWithValues(schema: any, originalData: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  // Create a new object for the enhanced schema
  const enhanced: any = { ...schema };

  // If the schema has properties, process each property
  if (schema.properties) {
    enhanced.properties = { ...schema.properties };

    // For each property in the schema
    Object.keys(schema.properties).forEach(key => {
      // Get the original value if it exists
      if (originalData && originalData.hasOwnProperty(key)) {
        const originalValue = originalData[key];
        const propertySchema = schema.properties[key];

        // Add the value to the schema
        enhanced.properties[key] = {
          ...propertySchema,
          value: originalValue
        };

        // Recursively process nested objects
        if (
          propertySchema.type === 'object' &&
          originalValue &&
          typeof originalValue === 'object'
        ) {
          enhanced.properties[key] = enhanceSchemaWithValues(
            propertySchema,
            originalValue
          );
        }

        // Handle arrays with nested objects
        if (
          propertySchema.type === 'array' &&
          Array.isArray(originalValue) &&
          propertySchema.items &&
          propertySchema.items.type === 'object'
        ) {
          // Use the first array item as a sample for the schema
          const sampleItem = originalValue[0];
          if (sampleItem && typeof sampleItem === 'object') {
            enhanced.properties[key].items = enhanceSchemaWithValues(
              propertySchema.items,
              sampleItem
            );
          }
          enhanced.properties[key].value = originalValue;
        }
      }
    });
  }

  return enhanced;
}


export const createSchemaTypes = (data: Record<string, any>) => {
  const typeSchema = createSchema(data?.props);
  // Create a combined schema with both types and values
  const enhancedSchema = enhanceSchemaWithValues(typeSchema, data?.props || {});
  return { convertedSchema: enhancedSchema };
}




