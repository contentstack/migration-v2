import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { JSDOM } from "jsdom";
import { htmlToJson } from '@contentstack/json-rte-serializer';
import { buildSchemaTree } from '../utils/content-type-creator.utils.js';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { getLogMessage } from '../utils/index.js';
import customLogger from '../utils/custom-logger.utils.js';

const baseDirName = MIGRATION_DATA_CONFIG.DATA;
const {
  ENTRIES_DIR_NAME,
} = MIGRATION_DATA_CONFIG;

interface CreateAssetsOptions {
  packagePath?: string;
}

interface FieldMapping {
  uid?: string;
  contentstackFieldType?: string;
}

interface Project {
  master_locale?: object;
  locales?: object;
  // add other properties as needed
}

interface ContentType {
  contentstackUid?: string;
  otherCmsUid?: string;
  fieldMapping?: FieldMapping[];
}

interface CreateEntryOptions {
  project?: Project;
  packagePath?: string;
  contentTypes?: ContentType;
  master_locale?: string;
  destinationStackId: string;
  projectId: string;
  keyMapper?: unknown;
}

async function writeOneFile(indexPath: string, fileMeta: any) {
  fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
    if (err) {
      console.error('Error writing file: 3', err);
    }
  });
}

async function writeFiles(
  entryPath: string,
  fileMeta: any,
  entryLocale: any,
  locale: string
) {
  try {
    const indexPath = path.join(entryPath, 'index.json');
    const localePath = path.join(entryPath, `${locale}.json`);
    fs.access(entryPath, async (err) => {
      if (err) {
        fs.mkdir(entryPath, { recursive: true }, async (err) => {
          if (err) {
            console.error('Error writing file: 2', err);
          } else {
            await writeOneFile(indexPath, fileMeta);
            await writeOneFile(localePath, entryLocale);
          }
        });
      } else {
        await writeOneFile(indexPath, fileMeta);
        await writeOneFile(localePath, entryLocale);
      }
    });
  } catch (error) {
    console.error('Error writing files:', error);
  }
}

const getLastKey = (str: string, items = '.') => {
  if (!str) return '';
  const parts = str.split(items);
  return parts[parts.length - 1];
};

const attachJsonRte = ({ content = "" }: any) => {
  const dom = new JSDOM(content);
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);
}

function slugify(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/\|/g, '')           // Remove pipe characters
    .replace(/[^\w\s-]/g, '')     // Remove non-word, non-space, non-hyphen chars
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with one
    .replace(/^-+|-+$/g, '');     // Trim leading/trailing hyphens
}

function addEntryToEntriesData(
  entriesData: Record<string, Record<string, any[]>>,
  contentTypeUid: string,
  entryObj: any,
  mappedLocale: string
) {
  if (!entriesData[contentTypeUid]) {
    entriesData[contentTypeUid] = {};
  }
  if (!entriesData[contentTypeUid][mappedLocale]) {
    entriesData[contentTypeUid][mappedLocale] = [];
  }
  entriesData[contentTypeUid][mappedLocale].push(entryObj);
}

/**
 * Extracts the current locale from the given parseData object.
 * @param parseData The parsed data object from the JSON file.
 * @returns The locale string if found, otherwise undefined.
 */
function getCurrentLocale(parseData: any): string | undefined {
  if (parseData.language) {
    return parseData.language;
  } else if (parseData[":path"]) {
    const segments = parseData[":path"].split("/");
    return segments[segments.length - 1];
  }
  return undefined;
}

