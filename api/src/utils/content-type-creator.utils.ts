/* eslint-disable */
/* eslint-disable @typescript-eslint/no-var-requires, operator-linebreak */

import fs from 'fs';
import path from 'path';
import _, { includes } from 'lodash';
import customLogger from './custom-logger.utils.js';
import { getLogMessage } from './index.js';
import { LIST_EXTENSION_UID, MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { contentMapperService } from "../services/contentMapper.service.js";
import appMeta from '../constants/app/index.json';

const {
  GLOBAL_FIELDS_FILE_NAME,
  GLOBAL_FIELDS_DIR_NAME,
  CONTENT_TYPES_DIR_NAME,
  CONTENT_TYPES_SCHEMA_FILE,
  EXTENSIONS_MAPPER_DIR_NAME,
  CUSTOM_MAPPER_FILE_NAME
} = MIGRATION_DATA_CONFIG;

interface Group {
  data_type?: string;
  display_name?: string; // Assuming item?.contentstackField might be undefined
  field_metadata?: Record<string, any>; // Assuming it's an object with any properties
  schema: any[]; // Define the type of elements in the schema array if possible
  uid?: string; // Assuming item?.contentstackFieldUid might be undefined
  multiple?: boolean;
  mandatory?: boolean;
  unique?: boolean;
  title?: string;
}

interface ContentType {
  title: string | undefined;
  uid: string | undefined;
  schema: any[]; // Replace `any` with the specific type if known
}

const RESERVED_UIDS = new Set(['locale', 'publish_details', 'tags']);

/** Contentful taxonomy scheme ids may be camelCase, Contentstack requires [a-z0-9_]. */
function normalizeStackTaxonomyUid(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function sanitizeUid(uid?: string) {
  if (!uid) return uid;
  let out = uid?.replace?.(/[^a-zA-Z0-9_]/g, '_').replace?.(/^_+/, '');
  if (!/^[a-zA-Z]/.test(out)) out = `field_${out}`;
  if (RESERVED_UIDS.has(out)) out = `cm_${out}`; // avoid reserved values
  return out.toLowerCase();
}

function extractFieldName(input: string): string {
  // Extract text inside parentheses (e.g., "JSON Editor-App")
  const match = input.match(/\(([^)]+)\)/);
  const insideParentheses = match ? match?.[1] : input; // If no match, use the original string

  // Remove "-App" and unwanted characters
  const cleanedString = insideParentheses
    .replace(/-App/g, '') // Remove "-App"
    .trim(); // Trim spaces

  return cleanedString || ''; // Return the final processed string
}


function extractValue(input: string, prefix: string, anoter: string): any {
  if (input.startsWith(prefix + anoter)) {
    return input.replace(prefix + anoter, '');
  } else {
    console.error(`Input does not start with the specified prefix: ${prefix}`);
    return input?.split(anoter)?.[1];
  }
}

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid } : {uid : string}) => {
  if (!uid || typeof uid !== 'string') {
    return '';
  }

  let newUid = uid;

  // Note: UIDs starting with numbers and restricted keywords are handled externally in Sitecore
  // The prefix is applied in contentTypeMaker function when needed

  // Clean up the UID
  newUid = newUid
    .replace(/[ -]/g, '_') // Replace spaces and hyphens with underscores
    .replace(/[^a-zA-Z0-9_]+/g, '_') // Replace non-alphanumeric characters (except underscore)
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`) // Handle camelCase
    .toLowerCase() // Convert to lowercase
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Ensure UID doesn't start with underscore (Contentstack requirement)
  if (newUid.startsWith('_')) {
    newUid = newUid.substring(1);
  }

  return newUid;
};

/**
 * Remap an array of reference UIDs using a mapping table.
 *
 * @param uids - The original reference UIDs.
 * @param keyMapper - A map from UID to new UID. Callers should prefer using
 *   the *corrected* UID (i.e. the result of `uidCorrector({ uid })`) as the key.
 *   For backward compatibility, this function also supports maps keyed by the
 *   original UID, and will try both forms when looking up each entry.
 *
 *   NOTE: Relying on mixed key styles (some original, some corrected) can hide
 *   inconsistent UID formatting. When both key styles are present for the same
 *   logical UID and map to different targets, a warning is logged so that such
 *   issues do not go unnoticed.
 * @returns The remapped UIDs.
 */
function remapReferenceUids(uids: string | string[], keyMapper?: Record<string, string>): string[] {
  const uidsArray = Array.isArray(uids) ? uids : [uids];
  if (!keyMapper || !Object.keys(keyMapper).length) return uidsArray;
  return uidsArray?.map(uid => keyMapper?.[uid] ?? keyMapper?.[uidCorrector({ uid })] ?? uid);
}
function buildFieldSchema(item: any, marketPlacePath: string, parentUid = '', keyMapper?: Record<string, string>): any {
  if (item?.isDeleted === true) return null;

  const getCleanUid = (uid: string): string => {
    if (!uid) return '';
    const segments = uid.split(/[.>]/).map(s => s.trim());
    return segments.filter(s => s).pop() || '';
  };

  const toSnakeCase = (str: string): string => {
    // Remove special characters and handle common patterns
    let result = str
      .replace(/^[^a-zA-Z]+/, '')  // Remove non-alphabetic characters from start
      .replace(/[^a-zA-Z0-9]/g, '_')  // Replace all special chars with underscore
      .replace(/URL/g, 'url')
      .replace(/API/g, 'api')
      .replace(/ID/g, 'id')
      .replace(/UI/g, 'ui')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/_+/g, '_')  // Replace multiple underscores with single
      .replace(/^_|_$/g, '')  // Remove leading/trailing underscores
      .toLowerCase();

    // Ensure it starts with a letter
    if (result && !/^[a-z]/.test(result)) {
      result = 'field_' + result;
    }
    if (result === "locale") {
      result = 'cm_' + result;
    }
    return result || 'field';
  };


  const rawUid = getCleanUid(item?.contentstackFieldUid || item?.uid);
  const itemUid = toSnakeCase(rawUid);  // Apply snake_case conversion
  const fieldType = item?.contentstackFieldType;

  if (fieldType === 'modular_blocks') {
    const blocks: any[] = [];
    const schema = item?.schema || [];

    for (const blockItem of schema) {
      if (blockItem?.contentstackFieldType !== 'modular_blocks_child') continue;

      const blockRawUid = getCleanUid(blockItem?.contentstackField);
      // Use `uidCorrector` (not `toSnakeCase`) for child block UIDs so we preserve
      // digit-prefixed UIDs that may already exist on the destination
      // content type. `toSnakeCase` strips leading non-letters
      // which causes the merge step to miss the destination block and produce a
      // duplicate child block instead of merging schemas into the existing one.
      const blockUid = uidCorrector({
        uid: getCleanUid(blockItem?.contentstackFieldUid || blockItem?.uid),
      });
      const blockSchema: any[] = [];

      const blockElements = blockItem?.schema || [];
      for (const element of blockElements) {
        if (element?.isDeleted === false) {
          const fieldSchema = buildFieldSchema(element, marketPlacePath, '', keyMapper);
          if (fieldSchema) blockSchema.push(fieldSchema);
        }
      }

      blocks.push({
        title: blockRawUid,  // Keep original for title
        uid: blockUid,       // Snake case for uid
        schema: removeDuplicateFields(blockSchema)
      });
    }

    return {
      data_type: "blocks",
      display_name: item?.display_name || rawUid,  // Keep original for display
      field_metadata: {},
      uid: itemUid,  // Snake case uid
      multiple: true,
      mandatory: false,
      unique: false,
      non_localizable: false,
      blocks: removeDuplicateFields(blocks)
    };
  }

  if (fieldType === 'group') {
    const groupSchema: any[] = [];
    const elements = item?.schema || [];

    for (const element of elements) {
      if (element?.isDeleted === false) {
        const fieldSchema = buildFieldSchema(element, marketPlacePath, '', keyMapper);
        if (fieldSchema) groupSchema.push(fieldSchema);
      }
    }

    return {
      data_type: "group",
      display_name: item?.display_name || rawUid,  // Keep original for display
      field_metadata: {},
      schema: removeDuplicateFields(groupSchema),
      uid: itemUid,  // Snake case uid
      multiple: item?.advanced?.multiple || false,
      mandatory: item?.advanced?.mandatory || false,
      unique: false
    };
  }

  // For leaf fields
  return convertToSchemaFormate({
    field: {
      ...item,
      title: item?.display_name || rawUid,  // Keep original for display
      uid: itemUid  // Snake case uid
    },
    marketPlacePath,
    keyMapper
  });
}

/**
 * When two schema nodes share a uid (merge artifact), prefer the Contentstack custom
 * extension field so mapped plain fields do not win over the stack's extension
 * definitions inside modular block schema.
 */
function resolveDuplicateFieldsByUid(group: any[]): any {
  if (!group?.length) return group?.[0];
  if (group?.length === 1) return group[0];

  const withExtensionUid = group.filter((f) => f?.extension_uid);
  if (withExtensionUid?.length === 1) return withExtensionUid[0];

  const customJson = group.filter(
    (f) =>
      f?.data_type === 'json' &&
      (f?.field_metadata?.extension === true || f?.extension_uid),
  );
  if (customJson?.length === 1) return customJson[0];

  return group[0];
}

function removeDuplicateFields(fields: any[]): any[] {
  if (!Array?.isArray(fields)) return [];

  const uidBuckets = new Map<string, any[]>();
  for (const field of fields) {
    const uid = field?.uid;
    if (uid === undefined || uid === null || uid === '') continue;
    if (!uidBuckets.has(uid)) uidBuckets.set(uid, []);
    uidBuckets.get(uid)!.push(field);
  }

  const resolvedUid = new Map<string, any>();
  for (const [uid, group] of uidBuckets) {
    resolvedUid.set(uid, group?.length === 1 ? group[0] : resolveDuplicateFieldsByUid(group));
  }

  const seenUid = new Set<string>();
  const seenNoUid = new Map<string, boolean>();
  const result: any[] = [];

  for (const field of fields) {
    const uid = field?.uid;
    if (uid === undefined || uid === null || uid === '') {
      const key = JSON.stringify(field);
      if (!seenNoUid.has(key)) {
        seenNoUid.set(key, true);
        result.push(field);
      }
      continue;
    }
    if (!seenUid.has(uid)) {
      seenUid.add(uid);
      result.push(resolvedUid.get(uid));
    }
  }

  return result;
}

/**
 * If destination defines a custom extension on the same uid+data_type, copy missing
 * extension_uid / config / field_metadata onto the migration-built field (modular child
 * leaves often match as plain json without extension_uid).
 */
function mergeCustomFieldMetadataFromDestination(sField: any, tField: any) {
  if (!sField || !tField) return;
  if (sField?.uid !== tField?.uid || sField?.data_type !== tField?.data_type) return;

  const targetHasCustom =
    Boolean(tField?.extension_uid) || tField?.field_metadata?.extension === true;

  if (!targetHasCustom) return;

  if (tField?.extension_uid && !sField?.extension_uid) {
    sField.extension_uid = tField?.extension_uid;
  }
  if (tField?.config !== undefined && sField?.config === undefined) {
    sField.config = cloneSchemaBranch(tField?.config);
  }
  if (tField?.field_metadata?.extension) {
    sField.field_metadata = {
      ...(sField?.field_metadata || {}),
      ...tField?.field_metadata,
    };
  }
}

/** Apply {@link mergeCustomFieldMetadataFromDestination} for all leaves under merged schema. */
function enrichMergedSchemaWithDestinationCustomFields(
  sourceSchema: any[],
  targetSchema: any[],
): void {
  if (!Array?.isArray(sourceSchema) || !Array?.isArray(targetSchema)) return;

  for (const sField of sourceSchema) {
    const tField = targetSchema.find((t: any) => t?.uid === sField?.uid);
    if (!tField) continue;

    if (sField?.data_type === 'group' && tField?.data_type === 'group') {
      enrichMergedSchemaWithDestinationCustomFields(
        sField?.schema ?? [],
        tField?.schema ?? [],
      );
    } else if (sField?.data_type === 'blocks' && tField?.data_type === 'blocks') {
      const sBlocks = sField?.blocks ?? [];
      const tBlocks = tField?.blocks ?? [];
      for (const tBlock of tBlocks) {
        const sBlock = sBlocks.find((b: any) => b?.uid === tBlock?.uid);
        if (sBlock) {
          enrichMergedSchemaWithDestinationCustomFields(
            sBlock?.schema ?? [],
            tBlock?.schema ?? [],
          );
        }
      }
    } else if (sField?.data_type === tField?.data_type) {
      mergeCustomFieldMetadataFromDestination(sField, tField);
    }
  }
}


function getLastSegmentNew(str: string, separator: string): string {
  if (!str) return '';
  const segments = str.split(separator);
  return segments[segments.length - 1].trim();
}

export function buildSchemaTree(fields: any[], parentUid = '', parentType = '', oldParentUid = ''): any[] {
  if (!Array.isArray(fields)) {
    console.warn('buildSchemaTree called with invalid fields:', fields);
    return [];
  }

  // Build a lookup map for O(1) access
  const fieldMap = new Map<string, any>();
  fields?.forEach(f => {
    if (f?.contentstackFieldUid) {
      fieldMap?.set(f?.contentstackFieldUid, f);
    }
  });

  // Filter direct children of current parent
  const directChildren = fields.filter(field => {
    const fieldUid = field?.contentstackFieldUid || '';

    if (!parentUid) {
      // Root level - only fields without dots
      return fieldUid && !fieldUid?.includes('.');
    }

    // Check if field is a direct child of parentUid
    if (fieldUid?.startsWith(parentUid + '.')) {
      const remainder = fieldUid?.substring(parentUid.length + 1);
      // Verify it's exactly one level deeper (no more dots in remainder)
      return remainder && !remainder?.includes('.');
    }

    // Fallback: check if field is a direct child of oldParentUid (if provided and different from parentUid)
    if (oldParentUid && oldParentUid !== parentUid && fieldUid?.startsWith(oldParentUid + '.')) {
      const remainder = fieldUid?.substring(oldParentUid.length + 1);
      // Verify it's exactly one level deeper (no more dots in remainder)
      return remainder && !remainder?.includes('.');
    }

    // Not a direct child
    return false;
  });

  return directChildren.map(field => {
    const uid = getLastSegmentNew(field?.contentstackFieldUid, '.');
    const displayName = field?.display_name || getLastSegmentNew(field?.contentstackField || '', '>').trim();

    // Base field structure
    const result: any = {
      ...field,
      uid,
      display_name: displayName
    };

    // Determine if field should have nested schema
    const fieldUid = field?.contentstackFieldUid;
    const fieldType = field?.contentstackFieldType;
    const oldFieldUid = field?.backupFieldUid;

    // Check if this field has direct children (exactly one level deeper)
    const hasChildren = fields.some(f => {
      const fUid = f?.contentstackFieldUid || '';
      if (!fUid) return false;

      // Check if field starts with current fieldUid and is exactly one level deeper
      if (fieldUid && fUid?.startsWith(fieldUid + '.')) {
        const remainder = fUid?.substring(fieldUid.length + 1);
        return remainder && !remainder?.includes('.');
      }

      // Check if field starts with oldFieldUid and is exactly one level deeper
      if (oldFieldUid && fUid?.startsWith(oldFieldUid + '.')) {
        const remainder = fUid?.substring(oldFieldUid.length + 1);
        return remainder && !remainder?.includes('.');
      }

      return false;
    });

    if (hasChildren) {
      if (fieldType === 'modular_blocks') {
        // Get modular block children (check both current and backup UIDs)
        const mbChildren = fields.filter(f => {
          if (!f) return false;
          const fUid = f?.contentstackFieldUid || '';
          if (!fUid || !fieldUid) return false;
          if (f?.contentstackFieldType !== 'modular_blocks_child') return false;

          if (fUid.startsWith(fieldUid + '.') &&
            !fUid.substring(fieldUid.length + 1).includes('.')) {
            return true;
          }

          if (oldFieldUid && oldFieldUid !== fieldUid &&
            fUid.startsWith(oldFieldUid + '.') &&
            !fUid.substring(oldFieldUid.length + 1).includes('.')) {
            return true;
          }

          return false;
        });

        result.schema = mbChildren.map(child => {
          const childFieldUid = child?.contentstackFieldUid || '';
          const childUid = getLastSegmentNew(childFieldUid, '.');
          const childDisplay = child?.display_name || getLastSegmentNew(child?.contentstackField || '', '>').trim();

          return {
            ...child,
            uid: childUid,
            display_name: childDisplay,
            // Recursively build schema for fields inside this child block
            schema: buildSchemaTree(fields, childFieldUid, 'modular_blocks_child', child?.backupFieldUid)
          };
        });
      } else if (fieldType === 'group' ||
        (fieldType === 'modular_blocks_child' && hasChildren)) {
        // Recursively build schema for groups and modular block children with nested content
        result.schema = buildSchemaTree(fields, fieldUid, fieldType, oldFieldUid);
      }
    }

    // Preserve existing schema if no children found but schema exists
    if (!hasChildren && field.schema && Array.isArray(field.schema)) {
      result.schema = field.schema;
    }

    return result;
  });
}

const saveAppMapper = async ({ marketPlacePath, data, fileName }: any) => {
  try {
    await fs.promises.access(marketPlacePath);
  } catch (err) {
    try {
      await fs.promises.mkdir(marketPlacePath, { recursive: true });
    } catch (mkdirErr) {
      console.error("🚀 ~ fs.mkdir ~ err:", mkdirErr);
      return;
    }
  }
  const marketPlaceFilePath = path.join(marketPlacePath, fileName);
  const newData: any = await fs.promises.readFile(marketPlaceFilePath, "utf-8").catch(async () => {
    await fs.promises.writeFile(marketPlaceFilePath, JSON.stringify([data]));
  });
  if (newData !== "" && newData !== undefined) {
    const parseData: any = JSON.parse(newData);
    parseData?.push(data);
    await fs.promises.writeFile(marketPlaceFilePath, JSON.stringify(parseData));
  }
}

export const convertToSchemaFormate = ({ field, advanced = false, marketPlacePath, keyMapper }: any) => {
  // Clean up field UID by removing ALL leading underscores
  const rawUid = field?.uid;
  const cleanedUid = sanitizeUid(rawUid);
  switch (field?.contentstackFieldType) {
    case 'single_line_text': {
      return {
        "data_type": "text",
        "display_name": field?.title,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          default_value: field?.advanced?.default_value ?? ''
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case 'boolean': {
      return {
        "data_type": "boolean",
        "display_name": field?.title,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          default_value: field?.advanced?.default_value ?? false,
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case 'json': {
      const isAemComponentFallback =
        typeof field?.otherCmsType === 'string' && field.otherCmsType.includes('/components/');
      if (isAemComponentFallback || ["Object", "Array"].includes(field?.otherCmsType)) {
        return {
          data_type: "json",
          display_name: field?.title ?? cleanedUid,
          uid: cleanedUid,
          "extension_uid": field?.otherCmsTyp === "Array" ? 'listview_extension' : 'jsonobject_extension',
          "field_metadata": {
            extension: true,
            description: field.advanced?.description ?? '',
          },
          "format": field?.advanced?.validationRegex ?? '',
          "error_messages": {
            "format": field?.advanced?.validationErrorMessage ?? '',
          },
          "reference_to": [
            "sys_assets"
          ],
          "multiple": field?.advanced?.multiple ?? false,
          "non_localizable": false,
          "unique": field?.advanced?.unique ?? false,
          "config": {},
          "mandatory": field?.advanced?.mandatory ?? false,
        }
      } else {
        return {
          "data_type": "json",
          "display_name": field?.title ?? cleanedUid,
          "uid": cleanedUid,
          "field_metadata": {
            "allow_json_rte": true,
            "embed_entry": field?.advanced?.embedObjects?.length ? true : false,
            "description": "",
            "default_value": "",
            "multiline": false,
            "rich_text_type": "advanced",
            "options": []
          },
          "format": field?.advanced?.validationRegex ?? '',
          "error_messages": {
            "format": field?.advanced?.validationErrorMessage ?? '',
          },
          "reference_to": field?.advanced?.embedObjects?.length ? remapReferenceUids([
            "sys_assets",
            ...field?.advanced?.embedObjects?.map?.((item: any) => uidCorrector({ uid: item })) ?? [],
          ], keyMapper) : [
            "sys_assets"
          ],
          "multiple": field?.advanced?.multiple ?? false,
          "non_localizable": field.advanced?.nonLocalizable ?? false,
          "unique": field?.advanced?.unique ?? false,
          "mandatory": field?.advanced?.mandatory ?? false
        }
      }
    }

    case 'dropdown': {
      // 🔧 CONDITIONAL LOGIC: Check if choices have key-value pairs or just values
      const rawChoices = Array.isArray(field?.advanced?.options) && field?.advanced?.options?.length > 0
        ? field?.advanced?.options
        : [{ value: "NF" }];

      // Filter out null/undefined choices and ensure they are valid objects
      const choices = Array.isArray(rawChoices)
        ? rawChoices.filter((choice: any) => choice != null && typeof choice === 'object')
        : [{ value: "NF" }];

      const hasKeyValuePairs = Array.isArray(choices) && choices.length > 0 &&
        choices.some((choice: any) => choice != null && typeof choice === 'object' && choice.key !== undefined && choice.key !== null);

      const data = {
        "data_type": ['dropdownNumber', 'radioNumber', 'ratingNumber'].includes(field.otherCmsType) ? 'number' : "text",
        "display_name": field?.title,
        "display_type": "dropdown",
        "enum": {
          "advanced": hasKeyValuePairs, // true if has key-value pairs, false if only values
          choices: choices,
        },
        "multiple": field?.advanced?.multiple ?? false,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          default_value: field?.advanced?.default_value ?? null,
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      };
      const default_value = field?.advanced?.options?.length ? (field?.advanced?.options?.find((item: any) => (item?.key === field?.advanced?.default_value) || (item?.key === field?.advanced?.default_value))) : { value: field?.advanced?.default_value };
      data.field_metadata.default_value = default_value?.value ?? null;
      return data;
    }
    case 'radio': {
      // 🔧 CONDITIONAL LOGIC: Check if choices have key-value pairs or just values
      const rawChoices = Array.isArray(field?.advanced?.options) && field?.advanced?.options?.length > 0
        ? field?.advanced?.options
        : [{ value: "NF" }];

      // Filter out null/undefined choices and ensure they are valid objects
      const choices = Array.isArray(rawChoices)
        ? rawChoices.filter((choice: any) => choice != null && typeof choice === 'object')
        : [{ value: "NF" }];

      const hasKeyValuePairs = Array.isArray(choices) && choices.length > 0 &&
        choices.some((choice: any) => choice != null && typeof choice === 'object' && choice.key !== undefined && choice.key !== null);

      const data = {
        "data_type": ['dropdownNumber', 'radioNumber', 'ratingNumber'].includes(field.otherCmsType) ? 'number' : "text",
        "display_name": field?.title,
        "display_type": "radio",
        "enum": {
          "advanced": hasKeyValuePairs, // true if has key-value pairs, false if only values
          choices: choices,
        },
        "multiple": field?.advanced?.multiple ?? false,
        uid: cleanedUid,
        "field_metadata": {
          description: field?.advanced?.description || '',
          default_value: field?.advanced?.default_value ?? null,
          default_key: field?.advanced?.defaultKey ?? ''
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
      return data;
    }
    case 'checkbox': {
      // 🔧 CONDITIONAL LOGIC: Check if choices have key-value pairs or just values
      const rawChoices = Array.isArray(field?.advanced?.options) && field?.advanced?.options?.length > 0
        ? field?.advanced?.options
        : [{ value: "NF" }];

      // Filter out null/undefined choices and ensure they are valid objects
      const choices = Array.isArray(rawChoices)
        ? rawChoices.filter((choice: any) => choice != null && typeof choice === 'object')
        : [{ value: "NF" }];

      const hasKeyValuePairs = Array.isArray(choices) && choices.length > 0 &&
        choices.some((choice: any) => choice != null && typeof choice === 'object' && choice.key !== undefined && choice.key !== null);

      const data = {
        "data_type": "text",
        "display_name": field?.title,
        "display_type": "checkbox",
        "enum": {
          "advanced": hasKeyValuePairs, // true if has key-value pairs, false if only values
          choices: choices,
        },
        "multiple": true,
        uid: cleanedUid,
        "field_metadata": {
          description: field?.advanced?.description || '',
          default_value: field?.advanced?.default_value ?? null,
          default_key: field?.advanced?.defaultKey ?? ''
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
      return data;
    }

    case "file": {
      return {
        "data_type": "file",
        "display_name": field?.title,
        uid: cleanedUid,
        "extensions": [],
        "field_metadata": {
          description: "",
          "rich_text_type": "standard"
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case "link": {
      return {
        "data_type": "link",
        "display_name": field?.title,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          "default_value": {
            "title": field?.advanced?.title ?? '',
            "url": field?.advanced?.url ?? '',
          }
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case "multi_line_text": {
      return {
        "data_type": "text",
        "display_name": field?.title,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          default_value: field?.advanced?.default_value ?? '',
          "multiline": true
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }
    case 'markdown': {
      return {
        "data_type": "text",
        "display_name": field?.title,
        "uid": cleanedUid,
        "field_metadata": {
          "description": "",
          "markdown": true,
          "placeholder": field?.advanced?.default_value ?? ''
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case "number": {
      return {
        "data_type": "number",
        "display_name": field?.title,
        uid: cleanedUid,
        "field_metadata": {
          description: "",
          default_value: field?.advanced?.default_value ?? ''
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false
      }
    }

    case "isodate": {
      return {
        "data_type": "isodate",
        "display_name": field?.title,
        uid: cleanedUid,
        "startDate": null,
        "endDate": null,
        "field_metadata": {
          description: "",
          "default_value": {},
          "hide_time": true
        },
        "format": field?.advanced?.validationRegex ?? '',
        "error_messages": {
          "format": field?.advanced?.validationErrorMessage ?? '',
        },
        "mandatory": field?.advanced?.mandatory ?? false,
        "multiple": field?.advanced?.multiple ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false,
        "unique": field?.advanced?.unique ?? false
      }
    }


    case 'global_field': {
      const globalFieldRefs = remapReferenceUids(field?.refrenceTo ?? [], keyMapper);
      return {
        "data_type": "global_field",
        "display_name": field?.title,
        "reference_to": globalFieldRefs?.length === 1 ? globalFieldRefs?.[0] : globalFieldRefs,
        "uid": cleanedUid,
        "mandatory": field?.advanced?.mandatory ?? false,
        "multiple": field?.advanced?.multiple ?? false,
        "unique": field?.advanced?.unique ?? false
      }
    }

    case "reference": {
      return {
        data_type: "reference",
        display_name: field?.title,
        reference_to: remapReferenceUids(field?.refrenceTo ?? [], keyMapper),
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true
        },
        format: field?.advanced?.validationRegex ?? '',
        error_messages: {
          format: field?.advanced?.validationErrorMessage ?? '',
        },
        uid: cleanedUid,
        mandatory: field?.advanced?.mandatory ?? false,
        multiple: field?.advanced?.multiple ?? false,
        non_localizable: field.advanced?.nonLocalizable ?? false,
        unique: field?.advanced?.unique ?? false
      };
    }

    case 'taxonomy': {
      // Build taxonomies array from field.taxonomies or field.advanced.taxonomies
      const taxonomiesData = field?.taxonomies || field?.advanced?.taxonomies || [];
      const taxonomiesArray = Array.isArray(taxonomiesData) 
        ? taxonomiesData.map((tax: any) => ({
            taxonomy_uid: normalizeStackTaxonomyUid(
              typeof tax === 'string' ? tax : (tax?.taxonomy_uid || tax),
            ),
            mandatory: field?.advanced?.mandatory ?? false,
            multiple: field?.advanced?.multiple !== false, // Default true for taxonomies
            non_localizable: false
          }))
        : [];

      return {
        data_type: "taxonomy",
        display_name: field?.title,
        uid: 'taxonomies',
        taxonomies: taxonomiesArray,
        field_metadata: {
          description: field?.advanced?.description ?? '',
          default_value: field?.advanced?.default_value ?? ''
        },
        format: field?.advanced?.validationRegex ?? '',
        error_messages: {
          format: field?.advanced?.validationErrorMessage ?? ''
        },
        mandatory: field?.advanced?.mandatory ?? false,
        multiple: field?.advanced?.multiple !== false, // Default true for taxonomies
        non_localizable: false,
        unique: field?.advanced?.unique ?? false
      };
    }

    case 'html': {
      const htmlField: any = {
        "data_type": "text",
        "display_name": field?.title,
        "uid": cleanedUid,
        "field_metadata": {
          "allow_rich_text": true,
          "description": "",
          "multiline": false,
          "rich_text_type": "advanced",
          "version": 3,
          "options": [],
          "ref_multiple_content_types": true,
          "embed_entry": field?.advanced?.embedObjects?.length ? true : false,
        },
        "multiple": field?.advanced?.multiple ?? false,
        "mandatory": field?.advanced?.mandatory ?? false,
        "unique": field?.advanced?.unique ?? false,
        "non_localizable": field.advanced?.nonLocalizable ?? false,
        "reference_to": field?.advanced?.embedObjects?.length ? remapReferenceUids(field?.advanced?.embedObjects?.map?.((item: any) => uidCorrector({ uid: item })), keyMapper) : []
      }
      if ((field?.advanced?.embedObjects?.length === undefined) ||
        (field?.advanced?.embedObjects?.length === 0) ||
        (field?.advanced?.embedObjects?.length === 1 && field?.advanced?.embedObjects?.[0] === 'sys_assets')) {
        if (htmlField) {
          delete htmlField.reference_to;
          if (htmlField.field_metadata) {
            delete htmlField.field_metadata.embed_entry;
            delete htmlField.field_metadata.ref_multiple_content_types;
          }
        }
      }
      return htmlField;
    }

    case 'app': {
      const appName = extractFieldName(field?.otherCmsField);
      const title = field?.title?.split?.(' ')?.[0];
      const appDetails = appMeta?.entries?.find?.((item: any) => item?.title === appName);
      if (appDetails?.uid) {
        saveAppMapper({
          marketPlacePath,
          data: { appUid: appDetails?.app_uid, extensionUid: `${appDetails?.uid}-cs.cm.stack.custom_field` },
          fileName: EXTENSIONS_MAPPER_DIR_NAME
        });
        return {
          "display_name": title,
          "extension_uid": appDetails?.uid,
          "field_metadata": {
            "extension": true
          },
          "uid": cleanedUid,
          "config": {},
          "data_type": "json",
          "multiple": field?.advanced?.multiple ?? false,
          "mandatory": field?.advanced?.mandatory ?? false,
          "unique": field?.advanced?.unique ?? false,
          "non_localizable": field.advanced?.nonLocalizable ?? false,
        }
      }
      break;
    }

    case 'extension': {
      if (['listInput', 'tagEditor']?.includes(field?.otherCmsType)) {
        const extensionUid = LIST_EXTENSION_UID;
        saveAppMapper({
          marketPlacePath,
          data: { extensionUid },
          fileName: CUSTOM_MAPPER_FILE_NAME
        });
        return {
          "display_name": field?.title,
          "uid": cleanedUid,
          "extension_uid": extensionUid,
          "field_metadata": {
            "extension": true
          },
          "config": {},
          "multiple": field?.advanced?.multiple ?? false,
          "mandatory": field?.advanced?.mandatory ?? false,
          "unique": field?.advanced?.unique ?? false,
          "non_localizable": field.advanced?.nonLocalizable ?? false,
          "data_type": "json",
        }
      }
      break;
    }

    default: {
      if (field?.contentstackFieldType) {
        return {
          "display_name": field?.title,
          "uid": cleanedUid,
          "data_type": "text",
          "mandatory": field?.advanced?.mandatory ?? false,
          "unique": field?.advanced?.unique ?? false,
          "field_metadata": {
            "_default": true
          },
          "format": field?.advanced?.validationRegex ?? '',
          "error_messages": {
            "format": field?.advanced?.validationErrorMessage ?? '',
          },
          "multiple": field?.advanced?.multiple ?? false,
          "non_localizable": field.advanced?.nonLocalizable ?? false,
        }
      } else {
        console.info('Content Type Field', field?.contentstackField)
      }
    }
  }

}

const saveContent = async (ct: any, contentSave: string) => {
  try {
    // Check if the directory exists
    await fs.promises.access(contentSave).catch(async () => {
      // If the directory doesn't exist, create it
      await fs.promises.mkdir(contentSave, { recursive: true });
    });
    // Write the individual content to its own file
    const filePath = path.join(process.cwd(), contentSave, `${ct?.uid}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(ct));
    // Append the content to schema.json
    const schemaFilePath = path.join(process.cwd(), contentSave, CONTENT_TYPES_SCHEMA_FILE);
    let schemaData = [];
    try {
      // Read existing schema.json file if it exists
      const schemaFileContent = await fs.promises.readFile(schemaFilePath, 'utf8');
      schemaData = JSON.parse(schemaFileContent);
    } catch (readError: any) {
      if (readError?.code !== 'ENOENT') {
        throw readError; // rethrow if it's not a "file not found" error
      }
    }
    // Upsert by uid: replace an existing entry for this content type instead of
    // blindly appending. schema.json is not cleared between runs (clearStaleEntries
    // only wipes the entries/ subtree), so re-running against the same stack — e.g.
    // a re-run test migration or a delta iteration — would otherwise accumulate
    // duplicate content-type entries.
    const existingIndex = Array.isArray(schemaData)
      ? schemaData.findIndex((existing: any) => existing?.uid === ct?.uid)
      : -1;
    if (existingIndex > -1) {
      schemaData[existingIndex] = ct;
    } else {
      schemaData.push(ct);
    }
    // Write the updated schemaData back to schema.json
    await fs.promises.writeFile(schemaFilePath, JSON.stringify(schemaData, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }

}

