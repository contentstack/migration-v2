"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processContentModels = processContentModels;
const _1 = require(".");
// Dynamic type order tracking
let dynamicTypeOrder = [];
function trackComponentType(type) {
    const cleanType = type.toLowerCase().includes('customembed') ? 'customembed' : type.toLowerCase();
    if (!dynamicTypeOrder.includes(cleanType)) {
        dynamicTypeOrder.push(cleanType);
    }
}
/**
 * Apply uidCorrector to all contentstackFieldUid values in the field mapping
 */
function normalizeFieldUids(field) {
    if (!field)
        return undefined;
    const normalized = Object.assign({}, field);
    if (normalized === null || normalized === void 0 ? void 0 : normalized.contentstackFieldUid) {
        normalized.contentstackFieldUid = (0, _1.uidCorrector)(normalized === null || normalized === void 0 ? void 0 : normalized.contentstackFieldUid);
    }
    // Also fix backupFieldUid if it exists
    if (normalized === null || normalized === void 0 ? void 0 : normalized.backupFieldUid) {
        normalized.backupFieldUid = (0, _1.uidCorrector)(normalized === null || normalized === void 0 ? void 0 : normalized.backupFieldUid);
    }
    // Fix UIDs in blocks
    if ((normalized === null || normalized === void 0 ? void 0 : normalized.blocks) && Array.isArray(normalized === null || normalized === void 0 ? void 0 : normalized.blocks)) {
        normalized.blocks = normalized === null || normalized === void 0 ? void 0 : normalized.blocks.map(block => normalizeBlockUids(block)).filter(block => block !== undefined);
    }
    // Fix UIDs in schema
    if (normalized === null || normalized === void 0 ? void 0 : normalized.schema) {
        if (Array.isArray(normalized === null || normalized === void 0 ? void 0 : normalized.schema)) {
            normalized.schema = normalized === null || normalized === void 0 ? void 0 : normalized.schema.map((schemaItem) => normalizeSchemaItemUids(schemaItem)).filter((item) => item !== undefined);
        }
        else if (typeof (normalized === null || normalized === void 0 ? void 0 : normalized.schema) === 'object') {
            normalized.schema = normalizeSchemaItemUids(normalized === null || normalized === void 0 ? void 0 : normalized.schema);
        }
    }
    return normalized;
}
/**
 * Normalize UIDs in a block item
 */
function normalizeBlockUids(block) {
    if (!block)
        return undefined;
    const normalized = Object.assign({}, block);
    // Fix the block's UID
    if (normalized === null || normalized === void 0 ? void 0 : normalized.contentstackFieldUid) {
        normalized.contentstackFieldUid = (0, _1.uidCorrector)(normalized.contentstackFieldUid);
    }
    // Fix backup UID
    if (normalized === null || normalized === void 0 ? void 0 : normalized.backupFieldUid) {
        normalized.backupFieldUid = (0, _1.uidCorrector)(normalized.backupFieldUid);
    }
    // Fix uid field (different from contentstackFieldUid)
    if (normalized === null || normalized === void 0 ? void 0 : normalized.uid) {
        normalized.uid = (0, _1.uidCorrector)(normalized.uid);
    }
    // Keep contentstackField unchanged
    if ((normalized === null || normalized === void 0 ? void 0 : normalized.blocks) && Array.isArray(normalized === null || normalized === void 0 ? void 0 : normalized.blocks)) {
        normalized.blocks = normalized.blocks
            .map(b => normalizeBlockUids(b))
            .filter(b => b !== undefined);
    }
    if (normalized === null || normalized === void 0 ? void 0 : normalized.schema) {
        if (Array.isArray(normalized.schema)) {
            normalized.schema = normalized.schema
                .map((item) => normalizeSchemaItemUids(item))
                .filter((item) => item !== undefined);
        }
        else if (typeof normalized.schema === 'object') {
            normalized.schema = normalizeSchemaItemUids(normalized.schema);
        }
    }
    return normalized;
}
/**
 * Normalize UIDs in a schema item
 */
