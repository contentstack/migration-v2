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
import { hasMeaningfulHtmlContent, normalizeHtmlFragment, setupWordPressBlocks, stripHtmlTags } from "../utils/wordpressParseUtil.js";
import { getMimeTypeFromExtension } from "../utils/mimeTypes.js";
import { MEDIA_BLOCK_NAMES, WORDPRESS_MISSSING_BLOCKS  } from "../constants/index.js";

const { JSDOM } = jsdom;

// Get the current file's path
const __filename = fileURLToPath(import.meta.url);

// Get the current directory
const __dirname = path.dirname(__filename);

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG

let assetsSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
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

let authorsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME
);
let authorsFilePath = path.join(
  authorsFolderPath,
  MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
);


const TaxonomiesSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME
);


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

const normalizeNicenameForUid = (nicename: unknown) =>
  String(nicename ?? "").replace(/-/g, "_").replace(/\s+/g, "_");

let failedJSONFilePath = path.join(
  assetMasterFolderPath,
  MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
);
const failedJSON: Record<string, any> = {};
let assetData: Record<string, any> | any = {};

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
  const cleanedHtml = html
    ?.replace(/<figure[^>]*>/g, "")
    ?.replace(/<\/figure>/g, "");
  const dom = new JSDOM(cleanedHtml);
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);

}

const getLocale = (master_locale: string, project: any) => {
  for (const key of Object.keys(project?.master_locale || {})) {
    if (key === master_locale) {
      return key;
    }
  }
  //return project?.master_locale?.[master_locale] ? project.master_locale[master_locale] : master_locale;
}

function getLastUid(uid : string) {
  return uid?.split?.('.')?.[uid?.split?.('.')?.length - 1];
}

/** Align WP block slugs (`accordion_item`) with mapper (`accordion-item`). */
function normalizedWpSlug(raw: string | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-");
}

/** Descendant fields may use Contentstack UIDs under the modular child, or legacy backup/wp paths when only some nested fields were remapped in CS. */
function fieldMappedUnderModularChild(modularChild: any, field: any): boolean {
  const childCsUid = modularChild?.contentstackFieldUid || '';
  const fUid = field?.contentstackFieldUid || '';
  if (childCsUid && fUid.startsWith(`${childCsUid}.`)) return true;
  const wpRoot = modularChild?.backupFieldUid || modularChild?.uid || '';
  if (!wpRoot) return false;
  const fieldWpKey = field?.backupFieldUid || field?.uid || '';
  return Boolean(fieldWpKey && fieldWpKey.startsWith(`${wpRoot}.`));
}

/** Only `advanced.multiple` reflects the Contentstack field for group/array payloads against CS validation. */
function fieldIsMultipleInContentstack(field: any): boolean {
  return field?.advanced?.multiple === true;
}

/** Repeatable sibling leaves inside groups (mapper often uses advanced.initial.multiple for list-items). */
function fieldAllowsRepeatedLeaves(field: any): boolean {
  return (
    fieldIsMultipleInContentstack(field) ||
    field?.advanced?.initial?.multiple === true
  );
}

function isDirectFieldOfModularBlock(modularChild: any, f: any): boolean {
  const mb = modularChild?.contentstackFieldUid || '';
  const fUid = f?.contentstackFieldUid || '';
  if (!mb || !fUid.startsWith(`${mb}.`)) return false;
  const rest = fUid?.slice(mb?.length + 1);
  return Boolean(rest && !rest?.includes('.'));
}

/**
 * Pull mb*-level sibling groups (group2, group3, …) off a nested group's output so they land on the modular row,
 * even when WP nested them inside group1 (e.g. core/details beside inner quote).
 */
function partitionModularDirectSiblings(
  processedGroup: Record<string, any>,
  modularChild: any | undefined,
  allFields: any[],
  currentGroupLastUid: string,
): { remainder: Record<string, any>; hoisted: Record<string, any> } {
  const remainder: Record<string, any> = {};
  const hoisted: Record<string, any> = {};
  if (!processedGroup || !Object.keys(processedGroup)?.length || !modularChild) {
    return { remainder: { ...processedGroup }, hoisted: {} };
  }
  const directSegs = new Set(
    allFields
      .filter((f: any) => isDirectFieldOfModularBlock(modularChild, f))
      .map((f: any) => getLastUid(f.contentstackFieldUid)),
  );
  for (const [seg, val] of Object.entries(processedGroup)) {
    if (directSegs?.has(seg) && seg !== currentGroupLastUid) {
      hoisted[seg] = val;
    } else {
      remainder[seg] = val;
    }
  }
  return { remainder, hoisted };
}

/** Direct CS children of a group, plus same-level children on backupFieldUid (mixed CS/legacy mappers). */
function getNestedFieldsForGroup(childField: any, modularChild: any | undefined, allFields: any[]): any[] {
  const groupFieldUid = childField?.contentstackFieldUid || '';
  const groupWpRoot = childField?.backupFieldUid || childField?.uid || '';
  const byCs =
    allFields?.filter((field: any) => {
      const fieldUid = field?.contentstackFieldUid || '';
      if (!fieldUid || !groupFieldUid) return false;
      if (!fieldUid.startsWith(`${groupFieldUid}.`)) return false;
      const remainder = fieldUid?.substring(groupFieldUid.length + 1);
      return Boolean(remainder && !remainder.includes('.'));
    }) || [];
  if (!groupWpRoot || !modularChild) {
    return byCs;
  }
  const byWp =
    allFields?.filter((field: any) => {
      const bk = field?.backupFieldUid || field?.uid || '';
      if (!bk.startsWith(`${groupWpRoot}.`)) return false;
      const rest = bk.slice(groupWpRoot.length + 1);
      if (!rest || rest.includes('.')) return false;
      return fieldMappedUnderModularChild(modularChild, field);
    }) || [];
  const seen = new Set(byCs.map((f: any) => f?.contentstackFieldUid || f?.id));
  const merged = [...byCs];
  for (const f of byWp) {
    const k = f?.contentstackFieldUid || f?.id;
    if (k != null && !seen.has(k)) {
      seen.add(k);
      merged.push(f);
    }
  }
  return merged;
}

