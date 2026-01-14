/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import fs, { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { MIGRATION_DATA_CONFIG, LOCALE_MAPPER } from "../constants/index.js";
import jsdom from "jsdom";
import { htmlToJson, jsonToHtml } from "@contentstack/json-rte-serializer";
import customLogger from "../utils/custom-logger.utils.js";
import { getLogMessage } from "../utils/index.js";
import { v4 as uuidv4 } from "uuid";
import { orgService } from "./org.service.js";
import * as cheerio from 'cheerio';
import { setupWordPressBlocks, stripHtmlTags } from "../utils/wordpressParseUtil.js";
import { getExtension } from "../utils/mimeTypes.js";
import { logger } from "express-winston/index.js";

const { JSDOM } = jsdom;

const virtualConsole = new jsdom.VirtualConsole();
// Get the current file's path
const __filename = fileURLToPath(import.meta.url);

// Get the current directory
const __dirname = path.dirname(__filename);

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG

let assetsSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);

const contentTypeFolderPath = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME
);
const entrySave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
);
let postFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.POSTS_DIR_NAME,
  MIGRATION_DATA_CONFIG.POSTS_FOLDER_NAME
);
const chunksDir = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.CHUNKS_DIR_NAME
);
let authorsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME
);
let authorsFilePath = path.join(
  authorsFolderPath,
  MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
);
const termsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.TERMS_DIR_NAME
);

const TaxonomiesSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME
);
const TaxonomiesFilePath = path.join(
  TaxonomiesSave,
  MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME
);

const pagesFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.PAGES_DIR_NAME);

let assetMasterFolderPath = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  "logs",
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);

interface Asset {
  "wp:post_type": string;
  [key: string]: any;
}


const idCorrector = (id: any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) => match === '-' ? '' : '')
  if (newId) {
    return newId?.toLowerCase()
  } else {
    return id
  }
}

let failedJSONFilePath = path.join(
  assetMasterFolderPath,
  MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
);
const failedJSON: Record<string, any> = {};
let assetData: Record<string, any> | any = {};
const blog_base_url = "";

// import { parse, serialize } from '@wordpress/blocks';
// import { registerCoreBlocks } from '@wordpress/block-library';


const getFieldName = (key: string   ) => {
  if(key?.includes('/')){
      return key?.split('/')?.[1];
  }
  else if(key?.includes('wp:')){
      const parts = key.split('_');  // e.g. ['wp', 'post', 'title']
      
      //let displayName : string = '';
      const displayName = parts
      .filter(item => !item.includes('wp:'))
      .join(' ');
      return displayName;
  }
  return key;
}

const RteJsonConverter = (html: string) => {
  const dom = new JSDOM(html);
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);

}

const getLocale = (master_locale: string, project: any) => {
  for (const [key, value] of Object.entries(project?.master_locale || {})) {
    if (key === master_locale) {
      return key;
    }
  }
  //return project?.master_locale?.[master_locale] ? project.master_locale[master_locale] : master_locale;
}

function getLastUid(uid : string) {
  return uid?.split?.('.')?.[uid?.split?.('.')?.length - 1];
}

async function createSchema(fields: any, blockJson : any, title: string, uid: string, assetData: any) {
  const schema : any = {
    title: title,
    uid: uid,
    //fields: fields?.fields,
  };
  
  try {
    // Ensure blockJson is an array and fields is defined
    if (!Array.isArray(blockJson)) {
      console.warn('blockJson is not an array:', typeof blockJson);
      return schema;
    }
    
    if (!Array.isArray(fields)) {
      console.warn('fields is not an array:', typeof fields);
      return schema;
    }
    // Process modular blocks fields
    for (const field of fields) {
      if (field?.contentstackFieldType === 'modular_blocks') {
        const modularBlocksArray: any[] = [];
        const modularBlocksFieldUid = field?.contentstackFieldUid || getLastUid(field?.uid);
        
        // Find all modular_blocks_child fields that belong to this modular_blocks field
        const modularBlockChildren = fields.filter((f: any) => {
          const fUid = f?.contentstackFieldUid || '';
          return f?.contentstackFieldType === 'modular_blocks_child' &&
            fUid?.startsWith(modularBlocksFieldUid + '.') &&
            !fUid?.substring(modularBlocksFieldUid?.length + 1)?.includes('.');
        });
                
        // Process each block in blockJson to see if it matches any modular block child
        for (const block of blockJson) {
          try {
            const blockName = (block?.attrs?.metadata?.name?.toLowerCase() || getFieldName(block?.blockName?.toLowerCase()));
            
            // Find which modular block child this block matches
            const matchingChildField = fields.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase() ;
              
              return (childField?.contentstackFieldType !== 'modular_blocks_child') && (blockName === fieldName) 
            });
   
            const matchingModularBlockChild = modularBlockChildren.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase() ;
              return  blockName === fieldName 
            });
            
            //if (matchingChildField) {
              // Process innerBlocks (children) if they exist
              if (block?.innerBlocks?.length > 0 && Array.isArray(block?.innerBlocks) && matchingModularBlockChild?.uid) {
                const childrenObject: Record<string, any> = {};
            
                block?.innerBlocks?.forEach((child: any, childIndex: number) => {
                  try {
                    // Find the field that matches this inner block
                    // Look for fields that belong to this modular_blocks_child
                    const childFieldUid = matchingModularBlockChild?.contentstackFieldUid || getLastUid(matchingModularBlockChild?.uid);
                    const childField = fields.find((f: any) => {
                      const fUid = f?.contentstackFieldUid || '';
                      const fOtherCmsField = f?.otherCmsType?.toLowerCase();
                      const childBlockName = (child?.attrs?.metadata?.name?.toLowerCase() || getFieldName(child?.blockName?.toLowerCase()));
                      // Check if this field belongs to the modular_blocks_child and matches the block name
                      return fUid.startsWith(childFieldUid + '.') &&
                        (fOtherCmsField === childBlockName) && !childrenObject[getLastUid(f?.uid)];
                    });
                    
                    if (childField) {
                      const childKey = getLastUid(childField?.uid);
                      
                      if (childField?.contentstackFieldType === 'group') {
                      
                        // Process group recursively - handles nested structures
                        const processedGroup = processNestedGroup(child, childField, fields);
                        if (childField?.advanced?.multiple === true && processedGroup) {
                          if (Array.isArray(childrenObject[childKey])) {
                            childrenObject[childKey].push(processedGroup);
                          } else {
                            childrenObject[childKey] = [processedGroup];
                          }
                        } else {
                          processedGroup && (childrenObject[childKey] = processedGroup);
                        }
                      } else {
                        const formattedChild = formatChildByType(child, childField, assetData);
                        
                        if (childField?.advanced?.multiple === true && formattedChild) {
                          if (Array.isArray(childrenObject[childKey])) {
                            childrenObject[childKey].push(formattedChild);
                          } else {
                            childrenObject[childKey] = [formattedChild];
                          }
                        } else {
                          formattedChild && (childrenObject[childKey] = formattedChild);
                        }
                      }
                    }
                  } catch (childError) {
                    console.warn(`Error processing child block at index ${childIndex}:`, childError);
                  }
                });
                
                // Add the block to the modular blocks array with the child field's UID as the key
                Object.keys(childrenObject).length > 0 && modularBlocksArray.push({[getLastUid(matchingModularBlockChild?.uid)] : childrenObject });
              } else if(getLastUid(matchingModularBlockChild?.uid) && matchingChildField){
                // Handle blocks with no inner blocks - format the block itself
                const formattedBlock = formatChildByType(block, matchingChildField, assetData);
                
                formattedBlock && modularBlocksArray.push({[getLastUid(matchingModularBlockChild?.uid)] : { [getLastUid(matchingChildField?.uid)]: formattedBlock }});
              }
            //}
          } catch (blockError) {
            console.warn('Error processing block:', blockError);
          }
        }
        
        // Set the modular blocks array in the schema
        if (modularBlocksArray.length > 0) {
          schema[field?.uid] = modularBlocksArray;
        }
      }
    }
  } catch (error) {
    console.error('Error in createSchema:', error);
    schema.error = 'Failed to process WordPress blocks';
  }
  return schema;
}

