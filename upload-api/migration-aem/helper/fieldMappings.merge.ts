import { uidCorrector } from ".";

interface FieldMapping {
  id?: string;
  uid?: string;
  otherCmsField?: string;
  otherCmsType?: string;
  contentstackField?: string;
  contentstackFieldUid?: string;
  contentstackFieldType?: string;
  backupFieldType?: string;
  backupFieldUid?: string;
  isDeleted?: boolean;
  refrenceTo?: string[];
  blocks?: BlockItem[];
  schema?: any;
  advanced?: any;
  type?: string;
}

interface BlockItem {
  uid: string;
  otherCmsField?: string;
  contentstackField?: string;
  contentstackFieldUid?: string;
  backupFieldUid?: string;
  schema?: any;
  blocks?: BlockItem[];
}

interface ContentModel {
  id: string;
  status: number;
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  contentstackTitle: string;
  contentstackUid: string;
  type: string;
  fieldMapping: (FieldMapping | null)[];
}

interface MergedContentModel extends Omit<ContentModel, 'fieldMapping'> {
  fieldMapping: FieldMapping[];
  mergedFromIds: string[];
}

// Dynamic type order tracking
let dynamicTypeOrder: string[] = [];

function trackComponentType(type: string): void {
  const cleanType = type.toLowerCase().includes('customembed') ? 'customembed' : type.toLowerCase();
  if (!dynamicTypeOrder.includes(cleanType)) {
    dynamicTypeOrder.push(cleanType);
  }
}

/**
 * Apply uidCorrector to all contentstackFieldUid values in the field mapping
 */
function normalizeFieldUids(field: FieldMapping | undefined): FieldMapping | undefined {
  if (!field) return undefined;
  
  const normalized = { ...field };
  if (normalized.contentstackFieldUid) {
    normalized.contentstackFieldUid = uidCorrector(normalized.contentstackFieldUid);
  }
  
  // Also fix backupFieldUid if it exists
  if (normalized.backupFieldUid) {
    normalized.backupFieldUid = uidCorrector(normalized.backupFieldUid);
  }
  
  // Fix UIDs in blocks
  if (normalized.blocks && Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks
      .map(block => normalizeBlockUids(block))
      .filter(block => block !== undefined) as BlockItem[];
  }
  
  // Fix UIDs in schema
  if (normalized.schema) {
    if (Array.isArray(normalized.schema)) {
      normalized.schema = normalized.schema
        .map((schemaItem: any) => normalizeSchemaItemUids(schemaItem))
        .filter((item: any) => item !== undefined);
    } else if (typeof normalized.schema === 'object') {
      normalized.schema = normalizeSchemaItemUids(normalized.schema);
    }
  }
  
  return normalized;
}

/**
 * Normalize UIDs in a block item
 */
function normalizeBlockUids(block: BlockItem | undefined): BlockItem | undefined {
  if (!block) return undefined;
  
  const normalized = { ...block };
  
  // Fix the block's UID
  if (normalized.contentstackFieldUid) {
    normalized.contentstackFieldUid = uidCorrector(normalized.contentstackFieldUid);
  }
  
  // Fix backup UID
  if (normalized.backupFieldUid) {
    normalized.backupFieldUid = uidCorrector(normalized.backupFieldUid);
  }
  
  // Fix uid field (different from contentstackFieldUid)
  if (normalized.uid) {
    normalized.uid = uidCorrector(normalized.uid);
  }
  
  // Keep contentstackField unchanged
  
  if (normalized.blocks && Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks
      .map(b => normalizeBlockUids(b))
      .filter(b => b !== undefined) as BlockItem[];
  }
  
  if (normalized.schema) {
    if (Array.isArray(normalized.schema)) {
      normalized.schema = normalized.schema
        .map((item: any) => normalizeSchemaItemUids(item))
        .filter((item: any) => item !== undefined);
    } else if (typeof normalized.schema === 'object') {
      normalized.schema = normalizeSchemaItemUids(normalized.schema);
    }
  }
  
  return normalized;
}

/**
 * Normalize UIDs in a schema item
 */
