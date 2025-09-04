import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
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
  for (const field of fields) {
    switch (field?.contentstackFieldType) {
      case 'modular_blocks': {
        // Recursively process nested schema if present
        if (Array.isArray(field?.schema) && items?.[field?.uid]) {
          processFieldsRecursive(field.schema, items?.[field?.uid]);
        }
        break;
      }
      case 'modular_blocks_child': {
        const childItems = items?.[':items']
        console.info("🚀 ~ processFieldsRecursive ~ childItems:", field.schema)
        // Recursively process nested schema if present
        if (Array.isArray(field?.schema)) {
          processFieldsRecursive(field.schema, childItems?.[field?.uid]);
        }
        break;
      }
      case 'group': {
        const childItems = items?.[':items'];
        // console.info("🚀 ~ processFieldsRecursive ~ childItems:", field?.uid, field?.contentstackFieldType, items)
        break;
      }
      default: {
        // console.info("🚀 ~ processFieldsRecursive ~ childItems:", field?.uid, field?.contentstackFieldType)
        // Recursively process nested schema if present
        // if (Array.isArray(field?.schema)) {
        //   processFieldsRecursive(field.schema, items?.[field?.uid]);
        // }
        break;
      }
    }
  }
}



const containerCreator = (fieldMapping: any, items: any) => {
  const fields = buildSchemaTree(fieldMapping);
  processFieldsRecursive(fields, items);

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
      console.info('\n', '\n')
      const parseData = JSON.parse(content);
      const isEFragment = isExperienceFragment(parseData);
      const templateUid = isEFragment?.isXF ? parseData?.title : parseData?.templateName ?? parseData?.templateType;
      const contentType = (contentTypes as ContentType[] | undefined)?.find?.((element) => element?.otherCmsUid === templateUid);
      const obj: Record<string, unknown> = {};
      for (const field of contentType?.fieldMapping ?? []) {
        const items = parseData?.[':items']?.root?.[':items'];
        if (!items) return;
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
      }
      const items = parseData?.[':items']?.root?.[':items'];
      containerCreator(contentType?.fieldMapping, items)
    }
  }
}

export const aemService = {
  createAssets,
  createEntry
};