// Recursive helper function to process nested group structures
function processNestedGroup(child: any, childField: any, allFields: any[]): Record<string, any> {
  const nestedChildrenObject: Record<string, any> = {};
  if (!child?.innerBlocks?.length || !Array.isArray(child?.innerBlocks)) {
    // No nested children, return empty object for group type
    return {};
  }
  
  // Find nested fields for this group by checking contentstackFieldUid
  const groupFieldUid = childField?.contentstackFieldUid || getLastUid(childField?.uid);
  const nestedFields = allFields?.filter((field: any) => {
    const fieldUid = field?.contentstackFieldUid || '';
    if (!fieldUid || !groupFieldUid) return false;
    
    // Check if field is a direct child of this group (one level deeper)
    if (!fieldUid.startsWith(groupFieldUid + '.')) return false;
    
    // Verify it's exactly one level deeper (no more dots after the prefix)
    const remainder = fieldUid.substring(groupFieldUid.length + 1);
    return remainder && !remainder.includes('.');
  }) || [];

  if (nestedFields?.length === 0) {
    // No nested fields found, return empty object
    return {};
  }
 
  child?.innerBlocks?.forEach((nestedChild: any, nestedIndex: number) => {
    try {
     
      const nestedChildField = nestedFields?.find((field: any) => 
        field?.otherCmsType?.toLowerCase() === (nestedChild?.attrs?.metadata?.name?.toLowerCase() ?? getFieldName(nestedChild?.blockName?.toLowerCase()))?.toLowerCase() && !nestedChildrenObject[getLastUid(field?.uid)]?.length
      );
      
      if (!nestedChildField) {
        return;
      }
      
      const nestedChildKey = getLastUid(nestedChildField?.uid);
      
      if (nestedChildField?.contentstackFieldType === 'group') {
        // Recursively process nested groups
        const deeplyNestedObject = processNestedGroup(nestedChild, nestedChildField, allFields);
        
        if (nestedChildField?.advanced?.multiple === true) {
          if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
            nestedChildrenObject[nestedChildKey].push(deeplyNestedObject);
          } else {
            nestedChildrenObject[nestedChildKey] = [deeplyNestedObject];
          }
        } else {
          nestedChildrenObject[nestedChildKey] = deeplyNestedObject;
        }
      } else {
        // Regular field, format it
        const formattedNestedChild = formatChildByType(nestedChild, nestedChildField, assetData);
        if (nestedChildField?.advanced?.multiple === true) {
          if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
            nestedChildrenObject[nestedChildKey].push(formattedNestedChild);
          } else {
            nestedChildrenObject[nestedChildKey] = [formattedNestedChild];
          }
        } else {
          nestedChildrenObject[nestedChildKey] = formattedNestedChild;
        }
      }
    } catch (nestedError) {
      console.warn(`Error processing nested child block at index ${nestedIndex}:`, nestedError);
    }
  });
  return nestedChildrenObject;
}

// Helper function to collect HTML strings from innerBlocks recursively
function collectHtmlFromInnerBlocks(block: any): string {
  let html = '';
  
  if (block?.innerHTML) {
    html += block.innerHTML;
  }
  
  if (block?.innerBlocks && Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
    block.innerBlocks.forEach((innerBlock: any) => {
      html += collectHtmlFromInnerBlocks(innerBlock);
    });
  }
  
  return html;
}

// Helper function to extract all HTML from innerBlocks recursively
function extractAllHtmlFromInnerBlocks(block: any): any {
  const html = collectHtmlFromInnerBlocks(block);
  return html ;
}