/** Modular children by CS uid (`modular_blocks_2.mb1`) union backup/wp uid (`modular_blocks.paragraph_*`) when CS uids weren't all remapped. */
function getModularBlockChildrenForField(modularField: any, allFields: any[]): any[] {
  const parentCsUid = modularField?.contentstackFieldUid || '';
  const parentWpRoot = modularField?.backupFieldUid || modularField?.uid || '';
  const byCs =
    allFields?.filter((f: any) => {
      const fUid = f?.contentstackFieldUid || '';
      return (
        f?.contentstackFieldType === 'modular_blocks_child' &&
        !!parentCsUid &&
        fUid.startsWith(`${parentCsUid}.`) &&
        !fUid.substring(parentCsUid?.length + 1)?.includes('.')
      );
    }) || [];
  const byWp =
    parentWpRoot
      ? allFields?.filter((f: any) => {
          const bk = f?.backupFieldUid || f?.uid || '';
          return (
            f?.contentstackFieldType === 'modular_blocks_child' &&
            bk.startsWith(`${parentWpRoot}.`) &&
            !bk.slice(parentWpRoot.length + 1)?.includes('.')
          );
        }) || []
      : [];
  const seen = new Set(
    byCs.map((f: any) => `${f?.id ?? ''}:${f?.contentstackFieldUid ?? ''}`),
  );
  const merged = [...byCs];
  for (const f of byWp) {
    const k = `${f?.id ?? ''}:${f?.contentstackFieldUid ?? ''}`;
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(f);
    }
  }
  return merged;
}


const resolvedBlockName = (block: any) => {
  // 1. If metadata name exists, use it first
  if (block?.attrs?.metadata?.name) {
    return block.attrs.metadata.name;
  }

  // 2. Handle missing/invalid WordPress blocks
  const isMissingBlock =
    block?.blockName === WORDPRESS_MISSSING_BLOCKS ||
    (block?.blockName === null &&
      block?.innerHTML !== ' ');
  if (isMissingBlock) {
    // fallback to originalName, otherwise use body
   
    return block?.attrs?.originalName ?? "body";
  }

  // 3. Handle media-related blocks
  if (MEDIA_BLOCK_NAMES?.includes?.(block?.blockName)) {
    return "media";
  }

  // 4. Default fallback
  return block?.blockName;
};

/** WordPress core/group with one inner block is not an extra schema level (matches upload-api schemaMapper). */
function unwrapSingleChildGroup(block: any): any {
  let current = block;
  while (
    current?.blockName === 'core/group' &&
    Array.isArray(current?.innerBlocks) &&
    current.innerBlocks.length === 1
  ) {
    current = current.innerBlocks[0];
  }
  return current;
}

/** core/cover puts the image in attrs — not in innerBlocks; schema maps it to a file field otherCmsField "media". */
function attachCoverBackgroundMediaToChildren(
  coverBlock: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  const url = String(coverBlock?.attrs?.url ?? '').trim();
  if (coverBlock?.blockName !== 'core/cover' || !url || !modularChild) return;

  const mediaField = fields?.find(
    (f: any) =>
      f?.contentstackFieldType === 'file' &&
      fieldMappedUnderModularChild(modularChild, f) &&
      ((f?.otherCmsField || '')?.toLowerCase() === 'media' ||
        (f?.otherCmsType || '')?.toLowerCase() === 'media'),
  );
  if (!mediaField) return;

  const key = getLastUid(mediaField?.contentstackFieldUid);
  if (out[key] != null && out[key] !== '') return;

  const asset = formatChildByType(
    {
      blockName: 'core/image',
      attrs: { ...(coverBlock?.attrs || {}), url, src: url },
      innerHTML: coverBlock?.innerHTML,
      innerBlocks: [],
    },
    mediaField,
    assetData,
    fields,
  
);
  if (asset != null && asset !== '') out[key] = asset;
}

function firstImgSrcFromInnerHtml(innerHtml?: string): string {
  if (!innerHtml || typeof innerHtml !== 'string') return '';
  try {
    const $ = cheerio.load(innerHtml);
    return String($('img')?.first()?.attr('src') || '')?.trim();
  } catch {
    return '';
  }
}

/** core/media-text keeps mediaId / mediaType in attrs and image URL in innerHTML (not innerBlocks). */
function attachMediaTextFieldsToChildren(
  mediaTextBlock: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  if (mediaTextBlock?.blockName !== 'core/media-text' || !modularChild) return;

  const attrs = mediaTextBlock?.attrs || {};

  const mediaField = fields?.find(
    (f: any) =>
      f?.contentstackFieldType === 'file' &&
      fieldMappedUnderModularChild(modularChild, f) &&
      ((f?.otherCmsField || '').toLowerCase() === 'media' ||
        (f?.otherCmsType || '').toLowerCase() === 'media'),
  );

  const rawId = attrs?.mediaId ?? attrs?.media_id;
  const idNum = Number(rawId);
  const hasPositiveMediaId =
    rawId != null && rawId !== '' && !Number.isNaN(idNum) && idNum > 0;

  const urlFromAttrs = String(attrs?.url ?? attrs?.src ?? '')?.trim();
  const urlFromMarkup = firstImgSrcFromInnerHtml(mediaTextBlock?.innerHTML);
  const resolvedUrl = urlFromAttrs || urlFromMarkup;

  if (mediaField) {
    const key = getLastUid(mediaField?.contentstackFieldUid);
    const slotFree = out[key] == null || out[key] === '';
    const shouldAttach = slotFree && (hasPositiveMediaId || Boolean(resolvedUrl));
    if (shouldAttach) {
      const asset = formatChildByType(
        {
          blockName: 'core/image',
          attrs: {
            ...attrs,
            id: hasPositiveMediaId ? idNum : attrs?.id,
            url: resolvedUrl || urlFromAttrs,
            src: resolvedUrl || urlFromAttrs,
          },
          innerHTML: mediaTextBlock?.innerHTML,
          innerBlocks: [],
        },
        mediaField,
        assetData,
        fields,
      );
      if (asset != null && asset !== '') out[key] = asset;
    }
  }

  const mtRaw = attrs?.mediaType;
  const mt = typeof mtRaw === 'string' ? mtRaw.trim() : mtRaw != null ? String(mtRaw).trim() : '';
  if (!mt) return;

  const mediatypeField = fields?.find(
    (f: any) =>
      (f?.contentstackFieldType === 'single_line_text' ||
        f?.contentstackFieldType === 'text') &&
      fieldMappedUnderModularChild(modularChild, f) &&
      (f?.otherCmsField || '')?.toLowerCase() === 'mediatype',
  );
  if (!mediatypeField) return;

  const mtk = getLastUid(mediatypeField?.contentstackFieldUid);
  if (out[mtk] != null && out[mtk] !== '') return;

  const textValue = formatChildByType(
    { blockName: 'core/paragraph', attrs: {}, innerHTML: `<p>${mt}</p>`, innerBlocks: [] },
    mediatypeField,
    assetData,
  );
  if (textValue != null && textValue !== '') out[mtk] = textValue;
}

