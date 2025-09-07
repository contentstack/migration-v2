import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { JSDOM } from "jsdom";
import { htmlToJson } from '@contentstack/json-rte-serializer';
import { buildSchemaTree } from '../utils/content-type-creator.utils.js';

interface CreateAssetsOptions {
  packagePath?: string;
}

interface FieldMapping {
  uid?: string;
  contentstackFieldType?: string;
}


interface ContentType {
  otherCmsUid?: string;
  fieldMapping?: FieldMapping[];
}

interface CreateEntryOptions {
  packagePath?: string;
  contentTypes?: ContentType;
  master_locale?: string;
  destinationStackId?: string;
  projectId?: string;
  keyMapper?: unknown;
  project?: unknown;
}

const getLastKey = (str: string) => {
  if (!str) return '';
  const parts = str.split('.');
  return parts[parts.length - 1];
};

const attachJsonRte = ({ content = "" }: any) => {
  const dom = new JSDOM(content);
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);
}



const deepFlattenObject = (obj: any, prefix = '', res: any = {}) => {
  if (Array.isArray(obj) || (obj && typeof obj === 'object')) {
    const entries = Array.isArray(obj) ? obj.map((v, i) => [i, v])
      : Object.entries(obj);
    for (const [key, value] of entries) {
      const newKey = prefix ? `${prefix}.${key}` : `${key}`;
      if (value && typeof value === 'object') {
        deepFlattenObject(value, newKey, res);
      } else {
        res[newKey] = value;
      }
    }
  } else {
    res[prefix] = obj;
  }
  return res;
};

export function isImageType(path: string): boolean {
  return /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(path);
}

export function isExperienceFragment(data: any) {
  if (data?.templateType && data[':type']) {
    // Check templateType starts with 'xf-'
    const hasXfTemplate = data?.templateType?.startsWith('xf-');

    // Check :type contains 'components/xfpage'
    const hasXfComponent = data[':type']?.includes('components/xfpage');

    // Return analysis
    return {
      isXF: hasXfTemplate || hasXfComponent,
      confidence: (hasXfTemplate && hasXfComponent) ? 'high'
        : (hasXfTemplate || hasXfComponent) ? 'medium' : 'low',
      indicators: {
        templateType: hasXfTemplate ? data.templateType : null,
        componentType: hasXfComponent ? data[':type'] : null,
      }
    };
  }
  return null;
}



