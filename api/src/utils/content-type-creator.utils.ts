import fs from 'fs';
import path from 'path';
import _ from 'lodash';
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
  data_type: string;
  display_name?: string; // Assuming item?.contentstackField might be undefined
  field_metadata: Record<string, any>; // Assuming it's an object with any properties
  schema: any[]; // Define the type of elements in the schema array if possible
  uid?: string; // Assuming item?.contentstackFieldUid might be undefined
  multiple: boolean;
  mandatory: boolean;
  unique: boolean;
}

interface ContentType {
  title: string | undefined;
  uid: string | undefined;
  schema: any[]; // Replace `any` with the specific type if known
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

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `a_${_.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()}`
  }
  return _.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()
}

const arrangGroups = ({ schema, newStack }: any) => {
  const dtSchema: any = [];
  schema?.forEach((item: any) => {
    if (item?.contentstackFieldType === 'group') {
      const groupSchema: any = { ...item, schema: [] }
      schema?.forEach((et: any) => {
        if (et?.contentstackFieldUid?.includes(`${item?.contentstackFieldUid}.`) ||
          (newStack === false && et?.uid?.includes(`${item?.uid}.`))) {
          groupSchema?.schema?.push(et);
        }
      })
      dtSchema?.push(groupSchema);
    } else {
      if (!(item?.contentstackField?.includes('>') && item?.contentstackFieldUid?.includes('.'))) {
        dtSchema?.push(item);
      }
    }
  })
  return dtSchema;
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

const convertToSchemaFormate = ({ field, advanced = true, marketPlacePath }: any) => {
  switch (field?.contentstackFieldType) {
    case 'single_line_text': {
      return {
        "data_type": "text",
        "display_name": field?.title,
        uid: field?.uid,
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
        uid: field?.uid,
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
          display_name: field?.title ?? field?.uid,
          uid: field?.uid,
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
          "display_name": field?.title ?? field?.uid,
          "uid": field?.uid,
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
      const data = {
        "data_type": ['dropdownNumber', 'radioNumber', 'ratingNumber'].includes(field.otherCmsType) ? 'number' : "text",
        "display_name": field?.title,
        "display_type": "dropdown",
        "enum": {
          "advanced": advanced,
          choices: field?.advanced?.options?.length ? field?.advanced?.options : [{ value: "NF" }],
        },
        "multiple": field?.advanced?.multiple ?? false,
        uid: field?.uid,
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
      const data = {
        "data_type": ['dropdownNumber', 'radioNumber', 'ratingNumber'].includes(field.otherCmsType) ? 'number' : "text",
        "display_name": field?.title,
        "display_type": "radio",
        "enum": {
          "advanced": advanced,
          choices: field?.advanced?.options?.length ? field?.advanced?.options : [{ value: "NF" }],
        },
        "multiple": field?.advanced?.multiple ?? false,
        uid: field?.uid,
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
      const data = {
        "data_type": "text",
        "display_name": field?.title,
        "display_type": "checkbox",
        "enum": {
          "advanced": advanced,
          choices: field?.advanced?.options?.length ? field?.advanced?.options : [{ value: "NF" }],
        },
        "multiple": true,
        uid: field?.uid,
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
        uid: field?.uid,
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
        uid: field?.uid,
        "field_metadata": {
          description: "",
          "default_value": {
            "title": "",
            "url": '',
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
        uid: field?.uid,
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
        "uid": field?.uid,
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
        uid: field?.uid,
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
        uid: field?.uid,
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
        "uid": field?.uid,
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
        uid: field?.uid,
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
        "uid": field?.uid,
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
          "uid": field?.uid,
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
          "uid": field?.uid,
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
          "uid": field?.uid,
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
        console.info('Contnet Type Filed', field?.contentstackField)
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
    globalfields = JSON.parse(data);
  } catch (readErr: any) {
    if (readErr?.code !== 'ENOENT') {
      console.error("🚀 ~ fs.readFile ~ err:", readErr);
      return;
    }
  }
  globalfields.push(schema);
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
      field.schema = [...field?.schema ?? [], ...group];
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
  }
  let currentCt: any = {};
  if (Object?.keys?.(keyMapper)?.length &&
    keyMapper?.[contentType?.contentstackUid] !== "" &&
    keyMapper?.[contentType?.contentstackUid] !== undefined) {
    currentCt = await existingCtMapper({ keyMapper, contentTypeUid: contentType?.contentstackUid, projectId, region, user_id });
  }
  const ctData: any = arrangGroups({ schema: contentType?.fieldMapping, newStack })
  ctData?.forEach((item: any) => {
    if (item?.contentstackFieldType === 'group') {
      const group: Group = {
        "data_type": "group",
        "display_name": item?.contentstackField,
        "field_metadata": {},
        "schema": [],
        "uid": item?.contentstackFieldUid,
        "multiple": false,
        "mandatory": false,
        "unique": false
      }
      item?.schema?.forEach((element: any) => {
        const field: any = {
          ...element,
          uid: extractValue(element?.contentstackFieldUid, item?.contentstackFieldUid, '.'),
          title: extractValue(element?.contentstackField, item?.contentstackField, ' >')?.trim(),
        }
        const schema: any = convertToSchemaFormate({ field, marketPlacePath });
        if (typeof schema === 'object' && Array.isArray(group?.schema) && element?.isDeleted === false) {
          group.schema.push(schema);
        }
      })
      ct?.schema?.push(group);
    } else {
      const dt: any = convertToSchemaFormate({
        field: {
          ...item,
          title: item?.contentstackField,
          uid: item?.contentstackFieldUid
        },
        marketPlacePath
      });
      if (dt && item?.isDeleted === false) {
        ct?.schema?.push(dt);
      }
    }
  })
  if (currentCt?.uid) {
    ct = await mergeTwoCts(ct, currentCt);
  }
  if (ct?.uid) {
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
    console.info(contentType?.contentstackUid, 'missing')
  }
}