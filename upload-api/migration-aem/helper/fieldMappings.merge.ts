// // interface FieldMapping {
// //   id?: string;
// //   uid?: string;
// //   otherCmsField?: string;
// //   otherCmsType?: string;
// //   contentstackField?: string;
// //   contentstackFieldUid?: string;
// //   contentstackFieldType?: string;
// //   backupFieldType?: string;
// //   backupFieldUid?: string;
// //   isDeleted?: boolean;
// //   refrenceTo?: string[];
// //   blocks?: any[];
// //   schema?: any;
// //   advanced?: any;
// //   type?: string;
// // }

// // interface ContentModel {
// //   id: string;
// //   status: number;
// //   otherCmsTitle: string;
// //   otherCmsUid: string;
// //   isUpdated: boolean;
// //   contentstackTitle: string;
// //   contentstackUid: string;
// //   type: string;
// //   fieldMapping: (FieldMapping | null)[];
// // }

// // interface MergedContentModel extends Omit<ContentModel, 'fieldMapping'> {
// //   fieldMapping: FieldMapping[];
// //   mergedFromIds: string[]; // Track which original IDs were merged
// // }

// // /**
// //  * Merges content models with the same contentstackUid
// //  * Handles null values, preserves field positions, and removes duplicates
// //  */
// // function mergeContentModels(models: ContentModel[]): MergedContentModel[] {
// //   // Group models by contentstackUid
// //   const groupedModels = new Map<string, ContentModel[]>();

// //   models.forEach(model => {
// //     const key = model.contentstackUid;
// //     if (!groupedModels.has(key)) {
// //       groupedModels.set(key, []);
// //     }
// //     groupedModels.get(key)!.push(model);
// //   });

// //   const mergedModels: MergedContentModel[] = [];

// //   // Process each group
// //   groupedModels.forEach((group, contentstackUid) => {
// //     console.log(`Processing content type: ${contentstackUid} with ${group.length} instances`);

// //     if (group.length === 1) {
// //       // No merge needed - single instance
// //       const singleModel = group[0];
// //       mergedModels.push({
// //         ...singleModel,
// //         fieldMapping: singleModel.fieldMapping.filter(f => f !== null) as FieldMapping[],
// //         mergedFromIds: [singleModel.id]
// //       });
// //     } else {
// //       // Multiple instances - need to merge
// //       const merged = mergeMultipleInstances(group);
// //       mergedModels.push(merged);
// //     }
// //   });

// //   return mergedModels;
// // }

// // /**
// //  * Merges multiple instances of the same content model
// //  * Intelligently handles field positions and null values
// //  */
// // function mergeMultipleInstances(instances: ContentModel[]): MergedContentModel {
// //   // Start with the first instance as base
// //   const base = instances[0];

// //   // Track all IDs that were merged
// //   const mergedFromIds = instances.map(inst => inst.id);

// //   // Create a position map to understand field ordering
// //   const fieldPositionMap = new Map<string, { field: FieldMapping, positions: number[] }>();

// //   // Analyze all instances to understand field positions
// //   instances.forEach((instance, instanceIndex) => {
// //     instance.fieldMapping.forEach((field, position) => {
// //       if (field === null) {
// //         // Track null positions for gap analysis
// //         console.log(`Found null at position ${position} in instance ${instanceIndex} (${instance.id})`);
// //         return;
// //       }

// //       const fieldKey = getFieldKey(field);

// //       if (!fieldPositionMap.has(fieldKey)) {
// //         fieldPositionMap.set(fieldKey, {
// //           field: deepClone(field),
// //           positions: []
// //         });
// //       }

// //       // Record this field's position in this instance
// //       fieldPositionMap.get(fieldKey)!.positions.push(position);

// //       // Merge field properties (in case there are differences)
// //       const existingField = fieldPositionMap.get(fieldKey)!.field;
// //       mergeFieldProperties(existingField, field);
// //     });
// //   });

// //   // Calculate optimal position for each field based on all occurrences
// //   const fieldsWithOptimalPosition: Array<{ field: FieldMapping, position: number }> = [];

// //   fieldPositionMap.forEach((data) => {
// //     // Calculate the most common position or average position
// //     const optimalPosition = calculateOptimalPosition(data.positions);
// //     fieldsWithOptimalPosition.push({
// //       field: data.field,
// //       position: optimalPosition
// //     });
// //   });

// //   // Sort by optimal position to maintain logical field order
// //   fieldsWithOptimalPosition.sort((a, b) => a.position - b.position);

// //   // Extract just the fields in the correct order
// //   const mergedFieldMapping = fieldsWithOptimalPosition.map(item => item.field);

// //   // Log the merge result
// //   console.log(`\nMerged ${instances.length} instances of ${base.contentstackUid}:`);
// //   console.log(`- Original field counts: ${instances.map(i => i.fieldMapping.filter(f => f !== null).length).join(', ')}`);
// //   console.log(`- Merged field count: ${mergedFieldMapping.length}`);

