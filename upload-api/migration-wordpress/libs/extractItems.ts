import fs from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';
import * as cheerio from 'cheerio';


import { setupWordPressBlocks } from "../utils/parseUtil";
import { getFieldName, getFieldUid, schemaMapper } from "./schemaMapper";
import helper from "../utils/helper";
import config from '../config/index.json';
import extractTaxonomy from './extractTaxonomy';
import { DataConfig, Field, CT } from '../interface/interface';

const { contentTypes: contentTypesConfig } = config.modules;

const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

function findSimilarBlocks(data: any[][], targetId: string) {
  for (const group of data) {
    const found = group?.find((obj: any) => obj?.clientId === targetId);
    if (found) {
      // Return all blocks in the group including the current one
      return group ?? [];
    }
  }
  return []; // Return empty array if not found in any group
}

// Compare inner block structures recursively
function haveSameNamesIgnoreOrder(arr1: any[], arr2: any[]): boolean {
  const names1 = arr1?.map((o: any) => o?.name).sort();
  const names2 = arr2?.map((o: any) => o?.name).sort();
  return JSON?.stringify(names1) === JSON?.stringify(names2);
}

// Utility to compare structure of two objects (including nested arrays/innerBlocks)
function isSameStructure(obj1: any, obj2: any): boolean {
  // If types differ, structure differs
  if (typeof obj1 !== typeof obj2) return false;

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1?.length === 0 && obj2?.length === 0) return true;
    if (obj1?.length === 0 || obj2?.length === 0) return false;

    // Compare each element structure-wise
    return obj1?.every((item: any, i: number) => {
      const compareWith = obj2?.[i] || obj2?.[0];
      return isSameStructure(item, compareWith);
    });
  }


  if (typeof obj1 === "object" && obj1 !== null && obj2 !== null) {
    const keys1 = Object?.keys(obj1);
    const keys2 = Object?.keys(obj2);

    // Check if both objects have same keys
    if (keys1?.length !== keys2?.length || !keys1?.every((k: string) => keys2?.includes(k))) {
      return false;
    }

    // Special handling for Gutenberg-like blocks
    if (obj1?.name && obj2?.name && obj1?.name !== obj2?.name) {
      return false;
    }


    if (Array?.isArray(obj1?.innerBlocks) || Array.isArray(obj2?.innerBlocks)) {
      if (!Array.isArray(obj1?.innerBlocks) || !Array.isArray(obj2?.innerBlocks)) {
        return false; // one has innerBlocks, other doesn’t
      }

      if (obj1?.innerBlocks?.length !== obj2?.innerBlocks?.length) {
        return false;
      }

      if (!haveSameNamesIgnoreOrder(obj1?.innerBlocks, obj2?.innerBlocks)) {
        return false;
      }

    }

  }

  return true;
}


// Compare all objects in blocksJson
function findSameStructureBlocks(blocksJson : any) {
  const similarPairs:any = [];

  for (let i = 0; i < blocksJson?.length; i++) {
  for (let j = i + 1; j < blocksJson?.length; j++) {
      if (isSameStructure(blocksJson?.[i], blocksJson?.[j])) {
          similarPairs.push([blocksJson?.[i], blocksJson?.[j]]); // store indices or objects
      }
  }
  }
  
  return similarPairs;
}

/**
 * Get all child fields for a modular block child from CT
 * Child fields are those whose contentstackFieldUid starts with the parent's contentstackFieldUid
 */
function getChildFieldsFromCT(modularBlockChild: Field, CT: CT): Field[] {
  const parentUid = modularBlockChild.contentstackFieldUid;
  if (!parentUid) return [];
  
  return CT.filter(field => {
    // Skip the modular block child itself
    if (field === modularBlockChild) return false;
    
    // Check if this field belongs to the modular block child
    return field.contentstackFieldUid && 
           field.contentstackFieldUid.startsWith(parentUid + '.');
  });
}

/**
 * Create a signature for Fieldschema based only on contentstackFieldType
 * This ignores field names and only compares the structure/types
 */