// Helper function to format child blocks based on their type and field configuration
function formatChildByType(child: any, field: any, assetData: any) {
  let formatted ;
  
  try {
    // Get the block type
    const blockType = child?.blockName || child?.name || 'unknown';
   
    
    // Process attributes based on field type configuration
    //if (child?.attributes && typeof child.attributes === 'object') {
     const attrKey = getFieldName(child?.attr?.metadata?.name?.toLowerCase() || child?.blockName?.toLowerCase());
        try {
          const attrValue = child?.attrs?.innerHTML;
          
          // Check if otherCmsField is "columns" - get all HTML data
          if (field?.otherCmsField?.toLowerCase() === 'columns') {
            formatted = extractAllHtmlFromInnerBlocks(child);
          }
          
          // Format based on common field types
          switch (field?.contentstackFieldType || 'text') {
            case 'modular_blocks':
              formatted = [];
              break;

            case 'multi_line_text':
            case 'single_line_text': {
              // Extract text content without HTML tags
              const textContent = child?.blockName ? stripHtmlTags(child?.innerHTML) : child;
              formatted = textContent;
              break;
            }

            case 'number':
              formatted = typeof attrValue === 'number' ? attrValue : Number(attrValue) || 0;
              break;

            case 'boolean':
              formatted = Boolean(child?.attrs[attrKey]);
              break;

            case 'json':
              formatted = child?.blockName ? RteJsonConverter(formatted ?? child?.innerHTML) : RteJsonConverter(formatted ?? child);
              break;

            case 'html':
              formatted = child?.blockName ? formatted ?? child?.innerHTML : `<p>${child}</p>`;
              break;

            case 'link':
              formatted= {
                "title": child?.attrs?.service,
                "href": child?.attrs?.url
              }
              break;

            case 'file': {
              // Extract filename from img tag in innerHTML
              let fileName = '';
              let imgUrl = child?.attrs?.src;
              let imgAlt = child?.attrs?.alt;
              
              // Check innerHTML for img tag
              const innerHtml = child?.innerHTML || child?.innerHTML;
              if (innerHtml && typeof innerHtml === 'string') {
                try {
                  const $ = cheerio.load(innerHtml);
                  const imgTag = $('img').first();
                  if (imgTag.length) {
                    const src = imgTag.attr('src');
                    if (src) {
                      imgUrl = src;
                      // Extract filename from URL
                      const urlParts = src.split('/');
                      const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
                      fileName = fileNameWithExt.includes('.') ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.')) : fileNameWithExt;
                    }
                    imgAlt = imgTag.attr('alt') || imgAlt;
                  }
                } catch (htmlError) {
                  console.warn('Error parsing innerHTML for img tag:', htmlError);
                }
              }
              
              // If no filename extracted from innerHTML, try to get it from src URL
              if (!fileName && imgUrl) {
                const urlParts = imgUrl.split('/');
                fileName = urlParts[urlParts.length - 1].split('?')[0];
              }
              const asset = assetData[fileName?.replace(/-/g, '_')?.toLowerCase()];
              formatted = asset;
              break;
            }
            default:
              // Default formatting - preserve original structure with null check
              formatted = attrValue;
          }
        } catch (attrError) {
          console.warn(`Error processing attribute ${attrKey}:`, attrError);
          formatted[attrKey] = null;
        }
     
  } catch (error) {
    console.error('Error in formatChildByType:', error);
    formatted = 'Failed to process block attributes';
  }
  
  
  return formatted;
}

async function saveEntry(fields: any, entry: any,  file_path: string, assetData : any, categories: any, master_locale: string, destinationStackId: string, project: any) {
  const srcFunc = 'saveEntry';
  const locale = getLocale(master_locale, project);
  const authorsCtName = MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  const authorsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG?.ENTRIES_DIR_NAME,authorsCtName, master_locale);
  const authorsFilePath = path.join(authorsSave,`${master_locale}.json` );
  const authorsData = JSON.parse(await fs.promises.readFile(authorsFilePath, "utf8")) || {};

  //const Jsondata = await fs.promises.readFile(file_path, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const items = $('item');
  const entryData: Record<string, any> = {};
  let blocksJson = [];
  try {
    if(entry ){
      // Process each entry with its corresponding XML item
      for (let i = 0; i < entry?.length; i++) {
        const taxonomies: any = [];
        const tags: any = [];
        const item = entry[i];
        if(item?.['category']?.length > 0){
          const category = item?.['category']?.filter((category: any) => category?.attributes?.domain === 'category');
          tags.push(...item?.['category']?.filter((category: any) => category?.attributes?.domain === 'post_tag') || []);
          
          for(const cat of category){
            const parentCategoryUid = categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.["wp:category_parent"];
            const parentCategory = parentCategoryUid ? categories?.find((category: any) => category?.["wp:category_nicename"] === parentCategoryUid)?.['wp:term_id'] 
            : categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.['wp:term_id'];
            const categoryName = cat?.attributes?.nicename;
            
            taxonomies.push({
              "taxonomy_uid": parentCategoryUid ? `${parentCategoryUid}_${parentCategory}` : `${categoryName}_${parentCategory}`,
              "term_uid": parentCategoryUid ?   categoryName : `${categoryName}_${parentCategory}`
            });
          } 
        }
        const uid = idCorrector(`posts_${item?.["wp:post_id"]}`);
        const author = Object?.keys(authorsData)?.find((key: any) => authorsData[key]?.title?.toLowerCase() === item?.['dc:creator']?.toLowerCase());
        const authorData = [{
          "uid":author,
          "_content_type_uid": authorsCtName
      }]
        const xmlItem = items?.length > 0 ? items?.filter((i, el) => {
          return $(el).find("title").text() === item["title"]
        }) : [];
      //   const targetItem = xmlItems.filter((i, el) => {
      //     return $(el).find("title").text() === entry.title;
      // }).first();
        // Find the matching XML item for this entry
        // const matchingXmlItem = xmlItems
        // .filter((_: any, el: any) => {
        //   const xmlPostId = $(el).find("wp\\:post_id").text();
        //   return xmlPostId === item["wp:post_id"];
        // })
        // .first();
        //console.info("matching xml item 1 --> ", matchingXmlItem);
        if (xmlItem && xmlItem?.length > 0) {
          // Extract individual content encoded for this specific item
          const contentEncoded = $(xmlItem)?.find("content\\:encoded")?.text() || '';
          const blocksJson = await setupWordPressBlocks(contentEncoded);
          customLogger(project?.id, destinationStackId,'info', `Processed blocks for entry ${uid}`);
          //await writeFileAsync(`${uid}.json`, JSON.stringify(blocksJson, null, 4), 4);

          // Pass individual content to createSchema
          entryData[uid] = await createSchema(fields, blocksJson, item?.title, uid, assetData);
          item?.['category']?.length > 0 && (entryData[uid]['taxonomies'] = taxonomies);
          entryData[uid]['tags'] = tags?.map((tag: any) => tag?.text);
          entryData[uid]['author'] = authorData;
          entryData[uid]['locale'] = locale
          
            
          
          console.info(`Processed entry ${uid} with individual content`);
        } else {
          console.warn(`No matching XML item found for entry ${uid}`);
        }
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      console.warn(`⚠️ Failed to parse blocks for:`, err.message);
    } else {
      console.warn(`⚠️ Failed to parse blocks for:`, err);
    }
    blocksJson = [];
  }
  return entryData;
}
async function createEntry(file_path: string, packagePath: string, destinationStackId: string, projectId: string, contentTypes: any, mapperKeys: any, master_locale: string, project: any){
  const srcFunc = 'createEntry';
  const locale = getLocale(master_locale, project) || master_locale;
  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const items = $('item');
  const entriesJsonData = JSON.parse(Jsondata);
  const entries = entriesJsonData?.rss?.channel?.["item"];
  const categories = entriesJsonData?.rss?.channel?.["wp:category"];
  const authorsData = entriesJsonData?.rss?.channel?.["wp:author"];
  const authors = Array?.isArray(authorsData) ? authorsData : [authorsData];
 
  assetsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME);
  const assetsSchemaPath = path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
  const assetData = JSON.parse(await fs.promises.readFile(assetsSchemaPath, "utf8")) || {};

  const itemsArray = Array?.isArray(entries) ? entries : (entries ? [entries] : []);
  
  const groupedByType = itemsArray?.reduce((acc: any, item: any) => {
    const postType = item?.["wp:post_type"];
  
    // Skip if it's an attachment
    if (["attachment", 'wp_global_styles', 'wp_navigation']?.includes(postType)) {
      return acc;
    }
  
    const type = postType || "unknown";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
  
    return acc;
  }, {});

  if(! existsSync(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME))){
    await fs.promises.mkdir(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME), { recursive: true });
  }
  const authorContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid === 'author');
  if(authorContentTypes?.length > 0){
    const postsFolderName = authorContentTypes?.[0]?.contentstackUid;
  
    // Create master locale folder and file
    postFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName, locale);
    if(! existsSync(postFolderPath)){
      await fs.promises.mkdir(postFolderPath, { recursive: true });
    }
    const authorContent = await saveAuthors(authors, destinationStackId, projectId,authorContentTypes[0],master_locale, project?.locales, project);

    const filePath = path.join(postFolderPath,  `${locale}.json`);

    await writeFileAsync(filePath, authorContent, 4);

    await fs.promises.writeFile(path.join(postFolderPath, "index.json"),
      JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
    );
  }
  const postContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid !== 'author');

  
  
  for(const contentType of postContentTypes){
    //await startingDirPosts(contentType?.contentstackUid, master_locale, project?.locales); 
    const postsFolderName = contentType?.contentstackUid;
  
    // Create master locale folder and file
    postFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName, locale);
    if(! existsSync(postFolderPath)){
      await fs.promises.mkdir(postFolderPath, { recursive: true });
    }
    const contentTypeUid = contentType?.contentstackTitle?.toLowerCase();
    const entry = entries?.filter((entry: any) => {
      return entry?.['wp:post_type']?.toLowerCase() === contentTypeUid;
    });
    
      // for (const [type, items] of Object.entries(groupedByType)) {
      //   if (Array.isArray(items) && items.length > 0) {
      //     await extractItems(items,file_path);
      //   } else {
      //     console.log(`No ${type} found to extract`);
      //   }
      // }
      const content = await saveEntry(contentType?.fieldMapping, entry,file_path, assetData, categories, master_locale, destinationStackId, project) || {};
      
      const filePath = path.join(postFolderPath,  `${locale}.json`);
      await writeFileAsync(filePath, content, 4);

      await fs.promises.writeFile(path.join(postFolderPath, "index.json"),
        JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
      );
      console.info(`Processed content for ${contentType?.contentstackTitle}:`, Object?.keys(content)?.length, "items");
    }
}