function normalizeSchemaItemUids(schemaItem) {
    if (!schemaItem || typeof schemaItem !== 'object') {
        return schemaItem;
    }
    const normalized = Object.assign({}, schemaItem);
    if (normalized === null || normalized === void 0 ? void 0 : normalized.contentstackFieldUid) {
        normalized.contentstackFieldUid = (0, _1.uidCorrector)(normalized === null || normalized === void 0 ? void 0 : normalized.contentstackFieldUid);
    }
    if (normalized === null || normalized === void 0 ? void 0 : normalized.backupFieldUid) {
        normalized.backupFieldUid = (0, _1.uidCorrector)(normalized === null || normalized === void 0 ? void 0 : normalized.backupFieldUid);
    }
    if (normalized === null || normalized === void 0 ? void 0 : normalized.uid) {
        normalized.uid = (0, _1.uidCorrector)(normalized === null || normalized === void 0 ? void 0 : normalized.uid);
    }
    if ((normalized === null || normalized === void 0 ? void 0 : normalized.blocks) && Array.isArray(normalized === null || normalized === void 0 ? void 0 : normalized.blocks)) {
        normalized.blocks = normalized === null || normalized === void 0 ? void 0 : normalized.blocks.map((b) => normalizeBlockUids(b)).filter((b) => b !== undefined);
    }
    if (normalized === null || normalized === void 0 ? void 0 : normalized.schema) {
        if (Array.isArray(normalized === null || normalized === void 0 ? void 0 : normalized.schema)) {
            normalized.schema = normalized === null || normalized === void 0 ? void 0 : normalized.schema.map((item) => normalizeSchemaItemUids(item)).filter((item) => item !== undefined);
        }
        else if (typeof (normalized === null || normalized === void 0 ? void 0 : normalized.schema) === 'object') {
            normalized.schema = normalizeSchemaItemUids(normalized === null || normalized === void 0 ? void 0 : normalized.schema);
        }
    }
    return normalized;
}
/**
 * Main entry point for processing content models
 */
function processContentModels(jsonData) {
    console.log('=== Starting Content Model Processing ===');
    console.log(`Processing ${jsonData.length} total content models`);
    // Reset dynamic type order for each processing run
    dynamicTypeOrder = [];
    // Check if data is already processed
    const isAlreadyProcessed = jsonData.length > 0 && 'mergedFromIds' in jsonData[0];
    if (isAlreadyProcessed) {
        console.log('Data appears to be already processed. Applying deep deduplication and container merging.');
        return jsonData === null || jsonData === void 0 ? void 0 : jsonData.map(model => (Object.assign(Object.assign({}, model), { fieldMapping: model === null || model === void 0 ? void 0 : model.fieldMapping.map(field => {
                const processed = processFieldDeep(field);
                return normalizeFieldUids(processed);
            }).filter(field => field !== undefined) })));
    }
    const result = mergeContentModels(jsonData);
    console.log('\n=== Processing Complete ===');
    console.log(`Result: ${result.length} unique content models`);
    console.log(`Dynamic type order discovered: [${dynamicTypeOrder.join(', ')}]`);
    return result;
}
/**
 * Merges content models with the same contentstackUid
 */
function mergeContentModels(models) {
    const groupedModels = new Map();
    // Group by contentstackUid
    models.forEach(model => {
        const key = model === null || model === void 0 ? void 0 : model.contentstackUid;
        if (!groupedModels.has(key)) {
            groupedModels.set(key, []);
        }
        groupedModels.get(key).push(model);
    });
    const mergedModels = [];
    // Process each group
    groupedModels.forEach((group, contentstackUid) => {
        console.log(`\nProcessing content type: ${contentstackUid} (${group === null || group === void 0 ? void 0 : group.length} instances)`);
        if (group.length === 1) {
            // Single instance - just process blocks
            const singleModel = group === null || group === void 0 ? void 0 : group[0];
            const processedFieldMapping = singleModel === null || singleModel === void 0 ? void 0 : singleModel.fieldMapping.filter(f => f !== null && f !== undefined).map(field => {
                const processed = processFieldDeep(field);
                return normalizeFieldUids(processed);
            }).filter(field => field !== undefined);
            mergedModels.push(Object.assign(Object.assign({}, singleModel), { fieldMapping: processedFieldMapping, mergedFromIds: [singleModel === null || singleModel === void 0 ? void 0 : singleModel.id] }));
        }
        else {
            // Multiple instances - merge them
            const merged = mergeMultipleInstances(group);
            mergedModels.push(merged);
        }
    });
    return mergedModels;
}
/**
 * Process field with deep recursive deduplication and container merging
 */