// //   return {
// //     id: base.id, // Keep the first ID as primary
// //     status: base.status,
// //     otherCmsTitle: base.otherCmsTitle,
// //     otherCmsUid: base.otherCmsUid,
// //     isUpdated: base.isUpdated,
// //     contentstackTitle: base.contentstackTitle,
// //     contentstackUid: base.contentstackUid,
// //     type: base.type,
// //     fieldMapping: mergedFieldMapping,
// //     mergedFromIds: mergedFromIds
// //   };
// // }

// // /**
// //  * Creates a unique key for a field to identify duplicates
// //  */
// // function getFieldKey(field: FieldMapping): string {
// //   // Use uid as primary identifier, fall back to other properties
// //   if (field.uid) return `uid:${field.uid}`;
// //   if (field.contentstackFieldUid) return `csuid:${field.contentstackFieldUid}`;
// //   if (field.id) return `id:${field.id}`;

// //   // For complex fields, create a composite key
// //   return `composite:${field.otherCmsField || ''}_${field.contentstackField || ''}`;
// // }

// // /**
// //  * Merges properties from source field into target field
// //  * Preserves non-null values and merges arrays
// //  */
// // function mergeFieldProperties(target: FieldMapping, source: FieldMapping): void {
// //   // Merge simple properties - prefer non-null values
// //   Object.keys(source).forEach(key => {
// //     const sourceValue = (source as any)[key];
// //     const targetValue = (target as any)[key];

// //     if (sourceValue !== null && sourceValue !== undefined) {
// //       if (targetValue === null || targetValue === undefined) {
// //         (target as any)[key] = sourceValue;
// //       } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
// //         // Merge arrays (e.g., refrenceTo, blocks)
// //         (target as any)[key] = mergeArrays(targetValue, sourceValue);
// //       } else if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
// //         // Deep merge objects (e.g., schema, advanced)
// //         (target as any)[key] = deepMerge(targetValue, sourceValue);
// //       }
// //       // For primitive values, keep the target value (first occurrence)
// //     }
// //   });
// // }

// // /**
// //  * Calculates the optimal position for a field based on its positions across instances
// //  */
// // function calculateOptimalPosition(positions: number[]): number {
// //   if (positions.length === 0) return 0;
// //   if (positions.length === 1) return positions[0];

// //   // Use the most frequent position, or the median if all are different
// //   const frequencyMap = new Map<number, number>();
// //   positions.forEach(pos => {
// //     frequencyMap.set(pos, (frequencyMap.get(pos) || 0) + 1);
// //   });

// //   // Find the most frequent position
// //   let maxFreq = 0;
// //   let optimalPos = positions[0];

// //   frequencyMap.forEach((freq, pos) => {
// //     if (freq > maxFreq) {
// //       maxFreq = freq;
// //       optimalPos = pos;
// //     }
// //   });

// //   // If all positions are equally frequent, use the median
// //   if (maxFreq === 1) {
// //     const sorted = [...positions].sort((a, b) => a - b);
// //     optimalPos = sorted[Math.floor(sorted.length / 2)];
// //   }

// //   return optimalPos;
// // }

// // /**
// //  * Deep clones an object
// //  */
// // function deepClone<T>(obj: T): T {
// //   if (obj === null || typeof obj !== 'object') return obj;
// //   if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
// //   if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

// //   const cloned = {} as T;
// //   Object.keys(obj).forEach(key => {
// //     (cloned as any)[key] = deepClone((obj as any)[key]);
// //   });
// //   return cloned;
// // }

// // /**
// //  * Merges two arrays, removing duplicates based on object equality
// //  */
// // function mergeArrays(arr1: any[], arr2: any[]): any[] {
// //   const merged = [...arr1];

// //   arr2.forEach(item => {
// //     const isDuplicate = merged.some(existing =>
// //       JSON.stringify(existing) === JSON.stringify(item)
// //     );

// //     if (!isDuplicate) {
// //       merged.push(item);
// //     }
// //   });

// //   return merged;
// // }

// // /**
// //  * Deep merges two objects
// //  */
// // function deepMerge(target: any, source: any): any {
// //   const result = { ...target };

// //   Object.keys(source).forEach(key => {
// //     if (source[key] === null || source[key] === undefined) {
// //       // Skip null/undefined values from source
// //       return;
// //     }

// //     if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
// //       if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
// //         result[key] = deepMerge(result[key], source[key]);
// //       } else {
// //         result[key] = deepClone(source[key]);
// //       }
// //     } else if (Array.isArray(source[key])) {
// //       result[key] = Array.isArray(result[key]) ?
// //         mergeArrays(result[key], source[key])
// //         : deepClone(source[key]);
// //     } else {
// //       // For primitive values, prefer source if target is null/undefined
// //       if (result[key] === null || result[key] === undefined) {
// //         result[key] = source[key];
// //       }
// //     }
// //   });

