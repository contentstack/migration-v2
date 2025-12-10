/* eslint-disable */
/* eslint-disable @typescript-eslint/no-var-requires, operator-linebreak */

import fs from 'fs';
import path from 'path';
import _, { includes } from 'lodash';
import customLogger from './custom-logger.utils.js';
import { getLogMessage } from './index.js';
import { LIST_EXTENSION_UID, MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { contentMapperService } from "../services/contentMapper.service.js";
import appMeta from '../constants/app/index.json' with { type: 'json' };

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


function buildFieldSchema(item: any, marketPlacePath: string, parentUid = ''): any {
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

      const blockRawUid = getCleanUid(blockItem?.contentstackFieldUid || blockItem?.uid);
      const blockUid = toSnakeCase(blockRawUid);  // Apply snake_case
      const blockSchema: any[] = [];

      const blockElements = blockItem?.schema || [];
      for (const element of blockElements) {
        if (element?.isDeleted === false) {
          const fieldSchema = buildFieldSchema(element, marketPlacePath, '');
          if (fieldSchema) blockSchema.push(fieldSchema);
        }
      }

      if (blockSchema.length > 0) {
        blocks.push({
          title: blockRawUid,  // Keep original for title
          uid: blockUid,       // Snake case for uid
          schema: removeDuplicateFields(blockSchema)
        });
      }
    }

    if (blocks.length > 0) {
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
    return null;
  }

  if (fieldType === 'group') {
    const groupSchema: any[] = [];
    const elements = item?.schema || [];

    for (const element of elements) {
      if (element?.isDeleted === false) {
        const fieldSchema = buildFieldSchema(element, marketPlacePath, '');
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
    marketPlacePath
  });
}

function removeDuplicateFields(fields: any[]): any[] {
  const seen = new Map();
  return fields.filter(field => {
    const key = field.uid || JSON.stringify(field);
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
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

    // Fallback: check if field is a direct child of oldPrentUid (if provided and different)
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
      
      // Check if field starts with oldFieldtUid and is exactly one level deeper
      if (oldFieldUid && fUid?.startsWith(oldFieldUid + '.')) {
        const remainder = fUid?.substring(oldFieldUid.length + 1);
        return remainder && !remainder?.includes('.');
      }
      
      return false;
    });

    if (hasChildren) {
      if (fieldType === 'modular_blocks') {
        // Get modular block children
        const mbChildren = fields.filter(f => {
          const fUid = f.contentstackFieldUid || '';
          return f.contentstackFieldType === 'modular_blocks_child' &&
            fUid.startsWith(fieldUid + '.') &&
            !fUid.substring(fieldUid.length + 1).includes('.');
        });

        result.schema = mbChildren.map(child => {
          const childUid = getLastSegmentNew(child.contentstackFieldUid, '.');
          const childDisplay = child.display_name || getLastSegmentNew(child.contentstackField || '', '>').trim();

          return {
            ...child,
            uid: childUid,
            display_name: childDisplay,
            schema: buildSchemaTree(fields, child.contentstackFieldUid, 'modular_blocks_child', child?.backupFieldUid)
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

const convertToSchemaFormate = ({ field, advanced = false, marketPlacePath, keyMapper }: any) => {
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
      if (["Object", "Array"].includes(field?.otherCmsType)) {
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
          "reference_to": field?.advanced?.embedObjects?.length ? [
            "sys_assets",
            ...field?.advanced?.embedObjects?.map?.((item: any) => uidCorrector({ uid: item })) ?? [],
          ] : [
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
      return {
        "data_type": "global_field",
        "display_name": field?.title,
        "reference_to": field?.refrenceTo,
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
        reference_to: field?.refrenceTo ?? [],
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
        "reference_to": field?.advanced?.embedObjects?.length ? field?.advanced?.embedObjects?.map?.((item: any) => uidCorrector({ uid: item })) : []
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
    // Append new content to schemaData
    schemaData.push(ct);
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

const existingCtMapper = async ({ keyMapper, contentTypeUid, projectId, region, user_id }: any) => {
  try {
    const ctUid = keyMapper?.[contentTypeUid];
    const req: any = {
      params: {
        projectId,
        contentTypeUid: ctUid
      },
      body: {
        token_payload: {
          region,
          user_id
        }
      }
    }
    const contentTypeSchema = await contentMapperService.getExistingContentTypes(req);
    return contentTypeSchema?.selectedContentType;
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

const mergeTwoCts = async (ct: any, mergeCts: any) => {
  const ctData: any = {
    ...ct,
    title: mergeCts?.title,
    uid: mergeCts?.uid,
    options: {
      "singleton": false,
    }
  }
  for await (const field of ctData?.schema ?? []) {
    if (field?.data_type === 'group') {
      const currentGroup = mergeCts?.schema?.find((grp: any) => grp?.uid === field?.uid &&
        grp?.data_type === 'group');
      const group = [];
      for await (const fieldGp of currentGroup?.schema ?? []) {
        const fieldNst = field?.schema?.find((fld: any) => fld?.uid === fieldGp?.uid &&
          fld?.data_type === fieldGp?.data_type);
        if (fieldNst === undefined) {
          group?.push(fieldGp);
        }
      }
      field.schema = removeDuplicateFields([...field?.schema ?? [], ...group]);
    }
  }
  ctData.schema = await mergeArrays(ctData?.schema, mergeCts?.schema) ?? [];
  return ctData;
}

export const contenTypeMaker = async ({ contentType, destinationStackId, projectId, newStack, keyMapper, region, user_id }: any) => {
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
    currentCt = await existingCtMapper({ keyMapper, contentTypeUid: contentType?.contentstackUid, projectId, region, user_id });
  }

  // Safe: ensures we never pass undefined to the builder
  const ctData: any[] = buildSchemaTree(contentType?.fieldMapping || []);
  
  // Use the deep converter that properly handles groups & modular blocks
  for (const item of ctData) {
    if (item?.isDeleted === true) continue;

    const fieldSchema = buildFieldSchema(item, marketPlacePath, '');
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
};