import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import _ from "lodash";
import { v4 as uuidv4 } from 'uuid';
import { JSDOM } from "jsdom";
import { htmlToJson } from '@contentstack/json-rte-serializer';
import { buildSchemaTree } from '../utils/content-type-creator.utils.js';
import { MIGRATION_DATA_CONFIG, LOCALE_MAPPER } from '../constants/index.js';
import { getLogMessage } from '../utils/index.js';
import customLogger from '../utils/custom-logger.utils.js';
import { orgService } from './org.service.js';
import { Request } from 'express';

const baseDirName = MIGRATION_DATA_CONFIG.DATA;
const {
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  AEM_DAM_DIR
} = MIGRATION_DATA_CONFIG;

interface CreateAssetsOptions {
  destinationStackId: string;
  packagePath: string;
  projectId: string;
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
  contentTypes?: ContentType[];
  master_locale?: string;
  destinationStackId: string;
  projectId: string;
  keyMapper?: unknown;
}

interface LocaleInfo {
  code: string;
  fallback_locale: string | null;
  uid: string;
  name: string;
}

interface AssetJSON {
  urlPath: string;
  uid: string;
  content_type?: string;
  file_size?: number;
  tags: string[];
  filename?: string;
  is_dir: boolean;
  parent_uid: string | null;
  title?: string;
  publish_details: unknown[];
  assetPath: string;
}

async function isAssetJsonCreated(assetJsonPath: string): Promise<boolean> {
  try {
    await fs.promises.access(assetJsonPath, fs.constants.F_OK);
    return true; // File exists
  } catch {
    return false; // File does not exist
  }
}


/**
 * Finds and returns the asset object from assetJsonData where assetPath matches the given string.
 * @param assetJsonData - The asset JSON data object.
 * @param assetPathToFind - The asset path string to match.
 * @returns The matching AssetJSON object, or undefined if not found.
 */
function findAssetByPath(
  assetJsonData: Record<string, AssetJSON>,
  assetPathToFind: string
): AssetJSON | undefined {
  return Object.values(assetJsonData).find(
    (asset) => asset.assetPath === assetPathToFind
  );
}