async function createTaxonomy(file_path: string, packagePath: string, destinationStackId: string, projectId: string, contentTypes: any, mapperKeys: any, master_locale: string, project: any){
  console.info("createTaxonomy");
  const taxonomiesPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME);
  await fs.promises.mkdir(taxonomiesPath, { recursive: true });

  const srcFunc = 'createTaxonomy';
  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const categoriesJsonData = JSON.parse(Jsondata)?.rss?.channel?.["wp:category"] || JSON.parse(Jsondata)?.channel?.["wp:category"] || [];
  if(categoriesJsonData?.length > 0){
    const allTaxonomies : any = {}
    for(const category of categoriesJsonData){
      if(!category?.['wp:category_parent']){
        const terms = [];
        
        const categoryName = category?.["wp:cat_name"];
        const categoryUid = `${category?.["wp:category_nicename"]}_${category?.["wp:term_id"]}`;
        const categoryDescription = category?.["wp:category_description"];
        const childCategories = categoriesJsonData?.filter((child: any) => child?.['wp:category_parent'] === category?.["wp:category_nicename"]);
        for(const childCategory of childCategories){
          terms?.push({
            "uid": childCategory?.["wp:category_nicename"],
            "name": childCategory?.["wp:cat_name"],
            "description": childCategory?.["wp:category_description"],
            "parent_uid": categoryUid,
          })
        }
        const taxonomy = {
          "uid": categoryUid,
          "name": categoryName,
          "description": categoryDescription,
          
        }
        allTaxonomies[categoryUid] = {
          "uid": categoryUid,
          "name": categoryName,
          "description": categoryDescription,
          
        }
        terms?.push({
          "uid": categoryUid,
          "name": categoryName,
          "description": categoryDescription,
          "parent_uid": null,
        })
        const taxonomyData = {taxonomy, terms};
        await writeFileAsync(path.join(taxonomiesPath, `${categoryUid}.json`), JSON.stringify(taxonomyData, null, 4), 4);
        customLogger(projectId, destinationStackId, 'info', `Category ${categoryName} has been successfully extracted`);
    }       
    }
    await writeFileAsync(path.join(taxonomiesPath, MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME), JSON.stringify(allTaxonomies, null, 4), 4);
  }
  else {
    console.warn("No categories found to extract");
    customLogger(projectId, destinationStackId, 'error', "No categories found to extract");
  }
}


// helper functions
async function writeFileAsync(filePath: string, data: any, tabSpaces: number) {
  filePath = path.resolve(filePath);
  data =
    typeof data == "object" ? JSON.stringify(data, null, tabSpaces)
      : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
}

async function writeOneFile(indexPath: string, fileMeta: any) {
    fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
      if (err) {
        console.error('Error writing file: 3', err);
      }
    });
  }

  const getKeys = (obj: Record<string, any>): string[] => { //Function to fetch all the locale codes
    return Object.keys(obj);
  };