function getLocaleFromMapper(mapper: Record<string, string>, locale: string): string | undefined {
  return Object.keys(mapper).find(key => mapper[key] === locale);
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

function processFieldsRecursive(fields: any[], items: any, title: string) {
  if (!fields) return;
  const obj: any = {};
  const data: any = [];
  for (const field of fields) {
    switch (field?.contentstackFieldType) {
      case 'modular_blocks': {
        const modularData = items?.[field?.uid] ? items?.[field?.uid] : items?.[':items'];
        if (Array.isArray(field?.schema)) {
          const itemsData = modularData?.[':items'] ?? modularData;
          const value = processFieldsRecursive(field.schema, itemsData, title)
          const uid = getLastKey(field?.contentstackFieldUid);
          obj[uid] = value;
        }
        break;
      }
      case 'modular_blocks_child': {
        for (const [, value] of Object.entries(items)) {
          const objData: any = {};
          const typeValue = (value as { [key: string]: string })[':type'];
          const getTypeComp = getLastKey(typeValue, '/');
          const uid = getLastKey(field?.contentstackFieldUid);
          if (getTypeComp === field?.uid) {
            const compValue = processFieldsRecursive(field.schema, value, title);
            if (Object?.keys?.(compValue)?.length) {
              objData[uid] = compValue;
              data?.push(objData);
            }
          }
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
              const value = processFieldsRecursive(field.schema, element, title);
              groupData?.push(value);
            }
          }
          obj[uid] = groupData;
        } else {
          if (Array.isArray(field?.schema)) {
            const value = processFieldsRecursive(field.schema, groupValue, title);
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
      case 'text': {
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = title ?? '';
        break;
      }
      case 'url': {
        const uid = getLastKey(field?.contentstackFieldUid);
        obj[uid] = `/${slugify(title)}`;
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
        // console.info(items)
        break;
      }
      default: {
        console.info("🚀 ~ processFieldsRecursive ~ childItems:", field?.uid, field?.contentstackFieldType)
        break;
      }
    }
  }
  return data?.length ? data : obj;
}

const containerCreator = (fieldMapping: any, items: any, title: string) => {
  const fields = buildSchemaTree(fieldMapping);
  return processFieldsRecursive(fields, items, title);
}

const getTitle = (parseData: any) => {
  return parseData?.title ?? parseData?.templateType;
}

const createEntry = async ({
  packagePath,
  contentTypes,
  destinationStackId,
  projectId,
  // keyMapper,
  project
}: CreateEntryOptions) => {
  const srcFunc = 'createEntry';
  const baseDir = path.join(baseDirName, destinationStackId);
  const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
  const entriesDir = path.resolve(packagePath ?? '');
  const entriesData: Record<string, Record<string, any[]>> = {};
  const allLocales: object = { ...project?.master_locale, ...project?.locales, ...{ 'fr': 'sc' } }
  for await (const fileName of read(entriesDir)) {
    const filePath = path.join(entriesDir, fileName);
    const content: unknown = await fs.promises.readFile(filePath, 'utf-8');
    if (typeof content === 'string') {
      const parseData = JSON.parse(content);
      const title = getTitle(parseData);
      const isEFragment = isExperienceFragment(parseData);
      const templateUid = isEFragment?.isXF ? parseData?.title : parseData?.templateName ?? parseData?.templateType;
      const contentType = (contentTypes as ContentType[] | undefined)?.find?.((element) => element?.otherCmsUid === templateUid);
      const locale = getCurrentLocale(parseData);
      const mappedLocale = locale ? getLocaleFromMapper(allLocales as Record<string, string>, locale) : Object.keys(project?.master_locale ?? {})?.[0];
      const items = parseData?.[':items']?.root?.[':items'];
      const data = containerCreator(contentType?.fieldMapping, items, title);
      data.publish_details = [];
      if (contentType?.contentstackUid && data && mappedLocale) {
        const message = getLogMessage(
          srcFunc,
          `Entry title "${data?.title}"(${contentType?.contentstackUid}
          }) in the ${mappedLocale} locale has been successfully transformed.`,
          {}
        );
        await customLogger(
          projectId,
          destinationStackId,
          'info',
          message
        );
        addEntryToEntriesData(entriesData, contentType.contentstackUid, data, mappedLocale);
      }
    }
  }
  if (Object.keys(entriesData)?.length) {
    for (const [ctUid, value] of Object.entries(entriesData)) {
      const entriesLocale = Object.entries(value);
      if (entriesLocale?.length) {
        for (const [locale, entries] of entriesLocale) {
          const fileMeta = { '1': `${locale}.json` };
          const entryPath = path.join(
            process.cwd(),
            entrySave,
            ctUid,
            locale
          );
          await writeFiles(entryPath, fileMeta, entries, locale);
        }
      }
    }
  }
}

export const aemService = {
  createAssets,
  createEntry
};