const writeGlobalField = async (schema: any, globalSave: string) => {
  const filePath = path.join(process.cwd(), globalSave, GLOBAL_FIELDS_FILE_NAME);
  try {
    await fs.promises.access(globalSave);
  } catch (err) {
    try {
      await fs.promises.mkdir(globalSave, { recursive: true });
    } catch (mkdirErr) {
      console.error("🚀 ~ fs.mkdir ~ err:", mkdirErr);
      return;
    }
  }
  let globalfields: any[] = [];
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    globalfields = Array.isArray(parsed) ? parsed : [];
  } catch (readErr: any) {
    if (readErr?.code !== 'ENOENT') {
      console.error("🚀 ~ fs.readFile ~ err:", readErr);
      return;
    }
  }

  // 🔧 FIX: Check for duplicates before adding
  if (!schema || typeof schema !== 'object') {
    console.error("🚀 ~ writeGlobalField ~ Invalid schema provided");
    return;
  }

  if (!schema.uid) {
    console.error("🚀 ~ writeGlobalField ~ Schema missing uid");
    return;
  }

  if (!Array.isArray(globalfields)) {
    globalfields = [];
  }

  const existingIndex = globalfields.findIndex((gf: any) => gf != null && gf.uid === schema.uid);
  if (existingIndex !== -1 && existingIndex < globalfields.length) {
    // Replace existing global field instead of duplicating
    if (schema && typeof schema === 'object' && schema.uid) {
      globalfields[existingIndex] = schema;
    }
  } else {
    // Add new global field
    if (Array.isArray(globalfields) && schema && typeof schema === 'object' && schema.uid) {
      globalfields.push(schema);
    } else {
      console.error("🚀 ~ writeGlobalField ~ Cannot push schema: invalid schema or globalfields array");
    }
  }

  try {
    await fs.promises.writeFile(filePath, JSON.stringify(globalfields, null, 2));
  } catch (writeErr) {
    console.error("🚀 ~ fs.writeFile ~ err:", writeErr);
  }
};