async function createSchema(fields: any, blockJson : any, title: string, uid: string, assetData: any, duplicateBlockMappings?: Record<string, string>) {
  const schema : any = {
    title: title,
    uid: uid,
    //fields: fields?.fields,
  };

  const cmsFieldMatchesWpBlockName = (
    otherCmsType: string | undefined,
    otherCmsField: string | undefined,
    wpRawName: string | undefined,
  ): boolean => {
    const primary = normalizedWpSlug(wpRawName);
    if (!primary) return false;
    const mappedRaw =
      duplicateBlockMappings && typeof duplicateBlockMappings[primary] === "string"
        ? duplicateBlockMappings[primary]
        : "";
    const mappedNorm = normalizedWpSlug(mappedRaw);
    const candidates =
      mappedNorm && mappedNorm !== primary ? [primary, mappedNorm] : [primary];
    const t = normalizedWpSlug(otherCmsType);
    const f = normalizedWpSlug(otherCmsField);
    return candidates.some((n) => n === t || n === f);
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
        
        // CS-path children under modular_blocks_2.* plus legacy backup-path modular_blocks.*
        const modularBlockChildren = getModularBlockChildrenForField(field, fields);
                
        // Process each block in blockJson to see if it matches any modular block child
        for (const block of blockJson) {
          try {
            const blockForProcessing = unwrapSingleChildGroup(block);
            const blockName = getFieldName(resolvedBlockName(blockForProcessing));
            const blockNameLc = normalizedWpSlug(blockName);
            
            // Find which modular block child this block matches
            let matchingChildField = fields.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase();
              const fieldType = childField?.otherCmsType?.toLowerCase();
              return (childField?.contentstackFieldType !== 'modular_blocks_child') && (blockNameLc === fieldName || blockNameLc === fieldType) 
            });
   
            let matchingModularBlockChild = modularBlockChildren.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase() ;
              return  blockNameLc === fieldName 
            });

            let modularMatchFromDuplicateMap = false;

            // Fallback: if no direct match, check duplicate block mappings
            if (!matchingModularBlockChild && duplicateBlockMappings) {
              const blockKeyLc = blockName?.toLowerCase?.() ?? "";
              const mappedName =
                duplicateBlockMappings[blockKeyLc] ?? duplicateBlockMappings[blockName];

              if (mappedName) {
                matchingModularBlockChild = modularBlockChildren.find((childField: any) => {
                  const fieldName = childField?.otherCmsField?.toLowerCase();
                  return mappedName === fieldName;
                });

                matchingChildField = fields.find((childField: any) => {
                  const fieldName = childField?.otherCmsField?.toLowerCase();
                  const fieldType = childField?.otherCmsType?.toLowerCase();
                  return (
                    childField?.contentstackFieldType !== "modular_blocks_child" &&
                    (mappedName === fieldName || mappedName === fieldType)
                  );
                });
                modularMatchFromDuplicateMap = !!(
                  matchingModularBlockChild && matchingChildField
                );
              }
            }

            // Duplicate-map + single inner: new modular row; list item lives in mapped field only (does not merge into prior heading).
            if (
              modularMatchFromDuplicateMap &&
              blockForProcessing?.innerBlocks?.length === 1
            ) {
              const piece = formatChildByType(
                unwrapSingleChildGroup(blockForProcessing.innerBlocks[0]),
                matchingChildField,
                assetData,
                fields,
              );
              if (piece != null && piece !== "") {
                const mk = getLastUid(matchingModularBlockChild!.contentstackFieldUid);
                const fk = getLastUid(matchingChildField!.contentstackFieldUid);
                modularBlocksArray.push({ [mk]: { [fk]: piece } });
                continue;
              }
            }

            //if (matchingChildField) {
              if (matchingModularBlockChild?.uid) {
                const childrenObject: Record<string, any> = {};
                attachCoverBackgroundMediaToChildren(
                  blockForProcessing,
                  matchingModularBlockChild,
                  fields,
                  assetData,
                  childrenObject,
                );
                attachMediaTextFieldsToChildren(
                  blockForProcessing,
                  matchingModularBlockChild,
                  fields,
                  assetData,
                  childrenObject,
                );

                const inners = blockForProcessing?.innerBlocks;
                if (Array.isArray(inners) && inners?.length > 0) {
                  inners.forEach((child: any, childIndex: number) => {
                    try {
                      const effectiveChild = unwrapSingleChildGroup(child);

                      const childBlockName =
                        getFieldName(resolvedBlockName(effectiveChild))?.toLowerCase() ||
                        getFieldName(resolvedBlockName(effectiveChild)?.toLowerCase());
                      const childBlockSlug = normalizedWpSlug(childBlockName);
                      const childField = fields.find((f: any) => {
                        const fOtherCmsType = f?.otherCmsType?.toLowerCase();
                        const fOtherCmsField = f?.otherCmsField?.toLowerCase();
                        const ck = getLastUid(f?.contentstackFieldUid);
                        const taken = childrenObject[ck] !== undefined && childrenObject[ck] !== null;
                        return (
                          fieldMappedUnderModularChild(matchingModularBlockChild, f) &&
                          cmsFieldMatchesWpBlockName(
                            fOtherCmsType,
                            fOtherCmsField,
                            childBlockSlug,
                          ) &&
                          (!taken || fieldIsMultipleInContentstack(f))
                        );
                      });

                      if (childField) {
                        const childKey = getLastUid(childField?.contentstackFieldUid);

                        if (childField?.contentstackFieldType === 'group') {
                          const processedGroup = processNestedGroup(
                            effectiveChild,
                            childField,
                            fields,
                            matchingModularBlockChild,
                          );
                          const { remainder, hoisted } = partitionModularDirectSiblings(
                            processedGroup || {},
                            matchingModularBlockChild,
                            fields,
                            childKey,
                          );
                          if (Object.keys(hoisted)?.length) {
                            Object.assign(childrenObject, hoisted);
                          }
                          if (
                            fieldIsMultipleInContentstack(childField) &&
                            remainder &&
                            Object.keys(remainder)?.length > 0
                          ) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject?.[childKey]?.push(remainder);
                            } else {
                              childrenObject[childKey] = [remainder];
                            }
                          } else if (
                            remainder &&
                            Object.keys(remainder)?.length > 0
                          ) {
                            childrenObject[childKey] = remainder;
                          }

                          const formattedChild = formatChildByType(
                            effectiveChild,
                            childField,
                            assetData,
                            fields,
                          );

                          if (fieldIsMultipleInContentstack(childField) && formattedChild) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject[childKey]?.push(formattedChild);
                            } else {
                              childrenObject[childKey] = [formattedChild];
                            }
                          } else {
                            formattedChild && (childrenObject[childKey] = formattedChild);
                          }
                        } else {
                          const formattedChild = formatChildByType(
                            effectiveChild,
                            childField,
                            assetData,
                            fields,
                          );
                          if (fieldIsMultipleInContentstack(childField) && formattedChild) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject[childKey]?.push(formattedChild);
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
                }

                const modularKey = getLastUid(matchingModularBlockChild?.contentstackFieldUid);
                if (Object.keys(childrenObject).length > 0) {
                  modularBlocksArray.push({ [modularKey]: childrenObject });
                } else if (modularKey && matchingChildField) {
                  const formattedBlock = formatChildByType(
                    blockForProcessing,
                    matchingChildField,
                    assetData,
                    fields,
                  );
                  formattedBlock &&
                    modularBlocksArray?.push({
                      [modularKey]: {
                        [getLastUid(matchingChildField?.contentstackFieldUid)]: formattedBlock,
                      },
                    });
                }
              }
            //}
          } catch (blockError) {
            console.warn('Error processing block:', blockError);
          }
        }
        
        // Set the modular blocks array in the schema
        if (modularBlocksArray.length > 0) {
          schema[field?.contentstackFieldUid] = modularBlocksArray;
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
function processNestedGroup(
  child: any,
  childField: any,
  allFields: any[],
  modularBlockChild?: any,
): Record<string, any> {
  const nestedChildrenObject: Record<string, any> = {};
  const groupBlock = unwrapSingleChildGroup(child);
  if (!groupBlock?.innerBlocks?.length || !Array.isArray(groupBlock?.innerBlocks)) {
    // No nested children, return empty object for group type
    return {};
  }
  
  const nestedFields = getNestedFieldsForGroup(childField, modularBlockChild, allFields);

  if (nestedFields?.length === 0 && !modularBlockChild) {
    return {};
  }
 
  groupBlock.innerBlocks.forEach((nestedChild: any, nestedIndex: number) => {
    try {
      const nestedEffective = unwrapSingleChildGroup(nestedChild);
      const nestedSlug = normalizedWpSlug(
        getFieldName(resolvedBlockName(nestedEffective)) || "",
      );
      const fromStrict = nestedFields?.find((field: any) => {
        const matchesBlock =
          normalizedWpSlug(field?.otherCmsType) === nestedSlug ||
          normalizedWpSlug(field?.otherCmsField) === nestedSlug;

        const uid = getLastUid(field?.contentstackFieldUid);
        const allowReuse =
          fieldAllowsRepeatedLeaves(field) ||
          !nestedChildrenObject[uid]?.length;
       
        return matchesBlock && allowReuse;
      });
      const siblingDirect = modularBlockChild
        ? allFields.filter((field: any) => {
            const fUid = field?.contentstackFieldUid || '';
            if (fUid === (childField?.contentstackFieldUid || '')) return false;
            if (!isDirectFieldOfModularBlock(modularBlockChild, field)) return false;
            const t = field?.otherCmsType?.toLowerCase();
            const n = field?.otherCmsField?.toLowerCase();
            return (
              normalizedWpSlug(t) === nestedSlug || normalizedWpSlug(n) === nestedSlug
            );
          })
        : [];
      const fromModularSibling = siblingDirect?.find((field: any) => {
        const uid = getLastUid(field?.contentstackFieldUid);
        return (
          fieldAllowsRepeatedLeaves(field) ||
          !nestedChildrenObject[uid]?.length
        );
      });
      const nestedChildField = fromStrict || fromModularSibling;
      
      
      if (!nestedChildField) {
        //console.info("no nested child field found ", nestedChild, nestedChildField, nestedFields, childField)
        return;
      }
      
      const nestedChildKey = getLastUid(nestedChildField?.contentstackFieldUid);
      
      if (nestedChildField?.contentstackFieldType === 'group') {
        const deeplyNestedObject = processNestedGroup(
          nestedEffective,
          nestedChildField,
          allFields,
          modularBlockChild,
        );
        const { remainder, hoisted } = partitionModularDirectSiblings(
          deeplyNestedObject || {},
          modularBlockChild,
          allFields,
          nestedChildKey,
        );
        if (Object.keys(hoisted)?.length > 0) {
          Object.assign(nestedChildrenObject, hoisted);
        }
        const nestedPayload =
          Object.keys(remainder)?.length > 0
            ? remainder
            : Object.keys(hoisted)?.length > 0 &&
                Object.keys(deeplyNestedObject || {})?.length > 0
              ? {}
              : deeplyNestedObject || {};
        if (fieldIsMultipleInContentstack(nestedChildField)) {
          if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
            nestedChildrenObject[nestedChildKey].push(nestedPayload);
          } else {
            nestedChildrenObject[nestedChildKey] = [nestedPayload];
          }
        } else {
          nestedChildrenObject[nestedChildKey] = nestedPayload;
        }
      } else {
  
          const formattedNestedChild = formatChildByType(nestedEffective, nestedChildField, assetData, allFields);
          if (fieldAllowsRepeatedLeaves(nestedChildField)) {
            if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
              formattedNestedChild && nestedChildrenObject[nestedChildKey].push(formattedNestedChild);
            } else {
              formattedNestedChild && (nestedChildrenObject[nestedChildKey] = [formattedNestedChild]);
            }
          } else {
            formattedNestedChild && (nestedChildrenObject[nestedChildKey] = formattedNestedChild);
          }

       //}
        
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
  
  return normalizeHtmlFragment(html);
}

// Helper function to extract all HTML from innerBlocks recursively
function extractAllHtmlFromInnerBlocks(block: any): any {
  const html = collectHtmlFromInnerBlocks(block);
  return html ;
}

/** Block HTML: top-level innerHTML, optional attrs/attributes, joined innerContent, or nested innerBlocks. */
function getBlockInnerHtmlString(block: any): string {
  const nonEmpty = (s: unknown): s is string =>
    typeof s === 'string' && s.trim().length > 0;

  const direct = [
    block?.innerHTML,
    block?.attrs?.innerHTML,
    block?.attributes?.innerHTML,
    block?.innerHtml
  ].find(nonEmpty) as string | undefined;
  if (direct) {
    return normalizeHtmlFragment(direct);
  }
  if (Array.isArray(block?.innerContent)) {
    const fromInnerContent = block.innerContent
      .map((p: any) => (typeof p === 'string' ? p : ''))
      .join('')
      .trim();
    if (fromInnerContent) {
      return normalizeHtmlFragment(fromInnerContent);
    }
  }
  return collectHtmlFromInnerBlocks(block);
}

// Helper function to format child blocks based on their type and field configuration
function formatChildByType(child: any, field: any, assetData: any, fields?: any[], value?: any) {
  let formatted ;
  
  try {
    
    // Process attributes based on field type configuration
    //if (child?.attributes && typeof child.attributes === 'object') {
     const attrKey = getFieldName(getFieldName(resolvedBlockName(child))?.toLowerCase() || getFieldName(resolvedBlockName(child)?.toLowerCase()));
        try {
          const attrValue = child?.attrs?.innerHTML ?? value ?? '';
          
          
          // Format based on common field types
          switch (field?.contentstackFieldType || 'text') {
            case 'modular_blocks':
              formatted = [];
              break;

            case 'multi_line_text':
            case 'single_line_text': {
              let htmlSource = '';
              if (child?.blockName != null && child.blockName !== '') {
                htmlSource = String(child.innerHTML ?? value ?? '').trim()
                  ? String(child.innerHTML ?? value ?? '')
                  : String(
                      getBlockInnerHtmlString(child) ??
                        collectHtmlFromInnerBlocks(child) ??
                        value ??
                        '',
                    );
                formatted = stripHtmlTags(htmlSource);
              } else {
                formatted =
                  stripHtmlTags(String(child?.innerHTML ?? value ?? '')) ||
                  (child ?? value ?? '');
              }
              break;
            }

            case 'number':
              formatted = typeof attrValue === 'number' ? attrValue : Number(attrValue) || 0;
              break;

            case 'boolean':
              formatted = Boolean(child?.attrs[attrKey]);
              break;

            case 'json': {
              let htmlContent = value ?? '';
                // Check if otherCmsField is "columns" - get all HTML data
              if (field?.otherCmsField?.toLowerCase() === 'columns') {
                htmlContent = extractAllHtmlFromInnerBlocks(child);
              }
              
              if (!htmlContent && child?.innerBlocks?.length > 0) {
                htmlContent = collectHtmlFromInnerBlocks(child);
              }
              if (!htmlContent) {
                htmlContent = (child?.blockName || child?.innerHTML)
                  ? child?.innerHTML
                  : child;
              }
              if (typeof htmlContent === 'string') {
                htmlContent = normalizeHtmlFragment(htmlContent);
              }
              const hasMeaningfulHtml = hasMeaningfulHtmlContent(htmlContent);

              // Only set when there is visible text or media/embeds; do not assign `undefined` (avoids false from `a && fn()` in multi-RTE).
              if (hasMeaningfulHtml ) {
                formatted = RteJsonConverter(htmlContent);
              }
              else if (value) {
                formatted = RteJsonConverter(value);
                
              }
              break;
            }

            case 'html': {
              const rawHtml = child?.blockName
                ? (formatted ?? child?.innerHTML)
                : `<p>${child?.innerHTML}</p>`;
              const htmlContent =
                typeof rawHtml === 'string'
                  ? normalizeHtmlFragment(rawHtml)
                  : rawHtml;
              const hasMeaningfulHtml = hasMeaningfulHtmlContent(htmlContent);

              if (hasMeaningfulHtml) {
                formatted = htmlContent;
              }else if (value) {
                formatted = `<p>${value}</p>`;
              
              }
              break;
            }

            case 'link': {
              const attrs = child?.attrs ?? child?.attributes ?? {};
              if (attrs.service) {
                formatted = { title: attrs.service, href: attrs.url };
                break;
              }
              const html = getBlockInnerHtmlString(child?.innerBlocks ? child?.innerBlocks[0] : child);
            
              let href = typeof attrs.url === 'string' && attrs.url ? attrs.url : '';
              let title = '';
              if (html) {
                try {
                  const $ = cheerio.load(html);
                  const a = $('a').first();
                  if (a?.length) {
                    href = a.attr('href') || href;
                    title = a.text().trim();
                    
                  } else {
                    title = $('button').first().text().trim();
                    
                  }
                } catch (e) {
                  console.warn('Error parsing innerHTML for link:', e);
                }
              }
              if (!title) {
                title =
                  (typeof attrs.text === 'string' && attrs.text.trim()) ||
                  (typeof attrs.title === 'string' && attrs.title.trim()) ||
                  (html ? stripHtmlTags(html).trim() : '') ||
                  '';
              }
              formatted = { title, href: href || '' };
              break;
            }

            case 'file': {
              // Extract media URL from innerHTML: img (core/image) or audio/source (core/audio)
              let fileName = '';
              let imgUrl = child?.attrs?.src ?? child?.attrs?.url;
              let id = child?.attrs?.id;

              const innerHtml = child?.innerHTML;
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
                      const fileNameWithExt = urlParts[urlParts?.length - 1]?.split('?')[0]; // Remove query params
                      fileName = fileNameWithExt.includes('.') ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.')) : fileNameWithExt;
                    }
                  }
                  if (!fileName) {
                    const audioTag = $('audio').first();
                    let audioSrc = audioTag.attr('src');
                    if (!audioSrc) {
                      audioSrc = audioTag.find('source').first().attr('src') || '';
                    }
                    if (audioSrc) {
                      imgUrl = audioSrc;
                      const urlParts = audioSrc.split('/');
                      const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                      fileName = fileNameWithExt.includes('.') ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.')) : fileNameWithExt;
                    }
                  }
                } catch (htmlError) {
                  console.warn('Error parsing innerHTML for img/audio:', htmlError);
                }
              }
              // Blocks that store file URL on attrs (e.g. core/file href; some exports typo "herf")
              if (!fileName && (child?.attrs?.href || child?.attrs?.herf)) {
                const attrHref = child?.attrs?.href || child?.attrs?.herf;
                if (typeof attrHref === 'string' && attrHref) {
                  imgUrl = attrHref;
                  const urlParts = attrHref.split('/');
                  const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                  fileName = fileNameWithExt.includes('.')
                    ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.'))
                    : fileNameWithExt;
                }
              }

              // If no filename extracted from innerHTML, try to get it from src URL
              if (!fileName && imgUrl) {
                const urlParts = imgUrl.split('/');
                fileName = urlParts[urlParts.length - 1].split('?')[0];
              }

              const asset = assetData[`assets_${id}`] || assetData[fileName?.replace(/-/g, '_')?.toLowerCase()];
              formatted = asset;
              break;
            }

            case 'markdown':
              formatted = stripHtmlTags(child?.innerHTML);
              break;

            case 'group': {
             
              const attrs = child?.attrs || child?.attributes;
              const childBlockName =
                resolvedBlockName(child) || attrs?.originalName || child?.blockName;
              // Jetpack Story: slides in attrs.mediaFiles. Non-multiple CS groups get the first slide only.
              if (
                childBlockName === 'jetpack/story' &&
                Array.isArray(attrs?.mediaFiles)
              ) {
                const slides = attrs.mediaFiles.map((mf: any) => {
                  const id = mf?.id;

                  const imgUrl = mf?.url || '';
                  let baseName = '';
                  if (imgUrl) {
                    const urlParts = imgUrl.split('/');
                    const withExt = urlParts[urlParts.length - 1].split('?')[0];
                    baseName = withExt.includes('.')
                      ? withExt.substring(0, withExt.lastIndexOf('.'))
                      : withExt;
                  }
                  const asset = assetData[`assets_${id}`];
                  
                  const titleField = fields?.find((field: any) => field?.otherCmsField?.toLowerCase() === 'title' && field?.contentstackField?.includes(getFieldName(childBlockName)));
                  const altField = fields?.find((field: any) => field?.otherCmsField?.toLowerCase() === 'alt' && field?.contentstackField?.includes(getFieldName(childBlockName)));
                  const captionField = fields?.find((field: any) => field?.otherCmsField?.toLowerCase() === 'caption' && field?.contentstackField?.includes(getFieldName(childBlockName)));
                 
                  return {
                    title: formatChildByType(mf?.title, titleField, assetData, fields, mf?.title),
                    alt: formatChildByType(mf?.alt, altField, assetData, fields, mf?.alt),
                    caption: formatChildByType(mf?.caption, captionField, assetData, fields, mf?.caption),
                    image: asset,
                  };
                });
                // Non-multiple CS groups expect one object; Jetpack mediaFiles is always an array.
                formatted =
                  slides.length === 0
                    ? undefined
                    : field?.advanced?.multiple === true
                      ? slides
                      : slides[0];
              } 
              break;
            }

            default:
              // Default formatting - preserve original structure with null check
              formatted = attrValue ?? '';
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
const extractCategoryReference = (categories: any) => {
  const categoryArray = Array?.isArray(categories) ? categories : [categories];

  const categoryReference = categoryArray?.filter((category: any) => category?.attributes?.domain === 'category');

  return categoryReference;

}

const extractTermsReference = (terms: any) => {
  const termArray = Array?.isArray(terms) ? terms : [terms];
  const termReference = termArray?.filter((term: any) => term?.attributes?.domain !== 'category');
  return termReference;
}
async function saveEntry(fields: any, entry: any,  file_path: string, assetData : any, categories: any, master_locale: string, destinationStackId: string, project: any, allTerms: any, duplicateBlockMappings?: Record<string, string>) {
  const locale = getLocale(master_locale, project);
  const mapperKeys = project?.mapperKeys || {};
  const authorsCtName = mapperKeys[MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME] ? mapperKeys[MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME] : MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  const authorsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG?.ENTRIES_DIR_NAME,authorsCtName, master_locale);
  const authorsFilePath = path.join(authorsSave,`${master_locale}.json` );
  const authorsData = JSON.parse(await fs.promises.readFile(authorsFilePath, "utf8")) || {};

  //const Jsondata = await fs.promises.readFile(file_path, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const items = $('item');
  const entryData: Record<string, any> = {};

  try {
    if(entry ){
      // Process each entry with its corresponding XML item
      for (let i = 0; i < entry?.length; i++) {
        const taxonomies: any = [];
        const tags: any = [];
        const item = entry[i];
        const terms = [];
        if(item?.['category']?.length > 0){
          const category = item?.['category']?.filter((category: any) => category?.attributes?.domain === 'category');
          tags.push(...item?.['category']?.filter((category: any) => category?.attributes?.domain === 'post_tag') || []);

          for(const cat of category){
            const parentCategoryUid = categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.["wp:category_parent"];
            const parentCategory = parentCategoryUid ? categories?.find((category: any) => category?.["wp:category_nicename"] === parentCategoryUid)?.['wp:term_id'] 
            : categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.['wp:term_id'];
            const categoryName = cat?.attributes?.nicename;
            
            taxonomies.push({
              "taxonomy_uid": parentCategoryUid
                ? `${normalizeNicenameForUid(parentCategoryUid)}_${parentCategory}`
                : `${normalizeNicenameForUid(categoryName)}_${parentCategory}`,
              "term_uid": parentCategoryUid
                ? normalizeNicenameForUid(categoryName)
                : `${normalizeNicenameForUid(categoryName)}_${parentCategory}`
            });
          } 

          const termCategory = item?.['category']?.filter((category: any) => category?.attributes?.domain !== 'category');
          for(const term of termCategory){
            const uid = allTerms?.find((item: any) => term?.attributes?.nicename === item?.["wp:term_slug"])?.["wp:term_id"];
            terms.push({
              "uid": `terms_${uid}`,
              "_content_type_uid": 'terms'
            });

          }
        }
        const uid = idCorrector(`posts_${item?.["wp:post_id"]}`);
        const author = Object?.keys(authorsData)?.find((key: any) => authorsData[key]?.title?.toLowerCase() === item?.['dc:creator']?.toLowerCase());
        const authorData = [{
          "uid":author,
          "_content_type_uid": authorsCtName
        }];
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


          // Pass individual content to createSchema
          entryData[uid] = await createSchema(fields, blocksJson, item?.title, uid, assetData, duplicateBlockMappings);
          const categoryReference = extractCategoryReference(item?.['category']);
          if (categoryReference?.length > 0) {
            entryData[uid]['taxonomies'] = taxonomies;
          }
          const termsReference = extractTermsReference(item?.['category']);
          if(termsReference?.length > 0) {
            entryData[uid]['terms'] = terms;
          }
          entryData[uid]['tags'] = tags?.map((tag: any) => tag?.text);
          entryData[uid]['author'] = authorData;
          entryData[uid]['locale'] = locale;
          entryData[uid]['publish_details'] = [];
          
            
          
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
  }
  return entryData;
}
async function createEntry(file_path: string, packagePath: string, destinationStackId: string, projectId: string, contentTypes: any, mapperKeys: any, master_locale: string, project: any){
  const locale = getLocale(master_locale, project) || master_locale;
  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const entriesJsonData = JSON.parse(Jsondata);
  const entries = entriesJsonData?.rss?.channel?.["item"];
  const categories = entriesJsonData?.rss?.channel?.["wp:category"];
  const allCategories = Array?.isArray(categories) ? categories : (categories ? [categories] : []);

  const authorsData = entriesJsonData?.rss?.channel?.["wp:author"];
  const authors = Array?.isArray(authorsData) ? authorsData : [authorsData];

  const termsData = entriesJsonData?.rss?.channel?.["wp:term"];
  const allTerms = Array?.isArray(termsData) ? termsData : [termsData];
 
  assetsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME);
  const assetsSchemaPath = path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
  const assetData = JSON.parse(await fs.promises.readFile(assetsSchemaPath, "utf8")) || {};

  const itemsArray = Array?.isArray(entries) ? entries : (entries ? [entries] : []);
  

  if(! existsSync(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME))){
    await fs.promises.mkdir(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME), { recursive: true });
  }
  const authorContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid === 'author');
  if(authorContentTypes?.length > 0){
    const postsFolderName = mapperKeys[authorContentTypes?.[0]?.contentstackUid] ? mapperKeys[authorContentTypes?.[0]?.contentstackUid] : authorContentTypes?.[0]?.contentstackUid;
  
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

  const termsContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid === 'terms');
  if(termsContentTypes?.length > 0){
    const termsFolderName = mapperKeys[termsContentTypes?.[0]?.contentstackUid] ? mapperKeys[termsContentTypes?.[0]?.contentstackUid] : termsContentTypes?.[0]?.contentstackUid;

    const termsFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, termsFolderName, locale);

    if(! existsSync(termsFolderPath)){
      await fs.promises.mkdir(termsFolderPath, { recursive: true });
    }
    const termsContent = await createTerms(allTerms, destinationStackId, projectId, termsContentTypes[0],master_locale, project?.locales, project);
   
    const filePath = path.join(termsFolderPath,  `${locale}.json`);

    await writeFileAsync(filePath, termsContent, 4);

    await fs.promises.writeFile(path.join(termsFolderPath, "index.json"),
      JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
    );
  }
  const postContentTypes = contentTypes?.filter(
    (contentType: any) =>
      contentType?.contentstackUid !== 'author' &&
      contentType?.contentstackUid !== 'terms'
  );
  

  
  for(const contentType of postContentTypes){
    //await startingDirPosts(contentType?.contentstackUid, master_locale, project?.locales); 
    const postsFolderName = mapperKeys[contentType?.contentstackUid] ? mapperKeys[contentType?.contentstackUid] : contentType?.contentstackUid;
    // Create master locale folder and file
    postFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName, locale);
    if(postFolderPath &&! existsSync(postFolderPath)){
      await fs.promises.mkdir(postFolderPath, { recursive: true });
    }
    const contentTypeUid = contentType?.contentstackTitle?.toLowerCase();
    const statusArray = ["publish", "inherit"];
    const entry = entries?.filter((data: any) => {
      const matchesType = data?.["wp:post_type"]?.toLowerCase() === contentTypeUid;
      const matchesStatus = statusArray.includes(data?.["wp:status"]);
      return matchesType && matchesStatus;
    });

      const content = await saveEntry(contentType?.fieldMapping, entry,file_path, assetData, allCategories, master_locale, destinationStackId, project, allTerms, contentType?.duplicateBlockMappings) || {};
      
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

  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await fs.promises.readFile(file_path, "utf8");
  const categoriesData = JSON.parse(Jsondata)?.rss?.channel?.["wp:category"] || JSON.parse(Jsondata)?.channel?.["wp:category"];
  const categoriesJsonData = Array?.isArray(categoriesData) ? categoriesData : (categoriesData ? [categoriesData] : []);

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
            "uid": normalizeNicenameForUid(childCategory?.["wp:category_nicename"]),
            "name": childCategory?.["wp:cat_name"],
            "description": childCategory?.["wp:category_description"],
            "parent_uid": normalizeNicenameForUid(categoryUid),
          })
        }
        const taxonomy = {
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          
        }
        allTaxonomies[categoryUid] = {
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          
        }
        terms?.push({
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          "parent_uid": null,
        })
        const taxonomyData = {taxonomy, terms};
        await writeFileAsync(path.join(taxonomiesPath, `${normalizeNicenameForUid(categoryUid)}.json`), JSON.stringify(taxonomyData, null, 4), 4);
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