// //   return result;
// // }

// // /**
// //  * Main function to process the JSON data
// //  */
// // export function processContentModels(jsonData: ContentModel[]): MergedContentModel[] {
// //   return mergeContentModels(jsonData);
// // }

// interface FieldMapping {
//   id?: string;
//   uid?: string;
//   otherCmsField?: string;
//   otherCmsType?: string;
//   contentstackField?: string;
//   contentstackFieldUid?: string;
//   contentstackFieldType?: string;
//   backupFieldType?: string;
//   backupFieldUid?: string;
//   isDeleted?: boolean;
//   refrenceTo?: string[];
//   blocks?: BlockItem[];
//   schema?: any;
//   advanced?: any;
//   type?: string;
// }

// interface BlockItem {
//   uid: string;
//   otherCmsField?: string;
//   contentstackField?: string;
//   contentstackFieldUid?: string;
//   backupFieldUid?: string;
//   schema?: any;
// }

// interface ContentModel {
//   id: string;
//   status: number;
//   otherCmsTitle: string;
//   otherCmsUid: string;
//   isUpdated: boolean;
//   contentstackTitle: string;
//   contentstackUid: string;
//   type: string;
//   fieldMapping: (FieldMapping | null)[];
// }

// interface MergedContentModel extends Omit<ContentModel, 'fieldMapping'> {
//   fieldMapping: FieldMapping[];
//   mergedFromIds: string[];
// }

// /**
//  * Main entry point for processing content models
//  */
// export function processContentModels(
//   jsonData: ContentModel[] | MergedContentModel[]
// ): MergedContentModel[] {
//   console.log('=== Starting Content Model Processing ===');
//   console.log(`Processing ${jsonData.length} total content models`);

//   // Check if data is already processed
//   const isAlreadyProcessed = jsonData.length > 0 && 'mergedFromIds' in jsonData[0];

//   if (isAlreadyProcessed) {
//     console.log('Data appears to be already processed. Applying container merging only.');
//     return (jsonData as MergedContentModel[]).map(model => ({
//       ...model,
//       fieldMapping: model.fieldMapping.map(field => processFieldWithFullContainerMerge(field))
//     }));
//   }

//   const result = mergeContentModels(jsonData as ContentModel[]);

//   console.log('\n=== Processing Complete ===');
//   console.log(`Result: ${result.length} unique content models`);

//   // Log summary
//   result.forEach(model => {
//     const totalBlocks = model.fieldMapping.reduce((acc, field) => {
//       return acc + (field.blocks ? field.blocks.length : 0);
//     }, 0);

//     if (totalBlocks > 0) {
//       console.log(`✅ ${model.contentstackUid}: ${totalBlocks} total blocks after processing`);
//     }
//   });

//   return result;
// }

// /**
//  * Merges content models with the same contentstackUid
//  */
// function mergeContentModels(models: ContentModel[]): MergedContentModel[] {
//   const groupedModels = new Map<string, ContentModel[]>();

//   // Group by contentstackUid
//   models.forEach(model => {
//     const key = model.contentstackUid;
//     if (!groupedModels.has(key)) {
//       groupedModels.set(key, []);
//     }
//     groupedModels.get(key)!.push(model);
//   });

//   const mergedModels: MergedContentModel[] = [];

//   // Process each group
//   groupedModels.forEach((group, contentstackUid) => {
//     console.log(`\nProcessing content type: ${contentstackUid} (${group.length} instances)`);

//     if (group.length === 1) {
//       // Single instance - just process blocks
//       const singleModel = group[0];
//       const processedFieldMapping = singleModel.fieldMapping
//         .filter(f => f !== null)
//         .map(field => processFieldWithFullContainerMerge(field as FieldMapping));

//       mergedModels.push({
//         ...singleModel,
//         fieldMapping: processedFieldMapping,
//         mergedFromIds: [singleModel.id]
//       });
//     } else {
//       // Multiple instances - merge them
//       const merged = mergeMultipleInstances(group);
//       mergedModels.push(merged);
//     }
//   });

//   return mergedModels;
// }

// /**
//  * Process field and merge ALL containers into ONE
//  */
// function processFieldWithFullContainerMerge(field: FieldMapping): FieldMapping {
//   if (!field.blocks || !Array.isArray(field.blocks)) {
//     return field;
//   }

//   console.log(`\n📦 Processing field: ${field.uid || field.contentstackFieldUid}`);
//   console.log(`  Initial blocks: ${field.blocks.length}`);

//   // Step 1: Separate containers from other blocks
//   const containers: BlockItem[] = [];
//   const otherBlocks: BlockItem[] = [];

//   field.blocks.forEach(block => {
//     if (block.uid === 'container' && block.schema) {
//       containers.push(block);
//     } else {
//       otherBlocks.push(block);
//     }
//   });

//   console.log(`  Found ${containers.length} containers and ${otherBlocks.length} other blocks`);