function processFieldDeep(field) {
    var _a;
    // Process blocks at the top level
    if ((field === null || field === void 0 ? void 0 : field.blocks) && Array.isArray(field === null || field === void 0 ? void 0 : field.blocks)) {
        console.log(`\n📦 Processing field: ${(field === null || field === void 0 ? void 0 : field.uid) || (field === null || field === void 0 ? void 0 : field.contentstackFieldUid)}`);
        console.log(`  Initial blocks: ${(_a = field === null || field === void 0 ? void 0 : field.blocks) === null || _a === void 0 ? void 0 : _a.length}`);
        const processedBlocks = mergeBlocksWithSameUid(field === null || field === void 0 ? void 0 : field.blocks);
        console.log(`  Final blocks: ${processedBlocks.length}`);
        return Object.assign(Object.assign({}, field), { blocks: processedBlocks });
    }
    return field;
}
/**
 * Merges blocks with the same contentstackFieldUid at the same level in a blocks array
 * This function handles all the merging logic for blocks with same UIDs
 */
function mergeBlocksWithSameUid(blocks) {
    if (!blocks || !Array.isArray(blocks) || (blocks === null || blocks === void 0 ? void 0 : blocks.length) === 0) {
        return blocks;
    }
    // Track component types as they appear
    blocks.forEach(block => {
        const type = (block === null || block === void 0 ? void 0 : block.uid) || (block === null || block === void 0 ? void 0 : block.contentstackFieldUid) || '';
        if (type) {
            trackComponentType(type);
        }
    });
    // Group blocks by contentstackFieldUid (or uid as fallback)
    const blockGroups = new Map();
    const blockOrder = []; // Track order of first appearance
    blocks.forEach(block => {
        // Use contentstackFieldUid as the primary key for grouping, fallback to uid
        const key = (block === null || block === void 0 ? void 0 : block.contentstackFieldUid) || (block === null || block === void 0 ? void 0 : block.uid) || 'unknown';
        if (!blockGroups.has(key)) {
            blockGroups.set(key, []);
            blockOrder.push(key); // Track first appearance order
        }
        blockGroups.get(key).push(block);
    });
    // Result array
    const mergedBlocks = [];
    // Process each unique key in order of first appearance
    blockOrder.forEach(key => {
        var _a, _b, _c, _d;
        const sameUidBlocks = blockGroups.get(key);
        if (sameUidBlocks.length === 1) {
            // Only one block with this UID, keep as is but process its nested blocks
            const block = deepClone(sameUidBlocks[0]);
            // Recursively process nested blocks if they exist
            if ((block === null || block === void 0 ? void 0 : block.blocks) && Array.isArray(block === null || block === void 0 ? void 0 : block.blocks)) {
                block.blocks = mergeBlocksWithSameUid(block === null || block === void 0 ? void 0 : block.blocks);
            }
            // Also process schema if it contains blocks
            if (block === null || block === void 0 ? void 0 : block.schema) {
                if (Array.isArray(block === null || block === void 0 ? void 0 : block.schema)) {
                    // Check if schema array has multiple items with same contentstackFieldUid
                    block.schema = mergeBlocksWithSameUid(block === null || block === void 0 ? void 0 : block.schema);
                    // Then process each schema item's blocks
                    block.schema = (_a = block === null || block === void 0 ? void 0 : block.schema) === null || _a === void 0 ? void 0 : _a.map((schemaItem) => {
                        if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
                            return Object.assign(Object.assign({}, schemaItem), { blocks: mergeBlocksWithSameUid(schemaItem === null || schemaItem === void 0 ? void 0 : schemaItem.blocks) });
                        }
                        return schemaItem;
                    });
                }
                else if (typeof (block === null || block === void 0 ? void 0 : block.schema) === 'object' && ((_b = block === null || block === void 0 ? void 0 : block.schema) === null || _b === void 0 ? void 0 : _b.blocks) && Array.isArray((_c = block === null || block === void 0 ? void 0 : block.schema) === null || _c === void 0 ? void 0 : _c.blocks)) {
                    block.schema = Object.assign(Object.assign({}, block.schema), { blocks: mergeBlocksWithSameUid((_d = block === null || block === void 0 ? void 0 : block.schema) === null || _d === void 0 ? void 0 : _d.blocks) });
                }
            }
            mergedBlocks.push(block);
        }
        else {
            // Multiple blocks with same UID - merge them
            console.log(`  🔀 Merging ${sameUidBlocks.length} blocks with contentstackFieldUid/uid: "${key}"`);
            // Use first block as base
            const mergedBlock = deepClone(sameUidBlocks === null || sameUidBlocks === void 0 ? void 0 : sameUidBlocks[0]);
            // Collect all nested blocks from all instances
            const allNestedBlocks = [];
            const nestedBlockSignatures = new Set();
            sameUidBlocks === null || sameUidBlocks === void 0 ? void 0 : sameUidBlocks.forEach((block, index) => {
                console.log(`    Processing block ${index + 1}/${sameUidBlocks.length}`);
                if ((block === null || block === void 0 ? void 0 : block.blocks) && Array.isArray(block === null || block === void 0 ? void 0 : block.blocks)) {
                    block.blocks.forEach((nestedBlock) => {
                        // Track component type
                        const nestedType = nestedBlock.uid || nestedBlock.contentstackFieldUid || '';
                        if (nestedType) {
                            trackComponentType(nestedType);
                        }
                        // Create signature to avoid duplicates
                        const signature = createDetailedBlockSignature(nestedBlock);
                        if (!nestedBlockSignatures.has(signature)) {
                            nestedBlockSignatures.add(signature);
                            allNestedBlocks.push(deepClone(nestedBlock));
                            console.log(`      ✓ Added nested block: ${nestedType || 'unknown'}`);
                        }
                        else {
                            console.log(`      ✗ Skipped duplicate: ${nestedType || 'unknown'}`);
                        }
                    });
                }
            });
            // Set the merged blocks array and sort them
            if (allNestedBlocks.length > 0) {
                // Sort blocks for consistent ordering
                const sortedBlocks = sortComponentsByType(allNestedBlocks);
                // Recursively process the merged nested blocks
                mergedBlock.blocks = mergeBlocksWithSameUid(sortedBlocks);
                console.log(`    Result: 1 block with ${mergedBlock.blocks.length} unique nested blocks`);
            }
            // Also merge schema arrays if they exist
            const allSchemaItems = [];
            const schemaSignatures = new Set();
            sameUidBlocks.forEach(block => {
                if (block.schema && Array.isArray(block.schema)) {
                    block.schema.forEach((schemaItem) => {
                        const itemType = schemaItem.uid || schemaItem.contentstackFieldUid || '';
                        if (itemType) {
                            trackComponentType(itemType);
                        }
                        const signature = createDetailedSchemaSignature(schemaItem);
                        if (!schemaSignatures.has(signature)) {
                            schemaSignatures.add(signature);
                            allSchemaItems.push(deepClone(schemaItem));
                        }
                    });
                }
                else if (block.schema && typeof block.schema === 'object') {
                    // For object schema, merge if multiple blocks have it
                    const signature = createDetailedSchemaSignature(block.schema);
                    if (!schemaSignatures.has(signature)) {
                        schemaSignatures.add(signature);
                        if (!mergedBlock.schema) {
                            mergedBlock.schema = deepClone(block.schema);
                        }
                    }
                }
            });
            if (allSchemaItems.length > 0) {
                // Sort schema items and process recursively
                const sortedSchemaItems = sortSchemaItems(allSchemaItems);
                mergedBlock.schema = mergeBlocksWithSameUid(sortedSchemaItems);
                // Process each schema item's blocks
                mergedBlock.schema = mergedBlock.schema.map((schemaItem) => {
                    if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
                        return Object.assign(Object.assign({}, schemaItem), { blocks: mergeBlocksWithSameUid(schemaItem.blocks) });
                    }
                    return schemaItem;
                });
            }
            mergedBlocks.push(mergedBlock);
        }
    });
    return mergedBlocks;
}
/**
 * COMMENTED CODE - OLDER VERSION
 * Process a single block recursively
 */
