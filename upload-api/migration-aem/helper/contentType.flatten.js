"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenContentTypes = flattenContentTypes;
function flattenContentTypes(contentTypes) {
    return contentTypes.map(contentType => (Object.assign(Object.assign({}, contentType), { fieldMapping: flattenFieldMapping(contentType.fieldMapping) })));
}
function flattenFieldMapping(fieldMapping) {
    const flattenedFields = [];
    fieldMapping.forEach(field => {
        processField(field, [], [], flattenedFields);
    });
    return flattenedFields;
}
function processField(field, parentPath, parentUidPath, flattenedFields) {
    const currentPath = [...parentPath];
    const currentUidPath = [...parentUidPath];
    // Add current field to path if it has a uid
    if (field.uid) {
        currentPath.push(field.uid);
        currentUidPath.push(field.contentstackFieldUid || field.uid);
    }
    // Create a clean copy of the field without blocks and schema
    const flatField = Object.keys(field).reduce((acc, key) => {
        if (key !== 'blocks' && key !== 'schema') {
            acc[key] = field[key];
        }
        return acc;
    }, {});
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
function processBlock(block, parentPath, parentUidPath, flattenedFields) {
    const currentPath = [...parentPath];
    const currentUidPath = [...parentUidPath];
    // Add block to path if it has a uid
    if (block.uid) {
        currentPath.push(block.uid);
        currentUidPath.push(block.contentstackFieldUid || block.uid);
    }
    // Create a clean copy of the block without schema
    const blockField = Object.keys(block).reduce((acc, key) => {
        if (key !== 'schema') {
            acc[key] = block[key];
        }
        return acc;
    }, {});
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