function normalizeSchemaItemUids(schemaItem: any): any {
  if (!schemaItem || typeof schemaItem !== 'object') {
    return schemaItem;
  }
  
  const normalized = { ...schemaItem };
  if (normalized.contentstackFieldUid) {
    normalized.contentstackFieldUid = uidCorrector(normalized.contentstackFieldUid);
  }
  
  if (normalized.backupFieldUid) {
    normalized.backupFieldUid = uidCorrector(normalized.backupFieldUid);
  }
  
  if (normalized.uid) {
    normalized.uid = uidCorrector(normalized.uid);
  }
  
  if (normalized.blocks && Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks
      .map((b: any) => normalizeBlockUids(b))
      .filter((b: any) => b !== undefined);
  }
  
  if (normalized.schema) {
    if (Array.isArray(normalized.schema)) {
      normalized.schema = normalized.schema
        .map((item: any) => normalizeSchemaItemUids(item))
        .filter((item: any) => item !== undefined);
    } else if (typeof normalized.schema === 'object') {
      normalized.schema = normalizeSchemaItemUids(normalized.schema);
    }
  }
  
  return normalized;
}
/**
 * Main entry point for processing content models
 */
export function processContentModels(
  jsonData: ContentModel[] | MergedContentModel[]
): MergedContentModel[] {
  console.log('=== Starting Content Model Processing ===');
  console.log(`Processing ${jsonData.length} total content models`);

  // Reset dynamic type order for each processing run
  dynamicTypeOrder = [];

  // Check if data is already processed
  const isAlreadyProcessed = jsonData.length > 0 && 'mergedFromIds' in jsonData[0];

  if (isAlreadyProcessed) {
    console.log('Data appears to be already processed. Applying deep deduplication and container merging.');
    return (jsonData as MergedContentModel[]).map(model => ({
      ...model,
      fieldMapping: model.fieldMapping
        .map(field => {
          const processed = processFieldDeep(field);
          return normalizeFieldUids(processed);
        })
        .filter(field => field !== undefined) as FieldMapping[] 
    }));
  }

  const result = mergeContentModels(jsonData as ContentModel[]);

  console.log('\n=== Processing Complete ===');
  console.log(`Result: ${result.length} unique content models`);
  console.log(`Dynamic type order discovered: [${dynamicTypeOrder.join(', ')}]`);

  return result;
}

/**
 * Merges content models with the same contentstackUid
 */