//   // Step 2: Merge ALL containers into ONE
//   let finalBlocks: BlockItem[] = [];

//   if (containers.length > 0) {
//     console.log(`  🔀 Merging ${containers.length} containers into 1`);
//     const mergedContainer = mergeAllContainersIntoOne(containers);
//     finalBlocks.push(mergedContainer);
//   }

//   // Step 3: Add non-container blocks (deduplicated)
//   const uniqueOtherBlocks = deduplicateBlocks(otherBlocks);
//   finalBlocks = [...finalBlocks, ...uniqueOtherBlocks];

//   console.log(`  Final blocks: ${finalBlocks.length}`);

//   return {
//     ...field,
//     blocks: finalBlocks
//   };
// }

// /**
//  * Merge ALL containers into a single container with all components
//  */
// function mergeAllContainersIntoOne(containers: BlockItem[]): BlockItem {
//   console.log(`    Merging ${containers.length} containers...`);

//   if (containers.length === 1) {
//     // Single container - just deduplicate its components
//     return {
//       ...containers[0],
//       schema: deduplicateComponentsInSchema(containers[0].schema || [])
//     };
//   }

//   // Use first container as base
//   const baseContainer = deepClone(containers[0]);

//   // Collect all unique components from all containers
//   const allComponents: any[] = [];
//   const componentSignatures = new Set<string>();

//   containers.forEach((container, containerIndex) => {
//     console.log(`    Processing container ${containerIndex + 1}/${containers.length}`);

//     if (!container.schema || !Array.isArray(container.schema)) {
//       return;
//     }

//     container.schema.forEach(component => {
//       const signature = createDetailedComponentSignature(component);

//       // Add component if it's unique
//       if (!componentSignatures.has(signature)) {
//         componentSignatures.add(signature);
//         allComponents.push(deepClone(component));
//         console.log(`      ✓ Added component: ${component.uid || component.contentstackFieldUid}`);
//       } else {
//         console.log(`      ✗ Skipped duplicate: ${component.uid || component.contentstackFieldUid}`);
//       }
//     });
//   });

//   // Sort components by type for logical ordering
//   const sortedComponents = sortComponentsByType(allComponents);

//   console.log(`    Result: ${sortedComponents.length} unique components in merged container`);

//   return {
//     uid: 'container',
//     otherCmsField: baseContainer.otherCmsField || 'container',
//     contentstackField: baseContainer.contentstackField || 'container',
//     contentstackFieldUid: baseContainer.contentstackFieldUid || 'container',
//     backupFieldUid: baseContainer.backupFieldUid || 'container',
//     schema: sortedComponents
//   };
// }

// /**
//  * Deduplicate components within a schema
//  */
// function deduplicateComponentsInSchema(schema: any[]): any[] {
//   const uniqueComponents = new Map<string, any>();

//   schema.forEach(component => {
//     const signature = createDetailedComponentSignature(component);
//     if (!uniqueComponents.has(signature)) {
//       uniqueComponents.set(signature, component);
//     }
//   });

//   return sortComponentsByType(Array.from(uniqueComponents.values()));
// }

// /**
//  * Sort components by their type for consistent ordering
//  */
// function sortComponentsByType(components: any[]): any[] {
//   const typeOrder = [
//     'title',
//     'teaser',
//     'textbanner',
//     'image',
//     'text',
//     'carousel',
//     'spacer',
//     'productlisting',
//     'button',
//     'customembed'
//   ];

//   return components.sort((a, b) => {
//     const aType = (a.uid || a.contentstackFieldUid || '').toLowerCase();
//     const bType = (b.uid || b.contentstackFieldUid || '').toLowerCase();

//     // Handle customembed special case
//     const aCleanType = aType.includes('customembed') ? 'customembed' : aType;
//     const bCleanType = bType.includes('customembed') ? 'customembed' : bType;

//     const aIndex = typeOrder.indexOf(aCleanType);
//     const bIndex = typeOrder.indexOf(bCleanType);

//     // If both are in the order list, sort by order
//     if (aIndex !== -1 && bIndex !== -1) {
//       return aIndex - bIndex;
//     }

//     // If only one is in the list, it comes first
//     if (aIndex !== -1) return -1;
//     if (bIndex !== -1) return 1;

//     // Otherwise, sort alphabetically
//     return aCleanType.localeCompare(bCleanType);
//   });
// }

// /**
//  * Create a detailed signature for component comparison
//  * This ensures we properly identify duplicates
//  */
// function createDetailedComponentSignature(component: any): string {
//   if (!component) return '';

//   // Extract the component type
//   const uid = component.uid || component.contentstackFieldUid || '';

//   // For simple components without schema
//   if (!component.schema) {
//     return `${uid}_simple`;
//   }

//   // For complex components with schema
//   let schemaSignature = '';