/************  Locale module functions start *********/
  
  const createLocale = async (req: any, destinationStackId: string, projectId: string, project: any) => {
    const srcFunc = 'createLocale';
    try {
      const baseDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);
      const localeSave = path.join(baseDir, MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME);
      const allLocalesResp = await orgService.getLocales(req)
      const masterLocale = Object?.keys?.(project?.master_locale ?? LOCALE_MAPPER?.masterLocale)?.[0];
      const msLocale: any = {};
      const uid = uuidv4();
      msLocale[uid] = {
        "code": masterLocale,
        "fallback_locale": null,
        "uid": uid,
        "name": allLocalesResp?.data?.locales?.[masterLocale] ?? ''
      }
      const message = getLogMessage(
        srcFunc,
        `Master locale ${masterLocale} has been successfully transformed.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      const allLocales: any = {};
      for (const [key, value] of Object.entries(project?.locales ?? LOCALE_MAPPER.locales)) {
        const localeUid = uuidv4();
        if (key !== 'masterLocale' && typeof value === 'string') {
          allLocales[localeUid] = {
            "code": key,
            "fallback_locale": masterLocale,
            "uid": localeUid,
            "name": allLocalesResp?.data?.locales?.[key] ?? ''
          }
          const message = getLogMessage(
            srcFunc,
            `locale ${value} has been successfully transformed.`,
            {}
          )
          await customLogger(projectId, destinationStackId, 'info', message);
        }
      }
      const masterPath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_MASTER_LOCALE);
      const allLocalePath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME);
      fs.access(localeSave, async (err) => {
        if (err) {
          fs.mkdir(localeSave, { recursive: true }, async (err) => {
            if (!err) {
              await writeOneFile(masterPath, msLocale);
              await writeOneFile(allLocalePath, allLocales);
            }
          })
        } else {
          await writeOneFile(masterPath, msLocale);
          await writeOneFile(allLocalePath, allLocales);
        }
      })
    } catch (err) {
      const message = getLogMessage(
        srcFunc,
        `error while Createing the locales.`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
    }
  }


/************  Assests module functions start *********/
async function startingDirAssests(destinationStackId: string) {
  try {
    // Check if assetsSave directory exists
    assetsSave = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

    assetMasterFolderPath = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      "logs",
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

    failedJSONFilePath = path.join(
      assetMasterFolderPath,
      MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
    );
    await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );
    try {
      await fs.promises.access(assetsSave);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetsSave, { recursive: true });
      // Create files directory for storing all asset files
      await fs.promises.mkdir(path.join(assetsSave, "files"), { recursive: true });
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
        JSON.stringify({ "1" : 'index.json' }, null, 4)
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
        "{}"
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FOLDER_FILE_NAME),
        "{}"
      );
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );

      return;
    }

    // Ensure files directory exists even if assetsSave already exists
    const filesDir = path.join(assetsSave, "files");
    try {
      await fs.promises.access(filesDir);
    } catch {
      await fs.promises.mkdir(filesDir, { recursive: true });
    }

    // Check if assets.json exists
    const assetsJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
    );
    const assetsSchemaJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE
    );
    try {
      await fs.promises.access(assetsJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsJsonPath, "utf8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsJsonPath,  JSON.stringify({ "1" : MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE }, null, 4));
      return;
    }

    try {
      await fs.promises.access(assetsSchemaJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsSchemaJsonPath, "utf8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsSchemaJsonPath, "{}");
      return;
    }

    // Check if assetMasterFolderPath exists
    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
        "{}"
      );
      return;
    }
  } catch (error) {
    console.error("Error in startingDir:", error);
    return;
  }
}

function toCheckUrl(url : string, baseSiteUrl: string) {

  const validPattern = /^(https?:\/\/|www\.)/;
  return validPattern.test(url) ? url
    : `${baseSiteUrl}${url.replace(/^\/+/, "")}`;
}

async function saveAsset(assets: any, retryCount: number, affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const srcFunc = 'saveAsset';
  const url = encodeURI(toCheckUrl(assets["wp:attachment_url"],baseSiteUrl));
  const originalName = url.split("/").pop() || "";
  const fileExtension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const nameWithoutExt = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

  let description =
    assets["description"] ||
    assets["content:encoded"] ||
    assets["excerpt:encoded"] ||
    "";
  description =
    description.length > 255 ? description.slice(0, 255) : description;

  const parent_uid = affix ? "wordpressasset" : null;

  const customId = `assets_${assets["wp:post_id"]}`;
  // Use customId as filename to ensure uniqueness, preserve extension

  const filename = `${customId}${fileExtension}`;
  const assetPath = path.resolve(assetsSave, "files", customId);

  if(!existsSync(assetPath)) {
    await fs.promises.mkdir(assetPath, { recursive: true });
  }


  if (fs.existsSync(assetPath)) {
    console.error(`Asset already present: ${customId}`);
    return assets["wp:post_id"];
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    // Ensure files directory exists
    fs.mkdirSync(
      path.resolve(assetsSave, "files"),
      { recursive: true }
    );
    fs.writeFileSync(path.join(assetPath, filename), response.data);

    const stats = fs.lstatSync(assetPath);
    const acc: any = {};
    const key = customId;

    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getExtension(fileExtension?.split('.')?.[1]),
      file_size: `${stats.size}`,
      tag: [],
      filename: filename,
      url,
      is_dir: false,
      parent_uid,
      _version: 1,
      title: assets["title"] || nameWithoutExt,
      publish_details: [],
      description,
    };

    if (failedJSON[customId]) {
      // delete the assest entry from wp_failed log
      delete failedJSON[customId];
      await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    }
    assetData[key] = acc[key];


    await writeFileAsync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
      assetData,
      4
    );
    const message = getLogMessage(
      "createAssetFolderFile",
      `An asset with id ${customId} and name ${name} downloaded successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);


    return assets["wp:post_id"];
  } catch (err: any) {
    const assetName = assets["title"] || nameWithoutExt;
    failedJSON[assets["wp:post_id"]] = {
      failedUid: assets["wp:post_id"],
      name: assetName,
      url,
      reason_for_error: err?.message || "error",
    };

    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
    }
    await fs.promises.writeFile(
      path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
      "{}"
    );
   await writeFileAsync(failedJSONFilePath, failedJSON, 4);

    if (retryCount === 0) {
      return await saveAsset(assets, 1, affix, destinationStackId, projectId, baseSiteUrl);
    } else {
      const message = getLogMessage(
        srcFunc,
        `Failed to download asset with id ${assets["wp:post_id"]}`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      return assets["wp:post_id"];
    }
  }
}