// function processBlockRecursively(block: BlockItem): BlockItem {
//   const processedBlock = { ...block };
//   // Special handling for blocks with schema containing multiple containers at the same level
//   if (processedBlock.schema && Array.isArray(processedBlock.schema)) {
//     console.log(`  🔍 Processing schema array for ${processedBlock.uid || processedBlock.contentstackFieldUid}`);
//     // Use mergeBlocksWithSameUid for schema arrays
//     processedBlock.schema = mergeBlocksWithSameUid(processedBlock.schema);
//     // Then process each schema item recursively
//     processedBlock.schema = processedBlock.schema.map((schemaItem: any) => {
//       if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
//         return {
//           ...schemaItem,
//           blocks: mergeBlocksWithSameUid(schemaItem.blocks)
//         };
//       }
//       return schemaItem;
//     });
//   } else if (processedBlock.schema && typeof processedBlock.schema === 'object' && processedBlock.schema.blocks) {
//     // Schema is an object with blocks
//     const nestedBlocks = processedBlock.schema.blocks;
//     if (Array.isArray(nestedBlocks)) {
//       console.log(`  📂 Processing nested blocks in schema object`);
//       processedBlock.schema = {
//         ...processedBlock.schema,
//         blocks: mergeBlocksWithSameUid(nestedBlocks)
//       };
//     }
//   }
//   // If the block itself has blocks (another pattern)
//   if (processedBlock.blocks && Array.isArray(processedBlock.blocks)) {
//     console.log(`  📂 Processing blocks array in ${processedBlock.uid}`);
//     processedBlock.blocks = mergeBlocksWithSameUid(processedBlock.blocks);
//   }
//   return processedBlock;
// }
/**
 * Sort components dynamically based on their natural order in the data
 */