//   if (Array.isArray(component.schema)) {
//     // For array schemas, create signature from field structure
//     schemaSignature = component.schema.map((field: any) => {
//       if (typeof field === 'object') {
//         // Get key fields that define uniqueness
//         const fieldUid = field.uid || field.contentstackFieldUid || '';
//         const fieldType = field.contentstackFieldType || field.backupFieldType || '';
//         const defaultValue = field.advanced?.default_value || '';

//         // Create a unique identifier for this field
//         return `${fieldUid}_${fieldType}_${hashValue(defaultValue)}`;
//       }
//       return 'unknown';
//     }).join('|');
//   } else if (typeof component.schema === 'object') {
//     // For object schemas, use key properties
//     const keys = Object.keys(component.schema).sort();
//     schemaSignature = keys.join('_');
//   }

//   return `${uid}_${schemaSignature}`;
// }

// /**
//  * Simple hash function for values
//  */
// function hashValue(value: any): string {
//   if (value === null || value === undefined) return 'null';
//   if (typeof value === 'string') {
//     // Return first 10 chars of string or full if shorter
//     return value.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
//   }
//   if (typeof value === 'boolean') return value.toString();
//   if (typeof value === 'number') return value.toString();
//   if (typeof value === 'object') return 'obj';
//   return 'unknown';
// }

// /**
//  * Deduplicate blocks array
//  */
// function deduplicateBlocks(blocks: BlockItem[]): BlockItem[] {
//   const uniqueBlocks = new Map<string, BlockItem>();

//   blocks.forEach(block => {
//     const signature = createBlockSignature(block);
//     if (!uniqueBlocks.has(signature)) {
//       uniqueBlocks.set(signature, block);
//     }
//   });

//   return Array.from(uniqueBlocks.values());
// }

// /**
//  * Create a signature for a block
//  */
// function createBlockSignature(block: any): string {
//   const normalized = normalizeForSignature(block);
//   return JSON.stringify(normalized);
// }

// /**
//  * Normalize object for signature creation
//  */
// function normalizeForSignature(obj: any): any {
//   if (obj === null || obj === undefined) return obj;

//   if (Array.isArray(obj)) {
//     return obj.map(item => normalizeForSignature(item));
//   }

//   if (typeof obj === 'object') {
//     const normalized: any = {};
//     const keys = Object.keys(obj).sort();

//     keys.forEach(key => {
//       // Skip keys that shouldn't affect uniqueness
//       if (key === 'id' || key === 'position' || key === 'index') {
//         return;
//       }
//       normalized[key] = normalizeForSignature(obj[key]);
//     });

//     return normalized;
//   }

//   return obj;
// }

// /**
//  * Merge multiple instances of the same content model
//  */
// function mergeMultipleInstances(instances: ContentModel[]): MergedContentModel {
//   const base = instances[0];
//   const mergedFromIds = instances.map(inst => inst.id);

//   // Create field position map
//   const fieldPositionMap = new Map<string, { field: FieldMapping, positions: number[] }>();

//   // Analyze all instances
//   instances.forEach((instance, instanceIndex) => {
//     instance.fieldMapping.forEach((field, position) => {
//       if (field === null) {
//         return;
//       }

//       const fieldKey = getFieldKey(field);

//       if (!fieldPositionMap.has(fieldKey)) {
//         fieldPositionMap.set(fieldKey, {
//           field: deepClone(field),
//           positions: []
//         });
//       }

//       fieldPositionMap.get(fieldKey)!.positions.push(position);

//       // Merge field properties
//       const existingField = fieldPositionMap.get(fieldKey)!.field;
//       mergeFieldProperties(existingField, field);
//     });
//   });

//   // Calculate optimal positions
//   const fieldsWithOptimalPosition: Array<{ field: FieldMapping, position: number }> = [];

//   fieldPositionMap.forEach((data) => {
//     // Process field with container merging
//     const processedField = processFieldWithFullContainerMerge(data.field);
//     const optimalPosition = calculateOptimalPosition(data.positions);

//     fieldsWithOptimalPosition.push({
//       field: processedField,
//       position: optimalPosition
//     });
//   });

//   // Sort by position
//   fieldsWithOptimalPosition.sort((a, b) => a.position - b.position);

//   const mergedFieldMapping = fieldsWithOptimalPosition.map(item => item.field);

//   console.log(`  Merged ${instances.length} instances`);
//   console.log(`  Final field count: ${mergedFieldMapping.length}`);

//   return {
//     id: base.id,
//     status: base.status,
//     otherCmsTitle: base.otherCmsTitle,
//     otherCmsUid: base.otherCmsUid,
//     isUpdated: base.isUpdated,
//     contentstackTitle: base.contentstackTitle,
//     contentstackUid: base.contentstackUid,
//     type: base.type,
//     fieldMapping: mergedFieldMapping,
//     mergedFromIds: mergedFromIds
//   };
// }