/**
 * Checks if a URL is valid for downloading (not a data URI, etc.)
 * @param url - The URL to check
 * @returns true if the URL is valid for downloading
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Skip data URIs
  if (url.trim().startsWith('data:')) {
    return false;
  }
  
  // Skip empty or very short URLs
  if (url.trim().length < 5) {
    return false;
  }
  
  // Skip javascript: and other non-http protocols
  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('mailto:') || 
      lowerUrl.startsWith('tel:')) {
    return false;
  }
  
  return true;
}

/**
 * Extracts image URLs from HTML content
 * @param htmlContent - The HTML content string
 * @param baseSiteUrl - Base site URL for resolving relative URLs
 * @returns Array of unique image URLs
 */
function extractImageUrlsFromContent(htmlContent: string, baseSiteUrl: string): string[] {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return [];
  }

  const imageUrls = new Set<string>();
  
  try {
    const $ = cheerio.load(htmlContent);
    
    // Extract img src attributes
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src && isValidImageUrl(src)) {
        const fullUrl = toCheckUrl(src, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      
      // Also check data-src (lazy loading)
      const dataSrc = $(element).attr('data-src');
      if (dataSrc && isValidImageUrl(dataSrc)) {
        const fullUrl = toCheckUrl(dataSrc, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      
      // Check srcset attribute
      const srcset = $(element).attr('srcset');
      if (srcset) {
        const srcsetUrls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
        srcsetUrls.forEach(url => {
          if (isValidImageUrl(url)) {
            const fullUrl = toCheckUrl(url, baseSiteUrl);
            if (isValidImageUrl(fullUrl)) {
              imageUrls.add(fullUrl);
            }
          }
        });
      }
    });
    
    // Extract background images from style attributes
    $('[style*="background-image"]').each((_, element) => {
      const style = $(element).attr('style');
      if (style) {
        const bgImageMatch = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
        if (bgImageMatch && bgImageMatch[1] && isValidImageUrl(bgImageMatch[1])) {
          const fullUrl = toCheckUrl(bgImageMatch[1], baseSiteUrl);
          if (isValidImageUrl(fullUrl)) {
            imageUrls.add(fullUrl);
          }
        }
      }
    });
    
    // Extract URLs from CSS background-image in style tags
    $('style').each((_, element) => {
      const styleContent = $(element).html();
      if (styleContent) {
        const bgImageMatches = styleContent.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi);
        if (bgImageMatches) {
          bgImageMatches.forEach(match => {
            const urlMatch = match.match(/url\(['"]?([^'")]+)['"]?\)/i);
            if (urlMatch && urlMatch[1] && isValidImageUrl(urlMatch[1])) {
              const fullUrl = toCheckUrl(urlMatch[1], baseSiteUrl);
              if (isValidImageUrl(fullUrl)) {
                imageUrls.add(fullUrl);
              }
            }
          });
        }
      }
    });
  } catch (error) {
    console.error('Error extracting image URLs from content:', error);
  }
  
  return Array.from(imageUrls);
}

/**
 * Saves an asset from a URL
 * @param url - The asset URL to download
 * @param affix - Affix string
 * @param destinationStackId - Destination stack ID
 * @param projectId - Project ID
 * @param baseSiteUrl - Base site URL
 * @param retryCount - Retry count for failed downloads
 */
async function saveAssetFromUrl(
  url: string,
  affix: string,
  destinationStackId: string,
  projectId: string,
  baseSiteUrl: string,
  retryCount: number = 0
): Promise<string | null> {
  const srcFunc = 'saveAssetFromUrl';
  const encodedUrl = encodeURI(url);
  const originalName = url.split("/").pop()?.split("?")[0] || `asset_${Date.now()}`;
  const fileExtension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const nameWithoutExt = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

  // Generate a unique ID based on URL hash to avoid duplicates
  const urlHash = Buffer.from(encodedUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const customId = `${nameWithoutExt?.replace(/-/g, '_')?.toLowerCase()}`;
  // Use customId as filename to ensure uniqueness, preserve extension
  const filename = `${customId}${fileExtension}`;
  
  const assetPath = path.resolve(assetsSave, "files",customId, filename);
  
  // Check if asset already exists
  if (fs.existsSync(assetPath)) {
    return customId;
  }
  
  const parent_uid = affix ? "wordpressasset" : null;
  
  try {
    const response = await axios.get(encodedUrl, { 
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5
    });
    
    // Ensure files directory exists
    fs.mkdirSync(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    
    fs.writeFileSync(assetPath, response.data);
    
    const stats = fs.lstatSync(assetPath);
    const acc: any = {};
    const key = customId;
    
    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getExtension(fileExtension?.split('.')?.[1]),
      file_size: `${stats.size}`,
      tag: [],
      filename: filename,
      url: encodedUrl,
      is_dir: false,
      parent_uid,
      _version: 1,
      title: nameWithoutExt,
      publish_details: [],
      description: `Asset extracted from content:encoded`,
    };
    
    if (failedJSON[customId]) {
      delete failedJSON[customId];
      await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    }
    
    assetData[key] = acc[key];
    
    await writeFileAsync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
      assetData,
      4
    );
    
    const message = getLogMessage(
      srcFunc,
      `An asset with id ${customId} and name ${originalName} downloaded successfully from content:encoded.`,
      {}
    );
    await customLogger(projectId, destinationStackId, 'info', message);
    
    return customId;
  } catch (err: any) {
    const assetName = nameWithoutExt || originalName;
    failedJSON[customId] = {
      failedUid: customId,
      name: assetName,
      url: encodedUrl,
      reason_for_error: err?.message || "error",
    };
    
    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
    }
    await fs.promises.writeFile(
      path.join(assetMasterFolderPath, MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
      "{}"
    );
    await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    
    if (retryCount === 0) {
      return await saveAssetFromUrl(url, affix, destinationStackId, projectId, baseSiteUrl, 1);
    } else {
      const message = getLogMessage(
        srcFunc,
        `Failed to download asset from URL: ${encodedUrl}`,
        {},
        err
      );
      await customLogger(projectId, destinationStackId, 'error', message);
      return null;
    }
  }
}