function sortComponentsByType(components) {
    // First, ensure all component types are tracked
    components.forEach(comp => {
        const type = comp.uid || comp.contentstackFieldUid || '';
        if (type) {
            trackComponentType(type);
        }
    });
    // Sort based on dynamic order
    return components.sort((a, b) => {
        const aType = (a.uid || a.contentstackFieldUid || '').toLowerCase();
        const bType = (b.uid || b.contentstackFieldUid || '').toLowerCase();
        const aCleanType = aType.includes('customembed') ? 'customembed' : aType;
        const bCleanType = bType.includes('customembed') ? 'customembed' : bType;
        const aIndex = dynamicTypeOrder.indexOf(aCleanType);
        const bIndex = dynamicTypeOrder.indexOf(bCleanType);
        // Both found in order - sort by position
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // Only one found - it comes first
        if (aIndex !== -1)
            return -1;
        if (bIndex !== -1)
            return 1;
        // Neither found - sort alphabetically
        return aCleanType.localeCompare(bCleanType);
    });
}
/**
 * Sort schema items dynamically
 */
function sortSchemaItems(items) {
    // Track types as they appear
    items.forEach(item => {
        const type = item.uid || item.contentstackFieldUid || '';
        if (type) {
            trackComponentType(type);
        }
    });
    return items.sort((a, b) => {
        const aType = (a.uid || a.contentstackFieldUid || '').toLowerCase();
        const bType = (b.uid || b.contentstackFieldUid || '').toLowerCase();
        const aCleanType = aType.includes('customembed') ? 'customembed' : aType;
        const bCleanType = bType.includes('customembed') ? 'customembed' : bType;
        const aIndex = dynamicTypeOrder.indexOf(aCleanType);
        const bIndex = dynamicTypeOrder.indexOf(bCleanType);
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        if (aIndex !== -1)
            return -1;
        if (bIndex !== -1)
            return 1;
        return aCleanType.localeCompare(bCleanType);
    });
}
/**
 * Create a detailed signature for a block
 */
