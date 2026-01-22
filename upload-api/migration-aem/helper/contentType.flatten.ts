interface Field {
  id?: string;
  uid?: string;
  otherCmsField?: string;
  otherCmsType?: string;
  contentstackField?: string;
  contentstackFieldUid?: string;
  contentstackFieldType?: string;
  backupFieldType?: string;
  backupFieldUid?: string;
  blocks?: Block[];
  schema?: SchemaField[];
  advanced?: any;
  isDeleted?: boolean;
  referenceTo?: string[];
  type?: string;
  [key: string]: any;
}

interface Block {
  uid?: string;
  otherCmsField?: string;
  contentstackField?: string;
  contentstackFieldUid?: string;
  backupFieldUid?: string;
  schema?: SchemaField[];
  [key: string]: any;
}

interface SchemaField extends Field {
  // Schema fields have same structure as Field
}

interface ContentType {
  id: string;
  status: number;
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  contentstackTitle: string;
  contentstackUid: string;
  type: string;
  fieldMapping: Field[];
  mergedFromIds: string[];
}

function flattenContentTypes(contentTypes: ContentType[]): ContentType[] {
  return contentTypes.map(contentType => ({
    ...contentType,
    fieldMapping: flattenFieldMapping(contentType.fieldMapping)
  }));
}

function flattenFieldMapping(fieldMapping: Field[]): Field[] {
  const flattenedFields: Field[] = [];

  fieldMapping.forEach(field => {
    processField(field, [], [], flattenedFields);
  });

  return flattenedFields;
}

function processField(
  field: Field,
  parentPath: string[],
  parentUidPath: string[],
  flattenedFields: Field[]
): void {
  const currentPath = [...parentPath];
  const currentUidPath = [...parentUidPath];

  // Add current field to path if it has a uid
  if (field.uid) {
    currentPath.push(field.uid);
    currentUidPath.push(field.contentstackFieldUid || field.uid);
  }

  // Create a clean copy of the field without blocks and schema
  const flatField: Field = Object.keys(field).reduce((acc, key) => {
    if (key !== 'blocks' && key !== 'schema') {
      acc[key] = field[key];
    }
    return acc;
  }, {} as Field);

  // Update the paths for nested fields
  if (currentPath.length > 0) {
    flatField.uid = currentPath.join('.');
    flatField.otherCmsField = currentPath.join(' > ');
    flatField.contentstackField = currentPath.join(' > ');
    flatField.contentstackFieldUid = currentUidPath.join('.');
    flatField.backupFieldUid = currentUidPath.join('.');
  }

  // Add the clean field to flattened array
  flattenedFields.push(flatField);

  // Process blocks if they exist in the original field
  if (field.blocks && Array.isArray(field.blocks)) {
    field.blocks.forEach(block => {
      processBlock(block, currentPath, currentUidPath, flattenedFields);
    });
  }

  // Process schema fields if they exist in the original field
  if (field.schema && Array.isArray(field.schema)) {
    field.schema.forEach(schemaField => {
      processField(schemaField, currentPath, currentUidPath, flattenedFields);
    });
  }
}

function processBlock(
  block: Block,
  parentPath: string[],
  parentUidPath: string[],
  flattenedFields: Field[]
): void {
  const currentPath = [...parentPath];
  const currentUidPath = [...parentUidPath];

  // Add block to path if it has a uid
  if (block.uid) {
    currentPath.push(block.uid);
    currentUidPath.push(block.contentstackFieldUid || block.uid);
  }

  // Create a clean copy of the block without schema
  const blockField: Field = Object.keys(block).reduce((acc, key) => {
    if (key !== 'schema') {
      acc[key] = block[key];
    }
    return acc;
  }, {} as Field);

  // Update all path fields
  if (currentPath.length > 0) {
    blockField.uid = currentPath.join('.');
    blockField.otherCmsField = currentPath.join(' > ');
    blockField.contentstackField = currentPath.join(' > ');
    blockField.contentstackFieldUid = currentUidPath.join('.');
    blockField.backupFieldUid = currentUidPath.join('.');
  }

  // Add clean block to flattened array
  flattenedFields.push(blockField);

  // Process schema if it exists in the original block
  if (block.schema && Array.isArray(block.schema)) {
    block.schema.forEach(schemaField => {
      processField(schemaField, currentPath, currentUidPath, flattenedFields);
    });
  }
}

// Export the main function
export { flattenContentTypes };