const resolveIsSsoFlag = (is_sso: any): boolean => {
  if (typeof is_sso === 'boolean') {
    return is_sso;
  }

  if (is_sso === 'true') {
    return true;
  }

  if (is_sso === 'false') {
    return false;
  }

  throw new Error(
    `Invalid token_payload.is_sso in existingCtMapper; expected boolean, received: ${JSON.stringify(is_sso)}`
  );
};

/**
 * Resolves the Contentstack Management API UID for a content type / global field.
 * @param migrationContentstackUid - The UID of the content type in the migration data.
 * @param keyMapper - The key mapper object.
 * @returns The Contentstack Management API UID.
 */
function resolveStackContentTypeUid(
  migrationContentstackUid: string,
  keyMapper?: Record<string, string>,
): string {
  const mapped = keyMapper?.[migrationContentstackUid];
  if (mapped === undefined || mapped === null || mapped === '') {
    return migrationContentstackUid;
  }

  const m = String(mapped).trim();
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m);
  const looksLikeMongoId = /^[0-9a-f]{24}$/i.test(m);

  if (looksLikeUuid || looksLikeMongoId) {
    return migrationContentstackUid;
  }

  return m;
}

const existingCtMapper = async ({ keyMapper, contentTypeUid, projectId, region, user_id, is_sso, type}: any) => {
  try {
    const normalizedIsSso = resolveIsSsoFlag(is_sso);
    const ctUid = resolveStackContentTypeUid(contentTypeUid, keyMapper);

    if(type === 'global_field') {

      const req: any = {
        params: {
          projectId,
          globalFieldUid: ctUid
        },
        body: {
          token_payload: {
            region,
            user_id,
            is_sso: normalizedIsSso
          }
        }
      }
      const contentTypeSchema = await contentMapperService.getSingleGlobalField(req);
      return contentTypeSchema ?? null;
    } else {
      const req: any = {
        params: {
          projectId,
          contentTypeUid: ctUid
        },
        body: {
          token_payload: {
            region,
            user_id,
            is_sso: normalizedIsSso
          }
        }
      }
      const contentTypeSchema = await contentMapperService.getExistingContentTypes(req);
      return contentTypeSchema?.selectedContentType ?? null;
    }
  } catch (err) {
    console.error("Error while getting the existing contentType from contenstack", err)
    return {};
  }
}