function createDetailedBlockSignature(block) {
    const normalized = normalizeForSignature(block);
    return JSON.stringify(normalized);
}
/**
 * Create a detailed signature for schema items
 */
function createDetailedSchemaSignature(schemaItem) {
    if (!schemaItem)
        return '';
    // For objects with uid or contentstackFieldUid
    const uid = schemaItem.uid || schemaItem.contentstackFieldUid || '';
    // Create a signature based on the structure and content
    let signature = uid;
    if (schemaItem.schema) {
        if (Array.isArray(schemaItem.schema)) {
            // For array schemas, add field structure to signature
            const fieldSignatures = schemaItem.schema.map((field) => {
                var _a;
                const fieldUid = field.uid || field.contentstackFieldUid || '';
                const fieldType = field.contentstackFieldType || field.backupFieldType || '';
                const defaultValue = ((_a = field.advanced) === null || _a === void 0 ? void 0 : _a.default_value) || '';
                return `${fieldUid}_${fieldType}_${hashValue(defaultValue)}`;
            }).join('|');
            signature += `_${fieldSignatures}`;
        }
        else if (typeof schemaItem.schema === 'object') {
            signature += `_${JSON.stringify(schemaItem.schema).substring(0, 50)}`;
        }
    }
    if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
        // For items with blocks, add block structure to signature
        const blockSignatures = schemaItem.blocks.map((block) => block.uid || block.contentstackFieldUid || '').join('|');
        signature += `_blocks:${blockSignatures}`;
    }
    return signature;
}
/**
 * COMMENTED CODE - OLDER VERSION
 * Deduplicate blocks array
 */
// function deduplicateBlocks(blocks: BlockItem[]): BlockItem[] {
//   const uniqueBlocks = new Map<string, BlockItem>();
//   blocks.forEach(block => {
//     const signature = createDetailedBlockSignature(block);
//     if (!uniqueBlocks.has(signature)) {
//       uniqueBlocks.set(signature, block);
//     }
//   });
//   return Array.from(uniqueBlocks.values());
// }
/**
 * Normalize object for signature creation
 */
function normalizeForSignature(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => normalizeForSignature(item));
    }
    if (typeof obj === 'object') {
        const normalized = {};
        const keys = Object.keys(obj).sort();
        keys.forEach(key => {
            // Skip keys that shouldn't affect uniqueness
            if (key === 'id' || key === 'position' || key === 'index') {
                return;
            }
            normalized[key] = normalizeForSignature(obj[key]);
        });
        return normalized;
    }
    return obj;
}
/**
 * Hash value helper
 */
function hashValue(value) {
    if (value === null || value === undefined)
        return 'null';
    if (typeof value === 'string') {
        return value.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
    }
    if (typeof value === 'boolean')
        return value.toString();
    if (typeof value === 'number')
        return value.toString();
    return 'unknown';
}
/**
 * Merge multiple instances of the same content model
 */