// /**
//  * Get unique key for a field
//  */
// function getFieldKey(field: FieldMapping): string {
//   if (field.uid) return `uid:${field.uid}`;
//   if (field.contentstackFieldUid) return `csuid:${field.contentstackFieldUid}`;
//   if (field.id) return `id:${field.id}`;
//   return `composite:${field.otherCmsField || ''}_${field.contentstackField || ''}`;
// }

// /**
//  * Merge field properties
//  */
// function mergeFieldProperties(target: FieldMapping, source: FieldMapping): void {
//   Object.keys(source).forEach(key => {
//     const sourceValue = (source as any)[key];
//     const targetValue = (target as any)[key];

//     if (key === 'blocks' && Array.isArray(sourceValue)) {
//       if (Array.isArray(targetValue)) {
//         // Concatenate blocks arrays - they'll be processed later
//         (target as any)[key] = [...targetValue, ...sourceValue];
//       } else {
//         (target as any)[key] = sourceValue;
//       }
//     } else if (sourceValue !== null && sourceValue !== undefined) {
//       if (targetValue === null || targetValue === undefined) {
//         (target as any)[key] = sourceValue;
//       } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
//         (target as any)[key] = mergeArraysUnique(targetValue, sourceValue);
//       } else if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
//         (target as any)[key] = deepMerge(targetValue, sourceValue);
//       }
//     }
//   });
// }

// /**
//  * Calculate optimal position
//  */
// function calculateOptimalPosition(positions: number[]): number {
//   if (positions.length === 0) return 0;
//   if (positions.length === 1) return positions[0];

//   const sorted = [...positions].sort((a, b) => a - b);
//   return sorted[Math.floor(sorted.length / 2)];
// }

// /**
//  * Deep clone an object
//  */
// function deepClone<T>(obj: T): T {
//   if (obj === null || typeof obj !== 'object') return obj;
//   if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
//   if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

//   const cloned = {} as T;
//   Object.keys(obj).forEach(key => {
//     (cloned as any)[key] = deepClone((obj as any)[key]);
//   });
//   return cloned;
// }

// /**
//  * Merge arrays removing duplicates
//  */
// function mergeArraysUnique(arr1: any[], arr2: any[]): any[] {
//   const merged = [...arr1];

//   arr2.forEach(item => {
//     const isDuplicate = merged.some(existing =>
//       JSON.stringify(existing) === JSON.stringify(item)
//     );

//     if (!isDuplicate) {
//       merged.push(item);
//     }
//   });

//   return merged;
// }

// /**
//  * Deep merge objects
//  */
// function deepMerge(target: any, source: any): any {
//   const result = { ...target };

//   Object.keys(source).forEach(key => {
//     if (source[key] === null || source[key] === undefined) {
//       return;
//     }

//     if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
//       if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
//         result[key] = deepMerge(result[key], source[key]);
//       } else {
//         result[key] = deepClone(source[key]);
//       }
//     } else if (Array.isArray(source[key])) {
//       result[key] = Array.isArray(result[key]) ?
//         mergeArraysUnique(result[key], source[key]) : deepClone(source[key]);
//     } else {
//       if (result[key] === null || result[key] === undefined) {
//         result[key] = source[key];
//       }
//     }
//   });

//   return result;
// }

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
  blocks?: BlockItem[]; // Added to handle nested blocks
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

/**
 * Dynamically build type order based on first occurrence in data
 */
let dynamicTypeOrder: string[] = [];

/**
 * Track component types as they appear in the data
 */