const mergeArrays = async (a: any[], b: any[]) => {
  for await (const fieldGp of b) {
    const exists = a.some(fld =>
      fld?.uid === fieldGp?.uid &&
      fld?.data_type === fieldGp?.data_type
    );
    if (!exists) {
      a.push(fieldGp);
    }
  }
  return a;
}

/**
 * Clones a schema branch.
 * @param node - The node to clone.
 * @returns The cloned node.
 */
function cloneSchemaBranch(node: any): any {
  if (node === undefined || node === null) return node;
  try {
    return structuredClone(node);
  } catch {
    return JSON.parse(JSON.stringify(node));
  }
}

/**
 * Finds the target modular blocks field.
 * @param field - The field to find the target modular blocks field for.
 * @param targetSchema - The target schema.
 * @returns The target modular blocks field.
 */
function findTargetModularBlocksField(field: any, targetSchema: any[]): any | undefined {
  if (!Array.isArray(targetSchema) || !field || field?.data_type !== 'blocks') return undefined;

  const byUid = targetSchema.find(
    (mb: any) => mb?.data_type === 'blocks' && mb?.uid === field?.uid,
  );
  if (byUid) return byUid;

  const fd = (field?.display_name ?? '').toString().trim().toLowerCase();
  if (fd) {
    const byName = targetSchema.find(
      (mb: any) =>
        mb?.data_type === 'blocks' &&
        (mb?.display_name ?? '').toString().trim().toLowerCase() === fd,
    );
    if (byName) return byName;
  }

  return undefined;
}