function mergeMultipleInstances(instances) {
    const base = instances[0];
    const mergedFromIds = instances.map(inst => inst.id);
    // Create field position map
    const fieldPositionMap = new Map();
    // Analyze all instances
    instances.forEach((instance) => {
        instance.fieldMapping.forEach((field, position) => {
            if (field === null || field === undefined) {
                return;
            }
            const fieldKey = getFieldKey(field);
            if (!fieldPositionMap.has(fieldKey)) {
                fieldPositionMap.set(fieldKey, {
                    field: deepClone(field),
                    positions: []
                });
            }
            fieldPositionMap.get(fieldKey).positions.push(position);
            // Merge field properties
            const existingField = fieldPositionMap.get(fieldKey).field;
            mergeFieldProperties(existingField, field);
        });
    });
    // Calculate optimal positions
    const fieldsWithOptimalPosition = [];
    fieldPositionMap.forEach((data) => {
        // Process field with deep deduplication
        const processedField = processFieldDeep(data.field);
        const normalizedField = normalizeFieldUids(processedField);
        if (normalizedField) {
            const optimalPosition = calculateOptimalPosition(data.positions);
            fieldsWithOptimalPosition.push({
                field: normalizedField,
                position: optimalPosition
            });
        }
    });
    // Sort by position
    fieldsWithOptimalPosition.sort((a, b) => a.position - b.position);
    const mergedFieldMapping = fieldsWithOptimalPosition.map(item => item.field);
    console.log(`  Merged ${instances.length} instances`);
    console.log(`  Final field count: ${mergedFieldMapping.length}`);
    return {
        id: base.id,
        status: base.status,
        otherCmsTitle: base.otherCmsTitle,
        otherCmsUid: base.otherCmsUid,
        isUpdated: base.isUpdated,
        contentstackTitle: base.contentstackTitle,
        contentstackUid: base.contentstackUid,
        type: base.type,
        fieldMapping: mergedFieldMapping,
        mergedFromIds: mergedFromIds
    };
}
/**
 * Get unique key for a field
 */
function getFieldKey(field) {
    if (field.uid)
        return `uid:${field.uid}`;
    if (field.contentstackFieldUid)
        return `csuid:${field.contentstackFieldUid}`;
    if (field.id)
        return `id:${field.id}`;
    return `composite:${field.otherCmsField || ''}_${field.contentstackField || ''}`;
}
/**
 * Merge field properties
 */
function mergeFieldProperties(target, source) {
    Object.keys(source).forEach(key => {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (key === 'blocks' && Array.isArray(sourceValue)) {
            if (Array.isArray(targetValue)) {
                // Concatenate blocks arrays
                target[key] = [...targetValue, ...sourceValue];
            }
            else {
                target[key] = sourceValue;
            }
        }
        else if (sourceValue !== null && sourceValue !== undefined) {
            if (targetValue === null || targetValue === undefined) {
                target[key] = sourceValue;
            }
            else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                target[key] = mergeArraysUnique(targetValue, sourceValue);
            }
            else if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
                target[key] = deepMerge(targetValue, sourceValue);
            }
        }
    });
}
/**
 * Calculate optimal position
 */
function calculateOptimalPosition(positions) {
    if (positions.length === 0)
        return 0;
    if (positions.length === 1)
        return positions[0];
    const sorted = [...positions].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}
/**
 * Deep clone an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    if (obj instanceof Date)
        return new Date(obj.getTime());
    if (Array.isArray(obj))
        return obj.map(item => deepClone(item));
    const cloned = {};
    Object.keys(obj).forEach(key => {
        cloned[key] = deepClone(obj[key]);
    });
    return cloned;
}
/**
 * Merge arrays removing duplicates
 */
function mergeArraysUnique(arr1, arr2) {
    const merged = [...arr1];
    arr2.forEach(item => {
        const isDuplicate = merged.some(existing => JSON.stringify(existing) === JSON.stringify(item));
        if (!isDuplicate) {
            merged.push(item);
        }
    });
    return merged;
}
/**
 * Deep merge objects
 */
function deepMerge(target, source) {
    const result = Object.assign({}, target);
    Object.keys(source).forEach(key => {
        if (source[key] === null || source[key] === undefined) {
            return;
        }
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
                result[key] = deepMerge(result[key], source[key]);
            }
            else {
                result[key] = deepClone(source[key]);
            }
        }
        else if (Array.isArray(source[key])) {
            result[key] = Array.isArray(result[key]) ?
                mergeArraysUnique(result[key], source[key]) : deepClone(source[key]);
        }
        else {
            if (result[key] === null || result[key] === undefined) {
                result[key] = source[key];
            }
        }
    });
    return result;
}