const createAssets = async ({
  packagePath = '/Users/umesh.more/Documents/aem_data_structure/templates',
}: CreateAssetsOptions) => {
  const assetsDir = path.resolve(packagePath);
  for await (const fileName of read(assetsDir)) {
    const filePath = path.join(assetsDir, fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    if (fileName.endsWith('.json')) {
      try {
        const parseData = JSON.parse(content);
        const flatData = deepFlattenObject(parseData);
        for (const [, value] of Object.entries(flatData)) {
          if (typeof value === 'string' && isImageType?.(value)) {
            // console.info("🚀 ~ createAssets ~ value:", value)
          }
        }
      } catch (err) {
        console.error(`❌ Failed to parse JSON in ${fileName}:`, err);
      }
    } else {
      console.info("🚀 ~ content:", content);
    }
  }
};

function processFieldsRecursive(fields: any[], items: any) {
  if (!fields) return;
  const obj: any = {};
  for (const field of fields) {
    switch (field?.contentstackFieldType) {
      case 'modular_blocks': {
        const modularData = items?.[field?.uid] ? items?.[field?.uid] : items?.[':items']
        if (Array.isArray(field?.schema)) {
          const value = processFieldsRecursive(field.schema, modularData);
          const uid = getLastKey(field?.contentstackFieldUid);
          obj[uid] = value;
        }
        break;
      }
      case 'modular_blocks_child': {
        const modularChildData = typeof (items?.[field?.uid] ?? items?.[':items']) === 'object' ? Object.values(items?.[field?.uid] ?? items?.[':items'])
          : items?.[field?.uid] ?? items?.[':items'];

        for (const element of modularChildData ?? []) {
          console.info("🚀 ~ processFieldsRecursive ~ element:", element)
        }
        if (Array.isArray(field?.schema)) {
          const value = processFieldsRecursive(field.schema, modularChildData);
          const uid = getLastKey(field?.contentstackFieldUid);
          obj[uid] = value;
        }
        break;
      }
      case 'group': {
        const groupData: unknown[] = [];
        const groupValue = items?.[field?.uid]?.items ?? items?.[field?.uid];
        const uid = getLastKey(field?.contentstackFieldUid);
        if (Array.isArray(groupValue)) {
          for (const element of groupValue) {
            if (Array.isArray(field?.schema)) {
              const value = processFieldsRecursive(field.schema, element);
              groupData?.push(value);
            }
          }
          obj[uid] = groupData;
        } else {
          if (Array.isArray(field?.schema)) {
            const value = processFieldsRecursive(field.schema, groupValue);
            obj[uid] = value;
          }
        }
        break;
      }
      case 'boolean': {
        const value = items?.[field?.uid];
        const uid = getLastKey(field?.contentstackFieldUid);
        if (typeof value === 'boolean' || (typeof value === 'object' && value?.[':type']?.includes('separator'))) {
          obj[uid] = typeof value === 'boolean' ? value : true;
        }
        break;
      }
      case 'single_line_text': {
        const value = items?.[field?.uid];
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = value ?? '';
        break;
      }
      case 'text':
      case 'url': {
        break;
      }
      case 'reference': {
        for (const [, val] of Object.entries(items) as [string, Record<string, unknown>][]) {
          if (
            (typeof field?.uid === 'string' && !['title', 'url'].includes(field.uid)) &&
            field?.contentstackFieldType === "reference" &&
            (val[':type'] as string) !== 'nt:folder' &&
            val?.configured
          ) {
            if (typeof val?.localizedFragmentVariationPath === 'string' &&
              val.localizedFragmentVariationPath.includes(`/${field?.uid}`)) {
              obj[field?.uid as string] = [{
                "uid": val?.id,
                "_content_type_uid": field?.uid,
              }];
            }
          }
        }
        break;
      }
      case 'number': {
        const value = items?.[field?.uid];
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = value ?? '';
        break;
      }
      case 'json': {
        const value = items?.[field?.uid];
        const uid = getLastKey(field?.contentstackFieldUid);
        const jsonData = attachJsonRte({ content: value })
        obj[uid] = jsonData;
        break;
      }
      case 'link': {
        const value = { title: items?.['title'] ?? '', href: items?.['url'] ?? '' };
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = value;
        break;
      }
      case 'file': {
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = null;
        break;
      }
      case 'app': {
        console.info(items)
        break;
      }
      default: {
        // console.info("🚀 ~ processFieldsRecursive ~ childItems:", field?.uid, field?.contentstackFieldType)
        break;
      }
    }
  }
  return obj;
}

const containerCreator = (fieldMapping: any, items: any) => {
  const fields = buildSchemaTree(fieldMapping);
  return processFieldsRecursive(fields, items);
}

const createEntry = async ({
  packagePath,
  contentTypes,
  // master_locale,
  // destinationStackId,
  // projectId,
  // keyMapper,
  // project 
}: CreateEntryOptions) => {
  const entriesDir = path.resolve(packagePath ?? '');
  for await (const fileName of read(entriesDir)) {
    const filePath = path.join(entriesDir, fileName);
    const content: unknown = await fs.promises.readFile(filePath, 'utf-8');
    if (typeof content === 'string') {
      const parseData = JSON.parse(content);
      const isEFragment = isExperienceFragment(parseData);
      const templateUid = isEFragment?.isXF ? parseData?.title : parseData?.templateName ?? parseData?.templateType;
      const contentType = (contentTypes as ContentType[] | undefined)?.find?.((element) => element?.otherCmsUid === templateUid);
      const items = parseData?.[':items']?.root?.[':items'];
      containerCreator(contentType?.fieldMapping, items);
      // await fs.promises.writeFile(`./${templateUid}.json`, JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}

export const aemService = {
  createAssets,
  createEntry
};