/**
 * Find a source modular-blocks child that should merge with the destination block.
 * Primary match is by uid; falls back to title (case-insensitive) so blocks whose
 * uids diverged due to sanitization still merge instead of
 * producing a duplicate child block.
 */
function findMatchingSourceBlock(sourceBlocks: any[], targetBlock: any): any | undefined {
  if (!Array?.isArray(sourceBlocks) || !targetBlock) return undefined;

  const byUid = sourceBlocks.find((b: any) => b?.uid && b?.uid === targetBlock?.uid);
  if (byUid) return byUid;

  const targetTitle = (targetBlock?.title ?? '').toString().trim().toLowerCase();
  if (!targetTitle) return undefined;

  return sourceBlocks.find(
    (b: any) => (b?.title ?? '').toString().trim().toLowerCase() === targetTitle,
  );
}

/**
 * Merge modular blocks preserving destination block order and UIDs:
 * 1. Walk destination blocks — merge matching source blocks, clone unmapped ones.
 * 2. Append source-only blocks (uids not on destination) at the end.
 */
function mergeModularBlocksFieldFromDestination(field: any, targetMB: any) {
  const targetBlocks = targetMB?.blocks ?? [];
  const sourceBlocks = field?.blocks ?? [];
  if (!targetBlocks.length) return;

  const resultBlocks: any[] = [];
  const matchedSourceIdentifiers = new Set<string>();

  for (const tb of targetBlocks) {
    const sb = findMatchingSourceBlock(sourceBlocks, tb);
    if (sb) {
      const tSch = tb?.schema ?? [];
      const additional = tSch.filter(
        (tField: any) =>
          !(sb?.schema ?? []).some(
            (sField: any) =>
              sField?.uid === tField?.uid && sField?.data_type === tField?.data_type,
          ),
      );
      sb.schema = removeDuplicateFields([
        ...(sb?.schema ?? []),
        ...additional.map((f: any) => cloneSchemaBranch(f)),
      ]);
      mergeSchemaFields(sb?.schema ?? [], tSch);

      // Align uid/title with destination so the merged block updates the existing
      // destination block instead of creating a divergent one when uids differ.
      if (tb?.uid) sb.uid = tb?.uid;
      if (tb?.title) sb.title = tb?.title;

      resultBlocks.push(sb);
      if (sb?.uid) matchedSourceIdentifiers.add(`uid:${sb?.uid}`);
      const matchedTitle = (sb?.title ?? '').toString().trim().toLowerCase();
      if (matchedTitle) matchedSourceIdentifiers.add(`title:${matchedTitle}`);
    } else {
      resultBlocks.push(cloneSchemaBranch(tb));
    }
  }

  for (const sb of sourceBlocks) {
    const sbUidKey = sb?.uid ? `uid:${sb?.uid}` : '';
    const sbTitleKey = sb?.title
      ? `title:${(sb?.title as string).toString().trim().toLowerCase()}`
      : '';
    const alreadyMatched =
      (sbUidKey && matchedSourceIdentifiers.has(sbUidKey)) ||
      (sbTitleKey && matchedSourceIdentifiers.has(sbTitleKey));
    if (!alreadyMatched && sb?.uid && sb?.title) {
      resultBlocks.push(sb);
    }
  }

  field.blocks = removeDuplicateFields(resultBlocks);
}