function trackComponentType(type: string): void {
  const cleanType = type.toLowerCase().includes('customembed') ? 'customembed' : type.toLowerCase();
  if (!dynamicTypeOrder.includes(cleanType)) {
    dynamicTypeOrder.push(cleanType);
  }
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
    console.log('Data appears to be already processed. Applying deep deduplication.');
    return (jsonData as MergedContentModel[]).map(model => ({
      ...model,
      fieldMapping: model.fieldMapping.map(field => processFieldDeep(field))
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
        .filter(f => f !== null)
        .map(field => processFieldDeep(field as FieldMapping));

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

    const processedBlocks = processBlocksArray(field.blocks);

    console.log(`  Final blocks: ${processedBlocks.length}`);

    return {
      ...field,
      blocks: processedBlocks
    };
  }

  return field;
}

/**
 * Process an array of blocks, handling containers and nested structures
 */
function processBlocksArray(blocks: BlockItem[]): BlockItem[] {
  // Track component types as they appear
  blocks.forEach(block => {
    const type = block.uid || block.contentstackFieldUid || '';
    if (type) {
      trackComponentType(type);
    }
  });

  // Step 1: Process each block recursively first
  const processedBlocks = blocks.map(block => processBlockRecursively(block));

  // Step 2: Separate containers from other blocks
  const containers: BlockItem[] = [];
  const otherBlocks: BlockItem[] = [];

  processedBlocks.forEach(block => {
    if (block.uid === 'container') {
      containers.push(block);
    } else {
      otherBlocks.push(block);
    }
  });

  // Step 3: Merge all containers if there are multiple
  let finalBlocks: BlockItem[] = [];

  if (containers.length > 0) {
    console.log(`  🔀 Found ${containers.length} container(s) at this level`);

    if (containers.length > 1) {
      console.log(`  Merging ${containers.length} containers into 1`);
      const mergedContainer = mergeAllContainersIntoOne(containers);
      finalBlocks.push(mergedContainer);
    } else {
      // Single container - just keep it
      finalBlocks.push(containers[0]);
    }
  }

  // Step 4: Add deduplicated other blocks
  const uniqueOtherBlocks = deduplicateBlocks(otherBlocks);
  finalBlocks = [...finalBlocks, ...uniqueOtherBlocks];

  return finalBlocks;
}

/**
 * Process a single block recursively
 * ENHANCED: Better handling of nested containers in schema
 */
function processBlockRecursively(block: BlockItem): BlockItem {
  const processedBlock = { ...block };

  // ENHANCED: Special handling for container blocks with schema containing multiple containers
  if (processedBlock.uid === 'container' && processedBlock.schema && Array.isArray(processedBlock.schema)) {
    console.log(`  🔍 Checking container for nested containers in schema...`);

    // Check if schema contains container items with the same contentstackFieldUid
    const containerSchemaItems = processedBlock.schema.filter(item => {
      // Check both uid and contentstackFieldUid for container identification
      const isContainer = (item.uid === 'container' || item.contentstackFieldUid === 'container');
      const hasBlocks = item.blocks && Array.isArray(item.blocks);
      return isContainer && hasBlocks;
    });

    if (containerSchemaItems.length > 1) {
      console.log(`  📦 Found ${containerSchemaItems.length} nested containers with same contentstackFieldUid - merging them`);

      // Collect all blocks from all container schema items
      const allNestedBlocks: BlockItem[] = [];
      const blockSignatures = new Set<string>();

      containerSchemaItems.forEach((containerItem, index) => {
        console.log(`    Processing nested container ${index + 1}/${containerSchemaItems.length}`);
        if (containerItem.blocks && Array.isArray(containerItem.blocks)) {
          containerItem.blocks.forEach((block: any) => {
            // Track the type
            const type = block.uid || block.contentstackFieldUid || '';
            if (type) {
              trackComponentType(type);
            }

            const signature = createDetailedBlockSignature(block);
            if (!blockSignatures.has(signature)) {
              blockSignatures.add(signature);
              // Recursively process the nested block
              const processedNestedBlock = processBlockRecursively(block);
              allNestedBlocks.push(processedNestedBlock);
              console.log(`      ✔ Added: ${block.uid || block.contentstackFieldUid}`);
            } else {
              console.log(`      ✗ Skipped duplicate: ${block.uid || block.contentstackFieldUid}`);
            }
          });
        }
      });

      // Sort blocks for consistent ordering
      const sortedBlocks = sortComponentsByType(allNestedBlocks);

      // Create a single merged container with all unique blocks
      const mergedContainer = {
        ...containerSchemaItems[0], // Use first container as base
        blocks: sortedBlocks
      };

      // Replace all container items with the single merged one
      const nonContainerItems = processedBlock.schema.filter(item => {
        const isContainer = (item.uid === 'container' || item.contentstackFieldUid === 'container');
        const hasBlocks = item.blocks && Array.isArray(item.blocks);
        return !(isContainer && hasBlocks);
      });

      processedBlock.schema = [mergedContainer, ...nonContainerItems];

      console.log(`    ✅ Merged ${containerSchemaItems.length} containers into 1 with ${sortedBlocks.length} unique blocks`);
    } else if (containerSchemaItems.length === 1) {
      // Single container in schema - process its blocks recursively
      console.log(`  📦 Found 1 container in schema - processing its blocks`);
      processedBlock.schema = processedBlock.schema.map(schemaItem => {
        if ((schemaItem.uid === 'container' || schemaItem.contentstackFieldUid === 'container') &&
          schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
          const processedNestedBlocks = processBlocksArray(schemaItem.blocks);
          return {
            ...schemaItem,
            blocks: processedNestedBlocks
          };
        }
        return schemaItem;
      });
    } else {
      // No containers in schema - process other schema items normally
      processedBlock.schema = processedBlock.schema.map(schemaItem => {
        if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
          const processedNestedBlocks = deduplicateBlocksDeep(schemaItem.blocks);
          return {
            ...schemaItem,
            blocks: processedNestedBlocks
          };
        }
        return schemaItem;
      });
    }
  } else if (processedBlock.schema) {
    // Process other types of schema
    if (Array.isArray(processedBlock.schema)) {
      processedBlock.schema = processedBlock.schema.map(schemaItem => {
        if (schemaItem.blocks && Array.isArray(schemaItem.blocks)) {
          const processedNestedBlocks = deduplicateBlocksDeep(schemaItem.blocks);
          return {
            ...schemaItem,
            blocks: processedNestedBlocks
          };
        }
        return schemaItem;
      });
    } else if (typeof processedBlock.schema === 'object' && processedBlock.schema.blocks) {
      // Schema is an object with blocks
      const nestedBlocks = processedBlock.schema.blocks;
      if (Array.isArray(nestedBlocks)) {
        console.log(`  📂 Processing nested blocks in schema object`);
        processedBlock.schema = {
          ...processedBlock.schema,
          blocks: deduplicateBlocksDeep(nestedBlocks)
        };
      }
    }
  }

  // If the block itself has blocks (another pattern)
  if (processedBlock.blocks && Array.isArray(processedBlock.blocks)) {
    console.log(`  📂 Processing blocks array in ${processedBlock.uid}`);
    processedBlock.blocks = processBlocksArray(processedBlock.blocks);
  }

  return processedBlock;
}

/**
 * Deep deduplication of blocks - removes exact duplicates
 */
function deduplicateBlocksDeep(blocks: BlockItem[]): BlockItem[] {
  const uniqueBlocks = new Map<string, BlockItem>();

  blocks.forEach(block => {
    // Track component type
    const type = block.uid || block.contentstackFieldUid || '';
    if (type) {
      trackComponentType(type);
    }

    const signature = createDetailedBlockSignature(block);

    if (!uniqueBlocks.has(signature)) {
      // Process the block recursively before adding
      const processedBlock = processBlockRecursively(block);
      uniqueBlocks.set(signature, processedBlock);
      console.log(`       ✔ Keeping unique block: ${block.uid || block.contentstackFieldUid}`);
    } else {
      console.log(`       ✗ Removing duplicate: ${block.uid || block.contentstackFieldUid}`);
    }
  });

  return Array.from(uniqueBlocks.values());
}

/**
 * Merge ALL containers into a single container
 */
function mergeAllContainersIntoOne(containers: BlockItem[]): BlockItem {
  if (containers.length === 1) {
    return containers[0];
  }

  console.log(`    Merging ${containers.length} containers...`);

  // Use first container as base
  const baseContainer = deepClone(containers[0]);

  // Collect all schemas from all containers
  const allSchemaItems: any[] = [];
  const schemaSignatures = new Set<string>();

  containers.forEach((container) => {
    if (container.schema) {
      if (Array.isArray(container.schema)) {
        container.schema.forEach(schemaItem => {
          // Track type
          const type = schemaItem.uid || schemaItem.contentstackFieldUid || '';
          if (type) {
            trackComponentType(type);
          }

          const signature = createDetailedSchemaSignature(schemaItem);

          if (!schemaSignatures.has(signature)) {
            schemaSignatures.add(signature);
            // Recursively process schema item if it has nested containers
            const processedSchemaItem = processSchemaItemForContainers(schemaItem);
            allSchemaItems.push(processedSchemaItem);
            const itemId = schemaItem.uid || schemaItem.contentstackFieldUid || 'item';
            console.log(`      ✔ Added schema item: ${itemId}`);
          }
        });
      } else if (typeof container.schema === 'object') {
        // Handle object schema
        const signature = createDetailedSchemaSignature(container.schema);
        if (!schemaSignatures.has(signature)) {
          schemaSignatures.add(signature);
          allSchemaItems.push(deepClone(container.schema));
        }
      }
    }
  });

  // Sort schema items for consistency
  const sortedSchemaItems = sortSchemaItems(allSchemaItems);

  console.log(`    Result: ${sortedSchemaItems.length} unique schema items in merged container`);

  return {
    ...baseContainer,
    schema: sortedSchemaItems
  };
}

/**
 * Process schema item for nested containers
 */
function processSchemaItemForContainers(schemaItem: any): any {
  if (!schemaItem) return schemaItem;

  const processed = deepClone(schemaItem);

  // If this schema item is itself a container with blocks, process those blocks
  if ((processed.uid === 'container' || processed.contentstackFieldUid === 'container') &&
    processed.blocks && Array.isArray(processed.blocks)) {
    processed.blocks = processBlocksArray(processed.blocks);
  }

  return processed;
}

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
function createDetailedBlockSignature(block: BlockItem): string {
  // Create a normalized version without certain fields
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
 * Deduplicate blocks array
 */
function deduplicateBlocks(blocks: BlockItem[]): BlockItem[] {
  const uniqueBlocks = new Map<string, BlockItem>();

  blocks.forEach(block => {
    const signature = createDetailedBlockSignature(block);
    if (!uniqueBlocks.has(signature)) {
      uniqueBlocks.set(signature, block);
    }
  });

  return Array.from(uniqueBlocks.values());
}

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
      if (field === null) {
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
    const optimalPosition = calculateOptimalPosition(data.positions);

    fieldsWithOptimalPosition.push({
      field: processedField,
      position: optimalPosition
    });
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