function createFieldschemaSignature(fields: Field[]): string {
  // Sort fields by contentstackFieldUid for consistent comparison
  const sortedFields = [...fields].sort((a, b) => 
    (a.contentstackFieldUid || '').localeCompare(b.contentstackFieldUid || '')
  );
  
  // Create signature based only on contentstackFieldType (ignore names)
  const signature = sortedFields.map(field => ({
    contentstackFieldType: field.contentstackFieldType,
    // Include advanced properties that affect structure
    multiple: field.advanced?.multiple || false
  }));
  
  return JSON.stringify(signature);
}

/**
 * Check if a modular block child with the same Fieldschema already exists in CT
 * Compares only by contentstackFieldType, not by name
 */
function findDuplicateModularBlockChild(newFieldschema: Field[], CT: CT): Field | null {
  // Normalize Fieldschema to array
  const fieldsArray = Array.isArray(newFieldschema) ? newFieldschema : [newFieldschema];
  // Filter out null/undefined fields
  const validFields = fieldsArray.filter(f => f && f.contentstackFieldType !== "null");
  
  if (validFields.length === 0) return null;
  
  // Create signature for the new Fieldschema
  const newSignature = createFieldschemaSignature(validFields);
  
  // Find all existing modular block children in CT
  const existingModularBlocks = CT.filter(field => 
    field.contentstackFieldType === 'modular_blocks_child'
  );
  
  // Check each existing modular block child
  for (const existingBlock of existingModularBlocks) {
    const existingChildFields = getChildFieldsFromCT(existingBlock, CT);
    
    // Only compare if they have the same number of child fields
    if (existingChildFields.length !== validFields.length) continue;
    
    // Create signature for existing Fieldschema
    const existingSignature = createFieldschemaSignature(existingChildFields);
    
    // Compare signatures (only contentstackFieldType, ignoring names)
    if (existingSignature === newSignature) {
      return existingBlock;
    }
  }
  
  return null;
}

function getLastUid(uid : string) {
  return uid?.split?.('.')?.[uid?.split?.('.')?.length - 1];
}