function mergeSchemaFields(sourceSchema: any[], targetSchema: any[]) {
  for (const field of sourceSchema) {
    if (field?.data_type === 'group') {
      const targetGroup = targetSchema?.find((grp: Group) =>
        grp?.uid === field?.uid && grp?.data_type === 'group'
      );

      if (targetGroup) {
        const additional = (targetGroup?.schema ?? []).filter((tField: Group) =>
          !field?.schema?.find((sField: Group) => sField?.uid === tField?.uid && sField?.data_type === tField?.data_type)
        );
        field.schema = removeDuplicateFields([...field?.schema ?? [], ...additional]);
        mergeSchemaFields(field?.schema, targetGroup?.schema ?? []);
      }
    }

    if (field?.data_type === 'blocks') {
      const targetMB = findTargetModularBlocksField(field, targetSchema ?? []);

      if (targetMB?.blocks?.length) {
        mergeModularBlocksFieldFromDestination(field, targetMB);
      }
    }
  }
}

const mergeTwoCts = async (ct: any, mergeCts: any) => {
  const ctData: any = {
    ...ct,
    title: mergeCts?.title,
    uid: mergeCts?.uid,
    options: {
      is_page: true,
      "singleton": false,
      title: "title",
      url_pattern: '/:title',
      url_prefix: `/`,
      sub_title: ['url']
    }
  }

  mergeSchemaFields(ctData?.schema ?? [], mergeCts?.schema ?? []);

  enrichMergedSchemaWithDestinationCustomFields(
    ctData?.schema ?? [],
    mergeCts?.schema ?? [],
  );

  ctData.schema = await mergeArrays(ctData?.schema, mergeCts?.schema) ?? [];
  
  return ctData;
}