async function getAsset(attachments: any[], affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const BATCH_SIZE = 5; // 5 promises at a time
  const results = [];
  
  for (let i = 0; i < attachments?.length; i += BATCH_SIZE) {
    const batch = attachments?.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch?.map(async (data) => {
        await saveAsset(data, 0, affix, destinationStackId, projectId, baseSiteUrl)
      })
    );
    results?.push(...batchResults);
  }
  await fs.promises.writeFile(
    path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
    JSON.stringify({ "1": MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE }, null, 4),
    "utf-8"
  );
  
  return results;
}

async function getAllAssets(
  affix: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string
) {
  try {
    await startingDirAssests(destinationStackId);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const baseSiteUrl =
    alldataParsed?.rss?.channel?.["wp:base_site_url"] ||
    alldataParsed?.channel?.["wp:base_site_url"];
    const assets: Asset[] =
      alldataParsed?.rss?.channel?.item ?? alldataParsed?.channel?.item;
    if (!assets || assets?.length === 0) {
      const message = getLogMessage(
        "createAssetFolderFile",
        `No assets found.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      return;
    }

    // Download attachment assets
    const attachments = assets?.filter(
      ({ "wp:post_type": postType }) => postType === "attachment"
    );
    if (attachments?.length > 0) {
      await getAsset(attachments, affix, destinationStackId, projectId,baseSiteUrl);
    }

    // Extract and download assets from content:encoded fields
    const allImageUrls = new Set<string>();
    
    // Process all items to extract image URLs from content:encoded
    for (const item of assets) {
      const contentEncoded = item["content:encoded"];
      if (contentEncoded && typeof contentEncoded === 'string') {
        const imageUrls = extractImageUrlsFromContent(contentEncoded, baseSiteUrl);
        imageUrls.forEach(url => allImageUrls.add(url));
      }
    }

    // Download all unique image URLs found in content:encoded
    if (allImageUrls.size > 0) {
      const imageUrlArray = Array.from(allImageUrls);
      const BATCH_SIZE = 5; // Process 5 URLs at a time
      const message = getLogMessage(
        "getAllAssets",
        `Found ${imageUrlArray.length} unique image URLs in content:encoded fields. Starting download...`,
        {}
      );
      await customLogger(projectId, destinationStackId, 'info', message);

      for (let i = 0; i < imageUrlArray.length; i += BATCH_SIZE) {
        const batch = imageUrlArray.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (url) => {
            await saveAssetFromUrl(url, affix, destinationStackId, projectId, baseSiteUrl);
          })
        );
      }

      const completionMessage = getLogMessage(
        "getAllAssets",
        `Completed downloading assets from content:encoded fields.`,
        {}
      );
      await customLogger(projectId, destinationStackId, 'info', completionMessage);
    }

    return;
  } catch (error) {
    return {
      err: "error in Workpresss",
      error: error,
    };
  }
}

/************  End of assests module functions *********/


/************  end of chunks module functions *********/

/************  authors module functions start *********/
async function startingDirAuthors(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
    const authorFolderName = ct || MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  
    authorsFolderPath = path.join(entrySave, authorFolderName, master_locale);
    authorsFilePath = path.join(authorsFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(authorsFolderPath);
    } catch {
      await fs.promises.mkdir(authorsFolderPath, { recursive: true });
      await fs.promises.writeFile(authorsFilePath, "{}");
    }
  
    // Read master data once
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(authorsFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master author file:", err);
    }
  
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, authorFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
}

const filePath = false;

// Helper function to get author field value based on field mapping
function getAuthorFieldValue(field: any, authorData: any, fallbackUrl?: string): any {
  const fieldUid = field?.uid;
  const otherCmsField = field?.otherCmsField;
  const fieldUidLower = fieldUid?.toLowerCase();
  const otherCmsFieldLower = otherCmsField?.toLowerCase();
  
  // Field mapping for common WordPress author fields
  const fieldMapping: Record<string, string> = {
    'email': 'wp:author_email',
    'first_name': 'wp:author_first_name',
    'firstname': 'wp:author_first_name',
    'last_name': 'wp:author_last_name',
    'lastname': 'wp:author_last_name',
    'display_name': 'wp:author_display_name',
    'displayname': 'wp:author_display_name',
    'description': 'wp:author_description',
    'website': 'wp:author_url',
    'url': 'wp:author_url',
  };
  
  // Try direct match with field.uid (case-sensitive)
  if (fieldUid && authorData[fieldUid] !== undefined) {
    return authorData[fieldUid];
  }
  
  // Try direct match with otherCmsField (case-sensitive)
  if (otherCmsField && authorData[otherCmsField] !== undefined) {
    return authorData[otherCmsField];
  }
  
  // Check field mapping for WordPress-specific fields (case-insensitive)
  const wpFieldKey = fieldMapping[fieldUidLower] || fieldMapping[otherCmsFieldLower];
  if (wpFieldKey) {
    const value = authorData[wpFieldKey];
    // Handle special cases
    if (wpFieldKey === 'wp:author_display_name' && !value) {
      return authorData['wp:author_login'];
    }
    if ((wpFieldKey === 'wp:author_url') && !value && fallbackUrl) {
      return fallbackUrl;
    }
    return value;
  }
  
  return null;
}

async function saveAuthors(authorDetails: any[], destinationStackId: string, projectId: string, contentType: any, master_locale:string, locales:object, project: any) {
    const srcFunc = "saveAuthors";
    const localeKeys = getKeys(locales)
    try {
      // Load asset data for file/asset field processing
      const assetsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME);
      const assetsSchemaPath = path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
      let assetData: Record<string, any> = {};
      
      try {
        if (existsSync(assetsSchemaPath)) {
          const assetDataContent = await fs.promises.readFile(assetsSchemaPath, "utf8");
          assetData = JSON.parse(assetDataContent) || {};
        }
      } catch (err) {
        console.warn('Asset data file not found or could not be read, proceeding without asset data');
      }
  
      const authordata: { [key: string]: any } = {};
  
      for (const data of authorDetails) {
        const uid = `authors_${data["wp:author_id"] || data["wp:author_login"]}`;
        const title = data["wp:author_login"] || `Authors - ${data["wp:author_id"]}`;
        const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
        const customId = idCorrector(uid);
  
        // Build author data entry dynamically based on field mapping
        const authordataEntry: any = {
          uid: uid,
          title: data["wp:author_login"],
          url: url,
        };
  
        // Process each field in the content type's field mapping
        if (contentType?.fieldMapping && Array.isArray(contentType.fieldMapping)) {
          for (const field of contentType.fieldMapping) {
            const fieldValue = getAuthorFieldValue(field, data, url);
            
            // Store the field value in authordataEntry using field.uid
            if (field?.uid && fieldValue !== undefined && fieldValue !== null) {
              authordataEntry[field?.contentstackFieldUid] = formatChildByType(fieldValue, field, assetData);
            }
          }
        }
  
        authordata[customId] = authordataEntry
        authordata[customId].publish_details = [];
        const message = getLogMessage(
          srcFunc,
          `Entry title ${data["wp:author_login"]} (authors) in the ${master_locale} locale has been successfully transformed.`,
          {}
        );
  
        await customLogger(projectId, destinationStackId, 'info', message);
      }
      // await writeFileAsync(authorsFilePath, authordata, 4);
      // await writeFileAsync(
      //   path.join(authorsFolderPath, "index.json"),
      //   { "1": `${master_locale}.json` },
      //     4
      //     );
      //     // Write index.json in other locale folders (not master)
      for (const loc of localeKeys) {
          if (loc === master_locale) continue;
        
          const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME, loc);
          const indexPath = path.join(localeFolderPath, "index.json");
        
          try {
            await fs.promises.writeFile(
              indexPath,
              JSON.stringify({ "1": `${loc}.json` }, null, 4)
            );
          } catch (err) {
            console.error(`Error writing index.json for locale ${loc}:`, err);
          }
        }
  
  
      const message = getLogMessage(
        srcFunc,
        `${authorDetails?.length} Authors exported successfully`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      return authordata;
    } catch (error) {
      const message = getLogMessage(
        srcFunc,
        (error as Error)?.message,
        {},
        error as Error
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      return {
        err: (error as Error)?.message,
        error: error as Error,
      };
    }
  }
async function getAllAuthors(affix: string, packagePath: string,destinationStackId: string, projectId: string,contentTypes:any, keyMapper:any, master_locale:string, project:any) {
  const srcFunc = "getAllAuthors";
  const ct:any = keyMapper?.["authors"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'authors')
  try {
    await startingDirAuthors(affix, ct, master_locale, project?.locales);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const authors: any =
      alldataParsed?.rss?.channel?.["wp:author"] ??
      alldataParsed?.channel?.["wp:author"] ??
      "";

    if (authors && authors.length > 0) {
      if (!filePath) {
        await saveAuthors(authors, destinationStackId, projectId,contenttype,master_locale, project?.locales,project);
      } else {
        const authorIds = fs.existsSync(filePath)? fs.readFileSync(filePath, "utf-8").split(",")
          : [];

        if (authorIds.length > 0) {
          const authorDetails = authors.filter((author: any) =>
            authorIds.includes(author["wp:author_id"])
          );

          if (authorDetails.length > 0) {
            await saveAuthors(authorDetails, destinationStackId, projectId,contenttype,master_locale, project?.locales,project);
          }
        }
      }
    } else if (typeof authors === "object") {
      if (
        !filePath ||
        (fs.existsSync(filePath) &&
          fs
            .readFileSync(filePath, "utf8")
            .split(",")
            .includes(authors["wp:author_id"]))
      ) {
        await saveAuthors([authors], destinationStackId, projectId,contenttype, master_locale, project?.locales,project);
      } else {
        const message = getLogMessage(
          srcFunc,
          `No authors UID found`,
          {}
        )
        await customLogger(projectId, destinationStackId, 'info', message);
      }
    } else {
      const message = getLogMessage(
        srcFunc,
        `No authors found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    }
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error while getting authors`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
}
/************  end of authors module functions *********/

const convertHtmlToJson = (htmlString: unknown): any => {
  if (typeof htmlString === 'string') {
    const dom = new JSDOM(htmlString.replace(/&amp;/g, "&"));
    const htmlDoc = dom.window.document.querySelector("body");
    return htmlToJson(htmlDoc);
  }

  return htmlString;
};

const convertJsonToHtml =  (json: any) => {
  const htmlValue =  jsonToHtml(json);
  return htmlValue;

}


/************  Start of Global fields module functions *********/
async function copyFolder(src: string, dest: string) {
  try {
    // Create the destination folder if it doesn't exist
    await fs.promises.mkdir(dest, { recursive: true });

    // Read all items in the source folder
    const items = await fs.promises.readdir(src, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      // If the item is a directory, recursively copy its contents
      if (item.isDirectory()) {
        await copyFolder(srcPath, destPath);
      } else {
        // If the item is a file, copy it to the destination
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    const message = getLogMessage(
      "copyFolder",
      `Error copying folder from ${src} to ${dest}.`,
      {},
      err
    )
    await customLogger("projectId", dest, 'error', message);

  }
}
async function extractGlobalFields(destinationStackId: string, projectId: string) {
  const srcFunc = "extractGlobalFields";
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "upload-api",
    "migration-wordpress"
  );
  const destinationPath = path.join(MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG.DATA);

  const foldersToCopy = ["locales"]; //, "global_fields", "extensions"

  for (const folder of foldersToCopy) {
    const sourceFolderPath = path.join(sourcePath, folder);
    const destinationFolderPath = path.join(destinationPath, folder);

    try {
      await copyFolder(sourceFolderPath, destinationFolderPath);
      const message = getLogMessage(
        srcFunc,
        `Successfully copied ${folder}`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    } catch (err) {
      const message = getLogMessage(
        srcFunc,
        `Error copying ${folder}.`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
    }
  }
}
/************  end of Global fields module functions *********/

const createVersionFile = async (destinationStackId: string, projectId: string) => {
  try {
    await writeFileAsync(path?.join?.(DATA, destinationStackId, EXPORT_INFO_FILE),
      {
        contentVersion: 2,
        logsPath: "",
      }, 4)
      const message = getLogMessage(
        "createVersionFile",
        `Version File created`,
        {}
      );
      await customLogger(projectId, destinationStackId, "info", message);
  } catch (err) {
    const message = getLogMessage(
      "createVersionFile",
      `Error writing file: ${err}`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
};

export const wordpressService = {
  getAllAssets,
  createLocale,
  getAllAuthors,
  extractGlobalFields,
  createVersionFile,
  createEntry,
  createTaxonomy
};