const getTermsFieldValue = (field: any, data: any, url: string) => {
  const fieldUid = field?.uid;
  const otherCmsField = field?.otherCmsField;
  const fieldUidLower = fieldUid?.toLowerCase();
  const otherCmsFieldLower = otherCmsField?.toLowerCase();
  
  // Field mapping for common WordPress author fields
  const fieldMapping: Record<string, string> = {
    'term_taxonomy': 'wp:term_taxonomy',
    'term_slug': 'wp:term_slug',
    'term_parent': 'wp:term_parent',
    'term_name': 'wp:term_name',
    'termmeta': 'wp:termmeta',
    'term_description': 'wp:term_description',

  };
  const wpFieldKey = fieldMapping[fieldUidLower] || fieldMapping[otherCmsFieldLower];
  if (wpFieldKey) {
    const value = data[wpFieldKey];
    // Handle special cases
    if (wpFieldKey === 'wp:term_name' && !value) {
      return data['wp:term_name'];
    }
    return value;
  }
  return null;
}
const createTerms = async (allTerms: any, destinationStackId: string, projectId: string, contentType: any, master_locale: string, locales: object, project: any) => {
  const srcFunc = 'createTerms';
  const localeKeys = getKeys(locales)
  try {
    const termsData:{ [key: string]: any } = {}

    for (const data of allTerms) {
      const uid = `terms_${data["wp:term_id"]}`;
      const title = data?.["wp:term_name"];
      const url = `/${title?.toLowerCase()?.replace(/ /g, "_")}`;
      const customId = idCorrector(uid);

      const termdataEntry: any = {
        uid: uid,
        title: data?.["wp:term_name"],
        url: url,
      };

      // Process each field in the content type's field mapping
      if (contentType?.fieldMapping && Array?.isArray(contentType?.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          const fieldValue = getTermsFieldValue(field, data, url);
          
          // Store the field value in authordataEntry using field.uid
          if (field?.uid && fieldValue !== undefined && fieldValue !== null) {
            termdataEntry[field?.contentstackFieldUid] = formatChildByType(fieldValue, field, assetData, contentType?.fieldMapping);
          }
        }
      }
      termsData[customId] = termdataEntry
      termsData[customId].publish_details = [];
      const message = getLogMessage(
        srcFunc,
        `Entry title ${data["wp:term_name"]} (terms) in the ${master_locale} locale has been successfully transformed.`,
        {}
      );
      await customLogger(projectId, destinationStackId, 'info', message);
    }

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
      `${allTerms?.length} Authors exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);


    return termsData;
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `error while Createing the terms.`,
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
  const filePath = path.join(assetPath, filename);

  // Skip only when the downloaded file already exists (not the empty folder).
  // Previously we mkdir'd assetPath then tested existsSync(assetPath), which is
  // always true after mkdir and incorrectly skipped every download.
  if (existsSync(filePath)) {
    return assets["wp:post_id"];
  }

  if (!existsSync(assetPath)) {
    await fs.promises.mkdir(assetPath, { recursive: true });
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    // Ensure files directory exists
    fs.mkdirSync(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    fs.writeFileSync(path.resolve(assetsSave, "files", customId, filename), response.data);

    const stats = fs.lstatSync(path.resolve(assetsSave, "files", customId, filename));
    const acc: any = {};
    const key = customId;

    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getMimeTypeFromExtension(fileExtension?.split('.')?.[1]),
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

/** True if URL path ends with a common image extension (for <a href> image links). */
function looksLikeImageFileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const pathOnly = url.trim().split('?')[0].split('#')[0];
  return /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|heif)$/i.test(pathOnly);
}

/**
 * Extracts image and audio media URLs from HTML content (img, a[href]→image files, audio, CSS backgrounds)
 * @param htmlContent - The HTML content string
 * @param baseSiteUrl - Base site URL for resolving relative URLs
 * @returns Array of unique image and audio URLs
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

    // Image URLs linked via <a href="..."> (skip non-image hrefs)
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && isValidImageUrl(href) && looksLikeImageFileUrl(href)) {
        const fullUrl = toCheckUrl(href, baseSiteUrl);
        if (isValidImageUrl(fullUrl) && looksLikeImageFileUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
    });

    // Extract audio src (e.g. core/audio) and nested <source> elements
    $('audio').each((_, element) => {
      const src = $(element).attr('src');
      if (src && isValidImageUrl(src)) {
        const fullUrl = toCheckUrl(src, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      $(element)
        .find('source')
        .each((_, srcEl) => {
          const s = $(srcEl).attr('src');
          if (s && isValidImageUrl(s)) {
            const fullUrl = toCheckUrl(s, baseSiteUrl);
            if (isValidImageUrl(fullUrl)) {
              imageUrls.add(fullUrl);
            }
          }
        });
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
    console.error('Error extracting image/audio URLs from content:', error);
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
  const customId = `${nameWithoutExt?.replace(/-/g, '_')?.toLowerCase()}`;
  // Use customId as filename to ensure uniqueness, preserve extension
  const filename = `${customId}${fileExtension}`;
  
  const assetPath = path.resolve(assetsSave, "files", customId);
  
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
    await fs.promises.mkdir(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    
    await fs.promises.writeFile(path.resolve(assetsSave, "files", customId, filename), response?.data);
    
    const stats = fs.lstatSync(path.resolve(assetsSave, "files", customId, filename));
    const acc: any = {};
    const key = customId;
    
    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getMimeTypeFromExtension(fileExtension?.split('.')?.[1]),
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
    'first name': 'wp:author_first_name',
    'last_name': 'wp:author_last_name',
    'last name': 'wp:author_last_name',
    'display_name': 'wp:author_display_name',
    'display name': 'wp:author_display_name',
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
              authordataEntry[field?.contentstackFieldUid] = formatChildByType(fieldValue, field, assetData, contentType?.fieldMapping);
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