const extractItems = async (item: any, config: DataConfig, type: string, affix: string, categories: any, terms: any) => {
    const localPath = config.localPath;
    const xmlData = await fs.promises.readFile(localPath, "utf8");
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const items = $('item');
    const authorsData = $('wp\\author');
    const CT: CT = [];
    let isCategories : boolean = false;
    let isTermReffered : boolean = false;

    const isAllContentEmpty = item.every((data: any) =>
      !data?.['content:encoded'] || data?.['content:encoded']?.trim() === ''
    );
    if(!isAllContentEmpty){
      CT?.push({
        "isDeleted": false,
        "uid": "title",
        "backupFieldUid": "title",
        "otherCmsField": "title",
        "otherCmsType": "text",
        "contentstackField": "title",
        "contentstackFieldUid": "title",
        "contentstackFieldType": "text",
        "backupFieldType": "text",
        "advanced": {
          "mandatory": true
        }
      },
      {
        "isDeleted": false,
        "uid": "url",
        "otherCmsField": "url",
        "backupFieldUid": "url",
        "otherCmsType": "text",
        "contentstackField": "Url",
        "contentstackFieldUid": "url",
        "contentstackFieldType": "url",
        "backupFieldType": "url",
        "advanced": {
          "mandatory": true
        }
      },
      {
        "isDeleted": false,
        "uid": "modular_blocks",
        "otherCmsField": "Modular Blocks",
        "backupFieldUid": "modular_blocks",
        "otherCmsType": "text",
        "contentstackField": "Modular Blocks",
        "contentstackFieldUid": "modular_blocks",
        "contentstackFieldType": "modular_blocks",
        "backupFieldType": "modular_blocks",
        
      }
    );
      
    }
    
     // Create the content type directory if it doesn't exist
     mkdirp(contentTypeFolderPath);

    //const category = await extractTaxonomy(categories, 'categories');
    const categoryArray: Field = 
    {       uid: 'category',
            otherCmsField: 'category',
            otherCmsType: 'category',
            contentstackField: 'category',
            contentstackFieldUid: 'taxonomies',
            contentstackFieldType: 'taxonomy',
            backupFieldType: 'taxonomy',
            backupFieldUid: 'taxonomies',
            advanced: {
                terms : []
            },
    };

    for (const data of item) {
      const processedSimilarBlocks = new Set();
        const targetItem = items?.filter((i, el) => {
            return $(el)?.find("title")?.text() === data?.title;
        })?.first();
        if(data?.category){
          const categoryData = Array?.isArray(data?.category) ? data?.category : [data?.category];
          const domain = categoryData?.some((item: any) => item?.attributes?.domain === 'category');
          const termsDomain = categoryData?.find((item: any) => item?.attributes?.domain !== 'category');
          isTermReffered = terms?.some((item: any) => item?.['wp:term_taxonomy'] === termsDomain?.attributes?.domain);
          if(domain){
            isCategories = true;
          }
          const category = await extractTaxonomy(data?.category, categories, 'categories');
          if (!categoryArray?.advanced) {
            categoryArray.advanced = { terms: [] };
          }
          categoryArray.advanced.terms = Array?.from(
            new Set([
              ...(categoryArray?.advanced?.terms || []),
              ...(category || [])
            ])
          );
        }
        //const taxonomy = await extractTerms(data?.category, terms, categories,'taxonomy');

        const contentEncoded = targetItem?.find("content\\:encoded")?.text() || '';
        const blocksJson = await setupWordPressBlocks(contentEncoded);
        //await helper?.writeFileAsync(`${data?.title || 'undefined'}.json`, JSON.stringify({blocks : blocksJson, count :blocksJson?.length}, null, 4), 4);

  
        // Example usage
        const result = findSameStructureBlocks(blocksJson);
        fs?.writeFileSync('result.json', JSON?.stringify(result, null, 4));
        
  
        // Track processed similar blocks to avoid duplicates
        
        for (const field of blocksJson) {
            const fieldUid = getFieldUid(`${field?.name}_${field?.clientId}`|| '', affix || '');
            const contentstackFieldName = getFieldName(field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name));

            const similarBlocks = findSimilarBlocks(result, field?.clientId);

            // Collect all unique block names from the similar blocks
            const allBlockNames = similarBlocks
            .map(block => block?.attributes?.metadata?.name || block?.name)
            .filter((name, index, array) => name && array?.indexOf(name) === index) // Remove duplicates
            .sort(); // Sort for consistency
     
            const filterOutBlock = allBlockNames?.filter((item)=> item !== (field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name)));
            const fieldDisplayName = getFieldName( field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name));
            const firstFilterBlock = filterOutBlock?.[0] ? `Modular Blocks > ${filterOutBlock?.[0]}` : null;
            
            const generatedFieldName = `Modular Blocks > ${fieldDisplayName}`;
          
            const existingBlock = CT?.find((item: Field) => {
              if (!item) return false;
              
              const isModularChild = item?.contentstackFieldType === 'modular_blocks_child';
              const matchesField =
                (item?.contentstackField === firstFilterBlock ||
                item?.contentstackField === generatedFieldName);
              return    isModularChild && matchesField;
            });
            
          
        
            // Create grouped contentstack field name

            const groupedContentstackField = `Modular Blocks > ${contentstackFieldName}`;
            // If this block has similar structures
            if (similarBlocks?.length > 0) {
              // Create a unique key based on the structure/name to track processed groups
              const groupKey = field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name)
              // Skip if we've already processed this group of similar blocks
              if (processedSimilarBlocks?.has?.(groupKey) || existingBlock) {
                  continue;
              }
              
              
              
              // Create single modular block child for all similar blocks
              if(!existingBlock && ! processedSimilarBlocks?.has?.(groupKey)){
                // Mark this group as processed
                processedSimilarBlocks?.add?.(groupKey);
                
                // Generate Fieldschema first to check for duplicates
                const Fieldschema: Field[] | Field = await schemaMapper(field?.innerBlocks?.length > 0 ? field?.innerBlocks : field, `modular_blocks.${fieldUid}`, groupedContentstackField, affix || '');
                const Schema = Array.isArray(Fieldschema) ? Fieldschema : [Fieldschema];
                // Check if a modular block child with the same Fieldschema already exists
                const duplicateBlock = findDuplicateModularBlockChild(Schema, CT);
                
                if (duplicateBlock) {
                  // Duplicate found - skip adding this modular block child and its Fieldschema
                  console.log(`Skipping duplicate modular block child: "${groupedContentstackField}" (duplicate of "${duplicateBlock.contentstackField}")`);
                  continue;
                }
                
                // No duplicate found - add the modular block child
                if(Schema?.length > 0){
                  CT?.push?.({
                  "uid": `modular_blocks.${getFieldUid(`${field?.name}_${field?.clientId}`, affix)}`,
                  "backupFieldUid": `modular_blocks.${fieldUid}`,
                  "contentstackFieldUid": `modular_blocks.${fieldUid}`,
                  "otherCmsField": contentstackFieldName,
                  "otherCmsType": 'block',
                  "contentstackField": groupedContentstackField,
                  "contentstackFieldType": 'modular_blocks_child',
                  "backupFieldType": "modular_blocks_child",
                });}
                
        
                if (Array?.isArray(Schema)) {
                
                  for (const schemaObj of Schema) {
                    if (!schemaObj || schemaObj?.contentstackFieldType === "null") continue;
                
                    // Check if any similar field already exists
                    const exists = CT?.find(
                      (item: Field) =>
                        getLastUid(item?.uid) === getLastUid(schemaObj?.uid) &&
                        item?.contentstackFieldType === schemaObj?.contentstackFieldType &&
                        item?.contentstackField === schemaObj?.contentstackField
                        //&& item?.contentstackFieldUid === schemaObj?.contentstackFieldUid
                    );
                
                    if (!exists) {
                      CT?.push?.(schemaObj);
                    }
                  }
                } 
                // else {
                //   if (Fieldschema && !Array.isArray(Fieldschema) && Fieldschema?.contentstackFieldType !== "null") {
                //     const exists = CT?.find(
                //       (item: Field) =>
                //         item?.uid === Fieldschema?.uid &&
                //         item?.contentstackFieldType === Fieldschema?.contentstackFieldType &&
                //         item?.contentstackField === Fieldschema?.contentstackField
                //         //&& item?.contentstackFieldUid === Fieldschema?.contentstackFieldUid
                //     );
                
                //     if (!exists) {
                //       CT?.push?.(Fieldschema);
                //     }
                //   }
                // }               
              }     
                  
            } 
            else {
              // Handle single blocks (no similar structures found)
              const singleBlockName = getFieldName(field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name));
              //console.info('singleBlockName', singleBlockName, !existingBlock ,existingBlock, ! processedSimilarBlocks?.has?.(field?.attributes?.metadata?.name || (field?.name === 'core/missing' ? 'body' : field?.name)), processedSimilarBlocks);
              if(!existingBlock && ! processedSimilarBlocks?.has?.(field?.attributes?.metadata?.name ?? getFieldName(field?.name === 'core/missing' ? 'body' : field?.name) )){
                processedSimilarBlocks?.add?.(field?.attributes?.metadata?.name ?? (field?.name === 'core/missing' ? 'body' : field?.name));
                
                // Generate Fieldschema first to check for duplicates
                const Fieldschema: Field[] | Field = await schemaMapper(field?.innerBlocks?.length > 0 ? field?.innerBlocks : field, `modular_blocks.${fieldUid}`, groupedContentstackField, affix || '');
                const Schema = Array.isArray(Fieldschema) ? Fieldschema : [Fieldschema];
                // Check if a modular block child with the same Fieldschema already exists
                const duplicateBlock = findDuplicateModularBlockChild(Schema, CT);
                
                if (duplicateBlock) {
                  // Duplicate found - skip adding this modular block child and its Fieldschema
                  console.log(`Skipping duplicate modular block child: "Modular Blocks > ${singleBlockName}" (duplicate of "${duplicateBlock.contentstackField}")`);
                  continue;
                }
                
                // No duplicate found - add the modular block child
                if(Schema?.length > 0){ 
                  CT?.push?.({
                  "uid": `modular_blocks.${getFieldUid(`${field?.name}_${field?.clientId}`, affix)}`,
                  "backupFieldUid": `modular_blocks.${fieldUid}`,
                  "contentstackFieldUid": `modular_blocks.${fieldUid}`,
                  "otherCmsField": contentstackFieldName,
                  "otherCmsType": 'block',
                  "contentstackField": `Modular Blocks > ${singleBlockName}`,
                  "contentstackFieldType": 'modular_blocks_child',
                  "backupFieldType": "modular_blocks_child",
              });}
        
              if (Array?.isArray(Schema)) {
              
                for (const schemaObj of Schema) {
                  if (!schemaObj || schemaObj?.contentstackFieldType === "null") continue;
              
                  // Check if any similar field already exists
                  const exists = CT?.find(
                    (item: Field) =>
                      getLastUid(item?.uid) === getLastUid(schemaObj?.uid) &&
                      item?.contentstackFieldType === schemaObj?.contentstackFieldType &&
                      item?.contentstackField === schemaObj?.contentstackField
                      //&& item?.contentstackFieldUid === schemaObj?.contentstackFieldUid
                  );
              
                  if (!exists) {
                    CT?.push?.(schemaObj);
                  }
                }
              } 
              // else {
              //   if (Fieldschema && !Array.isArray(Fieldschema) && Fieldschema?.contentstackFieldType !== "null") {
              //     const exists = CT?.find(
              //       (item: Field) =>
              //         item?.uid === Fieldschema?.uid &&
              //         item?.contentstackFieldType === Fieldschema?.contentstackFieldType &&
              //         item?.contentstackField === Fieldschema?.contentstackField
              //         //&& item?.contentstackFieldUid === Fieldschema?.contentstackFieldUid
              //     );
              
              //     if (!exists) {
              //       CT.push(Fieldschema);
              //     }
              //   }
              // }             
              }
                 
            }
               
        }
     }

    // Push category only once, outside the loop
    if (categories?.length > 0 && isCategories && !isAllContentEmpty) {
        const existingCategory = CT?.find((item: Field) => 
            item?.uid === 'categories' && 
            item?.contentstackFieldType === 'taxonomy'
        );
        
        if (!existingCategory) {
            CT?.push?.(categoryArray);
        }
    }
    if(isTermReffered && !isAllContentEmpty){
        CT?.push?.({
          "uid": 'terms',
          "contentstackFieldUid": 'terms',
          "contentstackField": 'Terms',
          "contentstackFieldType": 'reference',
          "backupFieldType": 'reference',
          "otherCmsField": 'terms',
          "otherCmsType": 'reference',
          "backupFieldUid": 'terms',
          "refrenceTo": ['terms'],
          "advanced": {
            "mandatory": false}
        });
      
    }
    if(authorsData && !isAllContentEmpty){
      CT?.push?.({
        "uid": 'author',
        "contentstackFieldUid": 'author',
        "contentstackField": 'Author',
        "contentstackFieldType": 'reference',
        "backupFieldType": 'reference',
        "otherCmsField": 'Author',
        "otherCmsType": 'reference',
        "backupFieldUid": 'author',
        "refrenceTo": ['author'],
        "advanced": {
          "mandatory": false}
      });
   
      
    }

    const filePath = path.join(contentTypeFolderPath, `${type?.toLowerCase()}.json`);
        const contentType = {
            "status": 1,
            "isUpdated": false,
            "updateAt": "",
            "otherCmsTitle": type,
            "otherCmsUid": type,
            "contentstackTitle": type,
            "contentstackUid": type?.toLowerCase(),
            "type": "content_type",
            "fieldMapping": CT
        }

    try {
        await helper.writeFileAsync(
            filePath,
            JSON.stringify(contentType, null, 4),
            4
        );
        console.log(`Successfully created unified content type: ${type}.json`);
        } catch (error : any) {
        console.error(`Error writing unified content type file ${filePath}:`, error?.message);
    }
}


export default extractItems;