export const contenTypeMaker = async ({ contentType, destinationStackId, projectId, newStack, keyMapper, region, user_id, is_sso }: any) => {
  const marketPlacePath = path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, destinationStackId);
  const srcFunc = 'contenTypeMaker';

  let ct: ContentType = {
    title: contentType?.contentstackTitle,
    uid: contentType?.contentstackUid,
    schema: []
  };

  let currentCt: any = {};
  if (Object?.keys?.(keyMapper)?.length &&
    keyMapper?.[contentType?.contentstackUid] !== "" &&
    keyMapper?.[contentType?.contentstackUid] !== undefined) {
    currentCt = await existingCtMapper({ keyMapper, contentTypeUid: contentType?.contentstackUid, projectId, region, user_id, is_sso, type: contentType?.type});
  }

  // Safe: ensures we never pass undefined to the builder
  const ctData: any[] = buildSchemaTree(contentType?.fieldMapping || []);

  // Use the deep converter that properly handles groups & modular blocks
  for (const item of ctData) {
    if (item?.isDeleted === true) continue;

    const fieldSchema = buildFieldSchema(item, marketPlacePath, '', keyMapper);
    if (fieldSchema) {
      ct?.schema.push(fieldSchema);
    }
  }

  // dedupe by uid to avoid dup nodes after merges
  ct.schema = removeDuplicateFields(ct.schema || []);

  if (currentCt?.uid) {
    ct = await mergeTwoCts(ct, currentCt);
  }
  if (ct?.uid && Array.isArray(ct?.schema) && ct?.schema.length) {
    if (contentType?.type === 'global_field') {
      const globalSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, GLOBAL_FIELDS_DIR_NAME);
      const message = getLogMessage(srcFunc, `Global Field ${ct?.uid} has been successfully Transformed.`, {});
      await customLogger(projectId, destinationStackId, 'info', message);
      await writeGlobalField(ct, globalSave);
    } else {
      const contentSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, CONTENT_TYPES_DIR_NAME);
      const message = getLogMessage(srcFunc, `ContentType ${ct?.uid} has been successfully Transformed.`, {});
      await customLogger(projectId, destinationStackId, 'info', message);
      await saveContent(ct, contentSave);
    }
  } else {
    console.info(contentType?.contentstackUid, 'missing');
  }
}