async function writeOneFile(indexPath: string, fileMeta: any) {
  try {
    await fs.promises.writeFile(indexPath, JSON.stringify(fileMeta));
  } catch (err) {
    console.error('Error writing file:', err);
    throw err;
  }
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
    
    try {
      await fs.promises.access(entryPath);
    } catch {
      await fs.promises.mkdir(entryPath, { recursive: true });
    }
    
    await fs.promises.writeFile(indexPath, JSON.stringify(fileMeta));
    await fs.promises.writeFile(localePath, JSON.stringify(entryLocale));
} catch (error) {
    console.error('Error writing files:', error);
    throw error;
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


/**
 * Ensures the directory exists at the given path.
 * If it does not exist, creates it recursively.
 * @param assetsSave - The relative path to the assets directory.
 */
async function ensureAssetsDirectory(assetsSave: string): Promise<void> {
  const fullPath = path.join(process.cwd(), assetsSave);
  try {
    await fs.promises.access(fullPath);
    // Directory exists
    console.info(`Directory exists: ${fullPath}`);
  } catch (err) {
    // Directory does not exist, create it
    await fs.promises.mkdir(fullPath, { recursive: true });
    console.info(`Directory created: ${fullPath}`);
  }
}


/**
 * Fetch files from a directory based on a query.
 * @param dirPath - The directory to search in.
 * @param query - The query string (filename, extension, or regex).
 * @returns Array of matching file paths.
 */
export async function fetchFilesByQuery(
  dirPath: string,
  query: string | RegExp
): Promise<string[]> {
  const files: string[] = [];
  const resolvedDir = path.resolve(dirPath);

  for await (const fileName of read(resolvedDir)) {
    if (
      (typeof query === 'string' && fileName.includes(query)) ||
      (query instanceof RegExp && query.test(fileName))
    ) {
      files.push(path.join(resolvedDir, fileName));
    }
  }
  return files;
}

function addUidToEntryMapping(
  entryMapping: Record<string, string[]>,
  contentType: ContentType | undefined,
  uid: string
) {
  if (!contentType?.contentstackUid) return;
  if (!entryMapping[contentType.contentstackUid]) {
    entryMapping[contentType.contentstackUid] = [];
  }
  entryMapping[contentType.contentstackUid].push(uid);
}



const createAssets = async ({
  destinationStackId,
  projectId,
  packagePath,
}: CreateAssetsOptions) => {
  const srcFunc = 'createAssets';
  const damPath = path.join(packagePath, AEM_DAM_DIR);
  const baseDir = path.join(baseDirName, destinationStackId);
  const assetsSave = path.join(baseDir, ASSETS_DIR_NAME);
  await ensureAssetsDirectory(assetsSave);
  const assetsDir = path.resolve(packagePath);
  const allAssetJSON: Record<string, AssetJSON> = {};
  for await (const fileName of read(assetsDir)) {
    const filePath = path.join(assetsDir, fileName);
    // Exclude files from dam-downloads directory
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    const content = await fs.promises.readFile(filePath, 'utf-8');
    if (fileName?.endsWith?.('.json')) {
      try {
        const parseData = JSON.parse(content);
        const flatData = deepFlattenObject(parseData);
        for await (const [, value] of Object.entries(flatData)) {
          if (typeof value === 'string' && isImageType?.(value)) {
            const lastSegment = value?.split?.('/')?.pop?.();
            if (typeof lastSegment === 'string') {
              const assetsQueryPath = await fetchFilesByQuery(damPath, lastSegment);
              const firstJson = assetsQueryPath.find((filePath: string) => filePath?.endsWith?.('.json')) ?? null;
              if (typeof firstJson === 'string' && firstJson?.endsWith('.json')) {
                const contentAst = await fs.promises.readFile(firstJson, 'utf-8');
                if (typeof contentAst === 'string') {
                  const uid = uuidv4?.()?.replace?.(/-/g, '');
                  const parseData = JSON.parse(contentAst);
                  const filename = parseData?.asset?.name;
                  const nameWithoutExt = typeof filename === 'string' ? filename.split('.').slice(0, -1).join('.') : filename;
                  allAssetJSON[uid] = {
                    urlPath: `/assets/${uid}`,
                    uid: uid,
                    content_type: parseData?.asset?.mimeType,
                    file_size: parseData?.download?.downloadedSize,
                    tags: [],
                    filename,
                    is_dir: false,
                    parent_uid: null,
                    title: nameWithoutExt,
                    publish_details: [],
                    assetPath: value,
                  };
                  try {
                    const blobPath = firstJson?.replace?.('.metadata.json', '');
                    const assets = fs.readFileSync(path.join(blobPath));
                    fs.mkdirSync(path.join(assetsSave, 'files', uid), {
                      recursive: true,
                    });
                    fs.writeFileSync(
                      path.join(
                        process.cwd(),
                        assetsSave,
                        'files',
                        uid,
                        filename
                      ),
                      assets
                    );
                  } catch (err) {
                    console.error(
                      '🚀 ~ file: assets.js:52 ~ xml_folder?.forEach ~ err:',
                      err
                    );
                    const message = getLogMessage(
                      srcFunc,
                      `Not able to read the asset"${nameWithoutExt}(${uid})".`,
                      {},
                      err
                    );
                    await customLogger(projectId, destinationStackId, 'error', message);
                  }
                  const message = getLogMessage(
                    srcFunc,
                    `Asset "${parseData?.asset?.name}" has been successfully transformed.`,
                    {}
                  );
                  await customLogger(projectId, destinationStackId, 'info', message);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`❌ Failed to parse JSON in ${fileName}:`, err);
      }
    }
  }

  const fileMeta = { '1': ASSETS_SCHEMA_FILE };
  await fs.promises.writeFile(
    path.join(process.cwd(), assetsSave, ASSETS_FILE_NAME),
    JSON.stringify(fileMeta)
  );
  await fs.promises.writeFile(
    path.join(process.cwd(), assetsSave, ASSETS_SCHEMA_FILE),
    JSON.stringify(allAssetJSON)
  );
};

function processFieldsRecursive(fields: any[], items: any, title: string, assetJsonData: Record<string, AssetJSON>) {
  if (!fields) return;
  const obj: any = {};
  const data: any = [];
  for (const field of fields) {
    switch (field?.contentstackFieldType) {
      case 'modular_blocks': {
        const modularData = items?.[field?.uid] ? items?.[field?.uid] : items?.[':items'];
        if (Array.isArray(field?.schema)) {
          const itemsData = modularData?.[':items'] ?? modularData;
          const value = processFieldsRecursive(field.schema, itemsData, title, assetJsonData)
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
            const compValue = processFieldsRecursive(field.schema, value, title, assetJsonData);
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
              const value = processFieldsRecursive(field.schema, element, title, assetJsonData);
              groupData?.push(value);
            }
          }
          obj[uid] = groupData;
        } else {
          if (Array.isArray(field?.schema)) {
            const value = processFieldsRecursive(field.schema, groupValue, title, assetJsonData);
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
        const fieldKey = getLastKey(field?.contentstackFieldUid);
        const refCtUid = field?.referenceTo?.[0] || field?.uid;
        
        for (const [key, val] of Object.entries(items) as [string, Record<string, unknown>][]) {
          if (!val?.configured || (val[':type'] as string) === 'nt:folder') {
            continue;
          }
          
          if (
            (val[':type'] as string)?.includes('experiencefragment') &&
            typeof val?.localizedFragmentVariationPath === 'string'
          ) {
            const pathMatchesField = val.localizedFragmentVariationPath.includes(`/${field?.uid}`);
            const pathMatchesRefType = val.localizedFragmentVariationPath.includes(`/${refCtUid}`);
            
            if (pathMatchesField || pathMatchesRefType) {
              obj[fieldKey] = [{
                "uid": val?.id,
                "_content_type_uid": refCtUid
              }];
              break;
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
        obj[uid] = null
        if (Object.keys(assetJsonData)?.length) {
          const match = findAssetByPath(assetJsonData, items?.src);
          if (match) {
            obj[uid] = match?.uid
          }
        }
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

const containerCreator = (fieldMapping: any, items: any, title: string, assetJsonData: Record<string, AssetJSON>) => {
  const fields = buildSchemaTree(fieldMapping);
  return processFieldsRecursive(fields, items, title, assetJsonData);
}

const getTitle = (parseData: any) => {
  return parseData?.title ?? parseData?.templateType;
}

const createEntry = async ({
  packagePath,
  contentTypes,
  destinationStackId,
  projectId,
  project
}: CreateEntryOptions) => {
  const srcFunc = 'createEntry';
  const baseDir = path.join(baseDirName, destinationStackId);
  const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
  const assetsSave = path.join(baseDir, ASSETS_DIR_NAME);
  const assetJson = path.join(assetsSave, ASSETS_SCHEMA_FILE);
  const exists = await isAssetJsonCreated(assetJson);
  let assetJsonData: Record<string, AssetJSON> = {};
  
  if (exists) {
    const assetData = await fs.promises.readFile(assetJson, 'utf-8');
    if (typeof assetData === 'string') {
      assetJsonData = JSON.parse(assetData);
    }
  }
  
  const entriesDir = path.resolve(packagePath ?? '');
  const damPath = path.join(entriesDir, AEM_DAM_DIR);
  const entriesData: Record<string, Record<string, any[]>> = {};
  const allLocales: object = { ...project?.master_locale, ...project?.locales };
  const entryMapping: Record<string, string[]> = {};

  // FIRST PASS: Process all entries and build mappings
  for await (const fileName of read(entriesDir)) {
    const filePath = path.join(entriesDir, fileName);
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    const content: unknown = await fs.promises.readFile(filePath, 'utf-8');
    if (typeof content === 'string') {
      const uid = uuidv4?.()?.replace?.(/-/g, '');
      const parseData = JSON.parse(content);
      const title = getTitle(parseData);
      const isEFragment = isExperienceFragment(parseData);
      const templateUid = isEFragment?.isXF ? parseData?.title : parseData?.templateName ?? parseData?.templateType;
      const contentType = (contentTypes as ContentType[] | undefined)?.find?.((element) => element?.otherCmsUid === templateUid);
      const locale = getCurrentLocale(parseData);
      const mappedLocale = locale ? getLocaleFromMapper(allLocales as Record<string, string>, locale) : Object?.keys?.(project?.master_locale ?? {})?.[0];
      const items = parseData?.[':items']?.root?.[':items'];
      const data = containerCreator(contentType?.fieldMapping, items, title, assetJsonData);
      data.uid = uid;
      data.publish_details = [];
      
      if (contentType?.contentstackUid && data && mappedLocale) {
        const message = getLogMessage(
          srcFunc,
          `Entry title "${data?.title}"(${contentType?.contentstackUid}) in the ${mappedLocale} locale has been successfully transformed.`,
          {}
        );
        await customLogger(
          projectId,
          destinationStackId,
          'info',
          message
        );
        addEntryToEntriesData(entriesData, contentType.contentstackUid, data, mappedLocale);
        addUidToEntryMapping(entryMapping, contentType, uid);
      }
    }
  }
  if (Object.keys?.(entriesData)?.length) {
    for await (const [ctUid, value] of Object.entries(entriesData)) {
      const entriesLocale = Object.entries(value);
      if (entriesLocale?.length) {
        for await (const [locale, entries] of entriesLocale) {
          for (const entry of entries) {
            const flatData = deepFlattenObject(entry);
            for (const [key, value] of Object.entries(flatData)) {
              if (key.endsWith('._content_type_uid') && typeof value === 'string') {
                const uidField = key.replace('._content_type_uid', '');
                const refs: string[] = entryMapping?.[value];
                
                if (refs?.length) {
                  _.set(entry, `${uidField}.uid`, refs[0]);
                } else {
                  console.info(`✗ No entry found for content type: ${value}`);
                }
              }
            }
          }
          const entriesObject: Record<string, any> = {};
          for (const entry of entries) {
            entriesObject[entry.uid] = entry;
          }    
          const fileMeta = { '1': `${locale}.json` };
          const entryPath = path.join(
            process.cwd(),
            entrySave,
            ctUid,
            locale
          );
          await writeFiles(entryPath, fileMeta, entriesObject, locale);
        }
      }
    }
  }
}


const createLocale = async (
  req: Request,
  destinationStackId: string,
  projectId: string,
  project: Project
) => {
  const srcFunc = 'createLocale';
  try {
    const baseDir = path.join(baseDirName, destinationStackId);
    const localeSave = path.join(baseDir, LOCALE_DIR_NAME);
    const allLocalesResp = await orgService.getLocales(req);
    const masterLocale = Object?.keys?.(
      project?.master_locale ?? LOCALE_MAPPER?.masterLocale
    )?.[0];
    const msLocale: Record<string, LocaleInfo> = {};
    const uid = uuidv4();
    msLocale[uid] = {
      code: masterLocale,
      fallback_locale: null,
      uid: uid,
      name: allLocalesResp?.data?.locales?.[masterLocale] ?? '',
    };
    const message = getLogMessage(
      srcFunc,
      `Master locale ${masterLocale} has been successfully transformed.`,
      {}
    );
    await customLogger(projectId, destinationStackId, 'info', message);
    const allLocales: Record<string, LocaleInfo> = {};
    for (const [key, value] of Object.entries(
      project?.locales ?? LOCALE_MAPPER
    )) {
      const localeUid = uuidv4();
      if (key !== 'masterLocale' && typeof value === 'string') {
        allLocales[localeUid] = {
          code: key,
          fallback_locale: masterLocale,
          uid: localeUid,
          name: allLocalesResp?.data?.locales?.[key] ?? '',
        };
        const message = getLogMessage(
          srcFunc,
          `locale ${value} has been successfully transformed.`,
          {}
        );
        await customLogger(projectId, destinationStackId, 'info', message);
      }
    }
    const masterPath = path.join(localeSave, LOCALE_MASTER_LOCALE);
    const allLocalePath = path.join(localeSave, LOCALE_FILE_NAME);
    fs.access(localeSave, async (err) => {
      if (err) {
        fs.mkdir(localeSave, { recursive: true }, async (err) => {
          if (!err) {
            await writeOneFile(masterPath, msLocale);
            await writeOneFile(allLocalePath, allLocales);
          }
        });
      } else {
        await writeOneFile(masterPath, msLocale);
        await writeOneFile(allLocalePath, allLocales);
      }
    });
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `error while Creating the locales.`,
      {},
      err
    );
    await customLogger(projectId, destinationStackId, 'error', message);
  }
};


const createVersionFile = async (destinationStackId: string) => {
  const baseDir = path.join(baseDirName, destinationStackId);
  fs.writeFile(
    path?.join?.(baseDir, EXPORT_INFO_FILE),
    JSON.stringify({
      contentVersion: 2,
      logsPath: '',
    }),
    (err) => {
      if (err) {
        console.error('Error writing file: 3', err);
      }
    }
  );
};


export const aemService = {
  createAssets,
  createEntry,
  createLocale,
  createVersionFile
};