function mergeContentModels(models: ContentModel[]): MergedContentModel[] {
  const groupedModels = new Map<string, ContentModel[]>();

  // Group by contentstackUid
  models.forEach(model => {
    const key = model.contentstackUid;
    if (!groupedModels.has(key)) {
      groupedModels.set(key, []);
    }
    groupedModels.get(key)!.push(model);
  });

  const mergedModels: MergedContentModel[] = [];

  // Process each group
  groupedModels.forEach((group, contentstackUid) => {
    console.log(`\nProcessing content type: ${contentstackUid} (${group.length} instances)`);

    if (group.length === 1) {
      // Single instance - just process blocks
      const singleModel = group[0];
      const processedFieldMapping = singleModel.fieldMapping
        .filter(f => f !== null && f !== undefined) 
        .map(field => {
          const processed = processFieldDeep(field as FieldMapping);
          return normalizeFieldUids(processed);
        })
        .filter(field => field !== undefined) as FieldMapping[]; 

      mergedModels.push({
        ...singleModel,
        fieldMapping: processedFieldMapping,
        mergedFromIds: [singleModel.id]
      });
    } else {
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
function processFieldDeep(field: FieldMapping): FieldMapping {
  // Process blocks at the top level
  if (field.blocks && Array.isArray(field.blocks)) {
    console.log(`\n📦 Processing field: ${field.uid || field.contentstackFieldUid}`);
    console.log(`  Initial blocks: ${field.blocks.length}`);

    const processedBlocks = mergeBlocksWithSameUid(field.blocks);

    console.log(`  Final blocks: ${processedBlocks.length}`);

    return {
      ...field,
      blocks: processedBlocks
    };
  }

  return field;
}

/**
 * Merges blocks with the same contentstackFieldUid at the same level in a blocks array
 * This function handles all the merging logic for blocks with same UIDs
 */
function mergeBlocksWithSameUid(blocks: any[]): any[] {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return blocks;
  }

  // Track component types as they appear
  blocks.forEach(block => {
    const type = block.uid || block.contentstackFieldUid || '';
    if (type) {
      trackComponentType(type);
    }
  });

  // Group blocks by contentstackFieldUid (or uid as fallback)
  const blockGroups = new Map<string, any[]>();
  const blockOrder: string[] = []; // Track order of first appearance

  blocks.forEach(block => {
    // Use contentstackFieldUid as the primary key for grouping, fallback to uid
    const key = block.contentstackFieldUid || block.uid || 'unknown';

    if (!blockGroups.has(key)) {
      blockGroups.set(key, []);
      blockOrder.push(key); // Track first appearance order
    }

    blockGroups.get(key)!.push(block);
  });

  // Result array
  const mergedBlocks: any[] = [];

  // Process each unique key in order of first appearance
  blockOrder.forEach(key => {
    const sameUidBlocks = blockGroups.get(key)!;

    if (sameUidBlocks.length === 1) {
      // Only one block with this UID, keep as is but process its nested blocks
      const block = deepClone(sameUidBlocks[0]);

      // Recursively process nested blocks if they exist
      if (block.blocks && Array.isArray(block.blocks)) {
        block.blocks = mergeBlocksWithSameUid(block.blocks);
      }

      // Also process schema if it contains blocks
      if (block.schema) {
        if (Array.isArray(block.schema)) {
          // Check if schema array has multiple items with same contentstackFieldUid
          block.schema = mergeBlocksWithSameUid(block.schema);

          // Then process each schema item's blocks
          block.schema = block.schema.map((schemaItem: any) => {
            if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
              return {
                ...schemaItem,
                blocks: mergeBlocksWithSameUid(schemaItem.blocks)
              };
            }
            return schemaItem;
          });
        } else if (typeof block.schema === 'object' && block.schema.blocks && Array.isArray(block.schema.blocks)) {
          block.schema = {
            ...block.schema,
            blocks: mergeBlocksWithSameUid(block.schema.blocks)
          };
        }
      }

      mergedBlocks.push(block);
    } else {
      // Multiple blocks with same UID - merge them
      console.log(`  🔀 Merging ${sameUidBlocks.length} blocks with contentstackFieldUid/uid: "${key}"`);

      // Use first block as base
      const mergedBlock = deepClone(sameUidBlocks[0]);

      // Collect all nested blocks from all instances
      const allNestedBlocks: any[] = [];
      const nestedBlockSignatures = new Set<string>();

      sameUidBlocks.forEach((block, index) => {
        console.log(`    Processing block ${index + 1}/${sameUidBlocks.length}`);

        if (block.blocks && Array.isArray(block.blocks)) {
          block.blocks.forEach((nestedBlock: any) => {
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
            } else {
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
      const allSchemaItems: any[] = [];
      const schemaSignatures = new Set<string>();

      sameUidBlocks.forEach(block => {
        if (block.schema && Array.isArray(block.schema)) {
          block.schema.forEach((schemaItem: any) => {
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
        } else if (block.schema && typeof block.schema === 'object') {
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
        mergedBlock.schema = mergedBlock.schema.map((schemaItem: any) => {
          if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
            return {
              ...schemaItem,
              blocks: mergeBlocksWithSameUid(schemaItem.blocks)
            };
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
function sortComponentsByType(components: any[]): any[] {
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
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // Neither found - sort alphabetically
    return aCleanType.localeCompare(bCleanType);
  });
}

/**
 * Sort schema items dynamically
 */
function sortSchemaItems(items: any[]): any[] {
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

    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    return aCleanType.localeCompare(bCleanType);
  });
}

/**
 * Create a detailed signature for a block
 */
function createDetailedBlockSignature(block: any): string {
  const normalized = normalizeForSignature(block);
  return JSON.stringify(normalized);
}

/**
 * Create a detailed signature for schema items
 */
function createDetailedSchemaSignature(schemaItem: any): string {
  if (!schemaItem) return '';

  // For objects with uid or contentstackFieldUid
  const uid = schemaItem.uid || schemaItem.contentstackFieldUid || '';

  // Create a signature based on the structure and content
  let signature = uid;

  if (schemaItem.schema) {
    if (Array.isArray(schemaItem.schema)) {
      // For array schemas, add field structure to signature
      const fieldSignatures = schemaItem.schema.map((field: any) => {
        const fieldUid = field.uid || field.contentstackFieldUid || '';
        const fieldType = field.contentstackFieldType || field.backupFieldType || '';
        const defaultValue = field.advanced?.default_value || '';
        return `${fieldUid}_${fieldType}_${hashValue(defaultValue)}`;
      }).join('|');
      signature += `_${fieldSignatures}`;
    } else if (typeof schemaItem.schema === 'object') {
      signature += `_${JSON.stringify(schemaItem.schema).substring(0, 50)}`;
    }
  }

  if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
    // For items with blocks, add block structure to signature
    const blockSignatures = schemaItem.blocks.map((block: any) =>
      block.uid || block.contentstackFieldUid || ''
    ).join('|');
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
function normalizeForSignature(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeForSignature(item));
  }

  if (typeof obj === 'object') {
    const normalized: any = {};
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
function hashValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    return value.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
  }
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  return 'unknown';
}

/**
 * Merge multiple instances of the same content model
 */
function mergeMultipleInstances(instances: ContentModel[]): MergedContentModel {
  const base = instances[0];
  const mergedFromIds = instances.map(inst => inst.id);

  // Create field position map
  const fieldPositionMap = new Map<string, { field: FieldMapping, positions: number[] }>();

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

      fieldPositionMap.get(fieldKey)!.positions.push(position);

      // Merge field properties
      const existingField = fieldPositionMap.get(fieldKey)!.field;
      mergeFieldProperties(existingField, field);
    });
  });

  // Calculate optimal positions
  const fieldsWithOptimalPosition: Array<{ field: FieldMapping, position: number }> = [];

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
function getFieldKey(field: FieldMapping): string {
  if (field.uid) return `uid:${field.uid}`;
  if (field.contentstackFieldUid) return `csuid:${field.contentstackFieldUid}`;
  if (field.id) return `id:${field.id}`;
  return `composite:${field.otherCmsField || ''}_${field.contentstackField || ''}`;
}

/**
 * Merge field properties
 */
function mergeFieldProperties(target: FieldMapping, source: FieldMapping): void {
  Object.keys(source).forEach(key => {
    const sourceValue = (source as any)[key];
    const targetValue = (target as any)[key];

    if (key === 'blocks' && Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        // Concatenate blocks arrays
        (target as any)[key] = [...targetValue, ...sourceValue];
      } else {
        (target as any)[key] = sourceValue;
      }
    } else if (sourceValue !== null && sourceValue !== undefined) {
      if (targetValue === null || targetValue === undefined) {
        (target as any)[key] = sourceValue;
      } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        (target as any)[key] = mergeArraysUnique(targetValue, sourceValue);
      } else if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
        (target as any)[key] = deepMerge(targetValue, sourceValue);
      }
    }
  });
}

/**
 * Calculate optimal position
 */
function calculateOptimalPosition(positions: number[]): number {
  if (positions.length === 0) return 0;
  if (positions.length === 1) return positions[0];

  const sorted = [...positions].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

  const cloned = {} as T;
  Object.keys(obj).forEach(key => {
    (cloned as any)[key] = deepClone((obj as any)[key]);
  });
  return cloned;
}

/**
 * Merge arrays removing duplicates
 */
function mergeArraysUnique(arr1: any[], arr2: any[]): any[] {
  const merged = [...arr1];

  arr2.forEach(item => {
    const isDuplicate = merged.some(existing =>
      JSON.stringify(existing) === JSON.stringify(item)
    );

    if (!isDuplicate) {
      merged.push(item);
    }
  });

  return merged;
}

/**
 * Deep merge objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  Object.keys(source).forEach(key => {
    if (source[key] === null || source[key] === undefined) {
      return;
    }

    if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = deepClone(source[key]);
      }
    } else if (Array.isArray(source[key])) {
      result[key] = Array.isArray(result[key]) ?
        mergeArraysUnique(result[key], source[key]) : deepClone(source[key]);
    } else {
      if (result[key] === null || result[key] === undefined) {
        result[key] = source[key];
      }
    }
  });

  return result;
}