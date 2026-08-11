import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import {
  LOCALE_MAPPER,
  MIGRATION_DATA_CONFIG,
  isSkippableSystemField,
} from '../constants/index.js';
import {
  entriesFieldCreator,
  unflatten,
} from '../utils/entries-field-creator.utils.js';
import { orgService } from './org.service.js';
import { getLogMessage } from '../utils/index.js';
import customLogger from '../utils/custom-logger.utils.js';
import { getSafePath } from '../utils/sanitize-path.utils.js';
import {
  buildAssetFolders,
  collectFolderUid,
  parentUidForAssetPath,
} from '../utils/asset-folder.utils.js';
import type { AssetFolderMapping } from '../utils/asset-folder.interface.js';
import { composeComponents } from '../utils/rendering-composer.utils.js';

const append = 'a';
const baseDirName = MIGRATION_DATA_CONFIG.DATA;
const {
  ENVIRONMENTS_DIR_NAME,
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  ASSETS_FOLDER_FILE_NAME,
  ENVIRONMENTS_FILE_NAME,
} = MIGRATION_DATA_CONFIG;

const idCorrector = ({ id }: any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) =>
    match === '-' ? '' : ''
  );
  if (newId) {
    return newId?.toLowerCase();
  } else {
    return id;
  }
};

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

function getLastKey(path: string) {
  const keys = path?.split?.('.');
  const lastKey = keys?.[keys?.length - 1];
  return lastKey;
}

// Sitecore stores every field flat on the entry root, but our content types nest inherited
// fields under a global field (e.g. `page_content.metatitle`). Flatten a nested content-type
// field uid down to the bare field name Sitecore uses — the last segment after the dot — so a
// nested mapping field can be matched against the flat Sitecore entry key.
function flattenFieldName(uid: string) {
  return getLastKey(uid);
}

// Normalize a Sitecore field key ("open graph title") to the uid style used in our schema
// ("open_graph_title") so flat Sitecore keys line up with global-field leaf uids.
function normalizeSitecoreKey(key: string) {
  return key?.replace(/[ -]/g, '_')?.toLowerCase?.();
}

// Inherited fields live inside global fields, which are nested groups/global-fields several
// levels deep (e.g. blh_page_base -> page_metadata -> metadata_details -> metatitle). Sitecore
// keeps those same fields flat on the entry root. This walks a content type's global_field
// references through the global-field definitions and returns a flat lookup from the bare
// Sitecore key to the full dotted path the value must be written at, so unflatten() can rebuild
// the nesting. `globalFields` is the list from globalfields.json ({ uid, schema }).
function buildGlobalFieldPathMap(fieldMapping: any[], globalFields: any[]) {
  const byUid: Record<string, any> = {};
  (globalFields ?? []).forEach((gf: any) => {
    if (gf?.uid) byUid[gf.uid] = gf;
  });
  // Sitecore key -> { path: full dotted path, dataType: leaf's Contentstack data_type }.
  const keyToPath: Record<string, { path: string; dataType: string }> = {};
  const seen = new Set<string>();

  const walk = (schema: any[], prefix: string[]) => {
    (schema ?? []).forEach((f: any) => {
      const uid = f?.uid;
      if (!uid) return;
      const dataType = f?.data_type;
      const nextPrefix = [...prefix, uid];
      if (dataType === 'group') {
        walk(f?.schema, nextPrefix);
      } else if (dataType === 'global_field') {
        const ref = f?.reference_to;
        // Guard against a global field referencing itself/a cycle.
        if (ref && !seen.has(ref) && byUid[ref]) {
          seen.add(ref);
          walk(byUid[ref]?.schema, nextPrefix);
          seen.delete(ref);
        }
      } else {
        // Leaf: last segment is the Sitecore key. Keep the first path if a key repeats.
        if (!(uid in keyToPath)) {
          keyToPath[uid] = { path: nextPrefix.join('.'), dataType };
        }
      }
    });
  };

  (fieldMapping ?? []).forEach((fsc: any) => {
    if (fsc?.contentstackFieldType === 'global_field') {
      const ref = fsc?.reference_to ?? fsc?.refrenceTo ?? fsc?.contentstackFieldUid;
      if (ref && byUid[ref]) {
        seen.add(ref);
        walk(byUid[ref]?.schema, [fsc?.contentstackFieldUid]);
        seen.delete(ref);
      }
    }
  });

  return keyToPath;
}

// Contentstack data_type -> the contentstackFieldType entriesFieldCreator switches on, so a
// global-field leaf's value is converted the same way a top-level field of that type would be.
function dataTypeToFieldType(dataType: string) {
  switch (dataType) {
    case 'text':
      return 'single_line_text';
    case 'json':
      return 'json';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'file':
      return 'file';
    case 'reference':
      return 'reference';
    case 'link':
      return 'link';
    default:
      return dataType;
  }
}

const AssetsPathSplitter = ({ path, id }: any) => {
  let newPath = path?.split(id)?.[0];
  if (newPath?.includes('media library/')) {
    newPath = newPath?.split('media library/')?.[1];
  }
  return newPath;
};

const mapLocales = ({ masterLocale, locale, locales }: any) => {
  if (locales?.masterLocale?.[masterLocale ?? ''] === locale) {
    return Object?.keys(locales?.masterLocale)?.[0];
  }
  for (const [key, value] of Object?.entries?.(locales) ?? {}) {
    if (typeof value !== 'object' && value === locale) {
      return key;
    }
  }
  return locale?.toLowerCase?.();
};

async function writeOneFile(indexPath: string, fileMeta: any) {
  // Must await the write: the callback form returns before the fd is closed, so
  // callers in a loop pile up open handles and eventually hit EMFILE.
  try {
    await fs.promises.writeFile(indexPath, JSON.stringify(fileMeta));
  } catch (err) {
    console.error('Error writing file: 3', err);
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
    // mkdir with recursive:true is a no-op when the dir already exists, so this
    // replaces the previous access-then-mkdir callback nesting. Awaiting matters:
    // the callback version let the caller continue before these writes finished.
    await fs.promises.mkdir(entryPath, { recursive: true });
    await writeOneFile(indexPath, fileMeta);
    await writeOneFile(localePath, entryLocale);
  } catch (error) {
    console.error('Error writing files:', error);
  }
}
const uidCorrector = ({ uid } :{uid : string}) => {
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

const createAssets = async ({
  packagePath,
  baseDir,
  destinationStackId,
  projectId,
}: any) => {
  const srcFunc = 'createAssets';
  const assetsSave = path.join(baseDir, ASSETS_DIR_NAME);
  const allAssetJSON: any = {};
  const folderName: any = getSafePath(
    path.join(packagePath, 'items', 'master', 'sitecore', 'media library')
  );
  const entryPath = read?.(folderName);

  // First pass: collect every media item's path so the folder tree can be built before
  // any asset needs a parent_uid, and gather Sitecore folder GUIDs where they're
  // available. Sitecore exports few `media folder` items, so most GUIDs come from
  // children naming their parent via `parentid` (see asset-folder.utils).
  const assetPathsForFolders: (string | undefined)[] = [];
  const sitecoreFolderUids: Record<string, string> = {};
  for await (const file of entryPath) {
    if (!file?.endsWith('data.json')) continue;
    try {
      const raw: any = await fs.promises.readFile(
        path.join(folderName, file),
        'utf8'
      );
      const item = JSON.parse(raw)?.item?.$ ?? {};
      const itemPath = AssetsPathSplitter({ path: file, id: item?.id });
      const isFolder = `${item?.template ?? ''}`.toLowerCase() === 'media folder';
      if (isFolder) {
        // The folder's own item shipped — authoritative id for this path.
        collectFolderUid(sitecoreFolderUids, itemPath, item?.id, {
          authoritative: true,
        });
      } else {
        assetPathsForFolders.push(itemPath);
        // The parent folder's item may be absent; its GUID is still recoverable here.
        collectFolderUid(sitecoreFolderUids, itemPath, item?.parentid, {
          authoritative: false,
        });
      }
    } catch (err) {
      console.error('🚀 ~ createAssets ~ folder pre-scan failed:', file, err);
    }
  }
  const { folders: assetFolders, mappings: folderMappings } = buildAssetFolders(
    assetPathsForFolders,
    sitecoreFolderUids
  );
  // Folders live in the same index as assets, distinguished by is_dir.
  Object.assign(allAssetJSON, assetFolders);
  const folderMessage = getLogMessage(
    srcFunc,
    `Created ${folderMappings.length} asset folders from the Sitecore media library tree (${
      folderMappings.filter((f: AssetFolderMapping) => f.sitecoreUid).length
    } with a known Sitecore uid).`,
    {}
  );
  await customLogger(projectId, destinationStackId, 'info', folderMessage);

  for await (const file of entryPath) {
    if (file?.endsWith('data.json')) {
      const data: any = await fs.promises.readFile(
        path.join(folderName, file),
        'utf8'
      );
      const jsonAsset = JSON.parse(data);
      // Folder items are already represented in allAssetJSON; they carry no blob.
      if (
        `${jsonAsset?.item?.$?.template ?? ''}`.toLowerCase() === 'media folder'
      ) {
        continue;
      }
      const assetPath = AssetsPathSplitter({
        path: file,
        id: jsonAsset?.item?.$?.id,
      });
      const metaData: any = {};
      metaData.uid = idCorrector({ id: jsonAsset?.item?.$?.id });
      jsonAsset?.item?.fields?.field?.forEach?.((field: any) => {
        if (field?.$?.key === 'blob' && field?.$?.type === 'attachment') {
          metaData.id = field?.content?.replace(/[{}]/g, '')?.toLowerCase();
        }
        if (field?.$?.key === 'extension') {
          metaData.extension = field?.content;
        }
        if (field?.$?.key === 'mime type') {
          metaData.content_type = field?.content;
        }
        if (field?.$?.key === 'size') {
          metaData.size = field?.content;
        }
      });
      const blobPath: any = path.join(packagePath, 'blob', 'master');
      const assetsPath = read(blobPath);
      if (assetsPath?.length) {
        const isIdPresent = assetsPath?.find((ast) => {
          return ast?.includes(metaData?.id);
        });
        if (isIdPresent) {
          try {
            const assets = fs.readFileSync(path.join(blobPath, isIdPresent));
            fs.mkdirSync(path.join(assetsSave, 'files', metaData?.uid), {
              recursive: true,
            });
            fs.writeFileSync(
              path.join(
                process.cwd(),
                assetsSave,
                'files',
                metaData?.uid,
                `${jsonAsset?.item?.$?.name}.${metaData?.extension}`
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
              `Not able to read the asset"${jsonAsset?.item?.$?.name}(${metaData?.uid})".`,
              {},
              err
            );
            await customLogger(projectId, destinationStackId, 'error', message);
          }
          allAssetJSON[metaData?.uid] = {
            urlPath: `/assets/${metaData?.uid}`,
            uid: metaData?.uid,
            content_type: metaData?.content_type,
            file_size: metaData.size,
            tags: [],
            filename: `${jsonAsset?.item?.$?.name}.${metaData?.extension}`,
            is_dir: false,
            // Resolved from the item's own media-library path, so an asset lands in
            // the folder it came from instead of all assets sharing one parent.
            parent_uid: parentUidForAssetPath(assetPath),
            title: jsonAsset?.item?.$?.name,
            publish_details: [],
            assetPath,
          };
          const message = getLogMessage(
            srcFunc,
            `Asset "${jsonAsset?.item?.$?.name}" has been successfully transformed.`,
            {}
          );
          await customLogger(projectId, destinationStackId, 'info', message);
        } else {
          const message = getLogMessage(
            srcFunc,
            `Asset "${jsonAsset?.item?.$?.name}" blob is missing for these assets.`,
            {}
          );
          await customLogger(projectId, destinationStackId, 'error', message);
        }
      }
    }
  }

  // Ensure assets directory exists
  await fs.promises.mkdir(assetsSave, { recursive: true });

  const fileMeta = { '1': ASSETS_SCHEMA_FILE };
  await fs.promises.writeFile(
    path.join(process.cwd(), assetsSave, ASSETS_FILE_NAME),
    JSON.stringify(fileMeta)
  );
  await fs.promises.writeFile(
    path.join(process.cwd(), assetsSave, ASSETS_SCHEMA_FILE),
    JSON.stringify(allAssetJSON)
  );
  // Folder mapper for post-migration lookups: a Sitecore folder reference (from a
  // `redirect to item` style field) is resolved to the Contentstack folder uid created
  // above. Keyed by path because only some folders have a recoverable Sitecore uid.
  await fs.promises.writeFile(
    path.join(process.cwd(), assetsSave, ASSETS_FOLDER_FILE_NAME),
    JSON.stringify(folderMappings, null, 2)
  );

  return allAssetJSON;
};

/**
 * Write an empty but well-formed assets index for a run that skips asset migration.
 *
 * Skipping assets is deliberate here, but "no assets" and "no assets directory" are not
 * the same thing downstream: runStartMigration reads
 * `<stack>/assets/index.json` and returns early — before the import CLI runs — when the
 * file is missing, so an absent directory silently aborts the entire migration rather
 * than just omitting assets. Writing the same three files createAssets would write, with
 * empty contents, keeps that contract and lets content types and entries import.
 *
 * Mirrors the file layout in createAssets: `assets.json` is the chunk manifest,
 * `index.json` the asset map, `folders.json` the folder mapper.
 */
const writeEmptyAssetsIndex = async ({
  baseDir,
  destinationStackId,
  projectId,
}: any) => {
  const srcFunc = 'writeEmptyAssetsIndex';
  const assetsSave = path.join(baseDir, ASSETS_DIR_NAME);
  try {
    await fs.promises.mkdir(path.join(process.cwd(), assetsSave), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(process.cwd(), assetsSave, ASSETS_FILE_NAME),
      JSON.stringify({ '1': ASSETS_SCHEMA_FILE })
    );
    await fs.promises.writeFile(
      path.join(process.cwd(), assetsSave, ASSETS_SCHEMA_FILE),
      JSON.stringify({})
    );
    await fs.promises.writeFile(
      path.join(process.cwd(), assetsSave, ASSETS_FOLDER_FILE_NAME),
      JSON.stringify([], null, 2)
    );
    const message = getLogMessage(
      srcFunc,
      'Asset migration is disabled for this run: an empty assets index was written so content types and entries can still be imported. No assets will be created in the stack, and asset-backed fields will be empty.',
      {}
    );
    await customLogger(projectId, destinationStackId, 'warn', message);
  } catch (err) {
    console.error('🚀 ~ writeEmptyAssetsIndex ~ err:', err);
    const message = getLogMessage(
      srcFunc,
      'Failed to write the empty assets index; the migration will stop before the import step.',
      {},
      err
    );
    await customLogger(projectId, destinationStackId, 'error', message);
  }
};

const createEntry = async ({
  packagePath,
  contentTypes,
  master_locale,
  destinationStackId,
  projectId,
  keyMapper,
  project,
}: {
  packagePath: any;
  contentTypes: any;
  master_locale?: string;
  destinationStackId: string;
  projectId: string;
  keyMapper: any;
  project: any;
}) => {
  try {
    const srcFunc = 'createEntry';
    const baseDir = path.join(baseDirName, destinationStackId);
    const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
    // Asset migration is intentionally skipped: entries and content types are being
    // migrated without assets for now. `allAssetJSON` stays empty, so `file` fields and
    // asset-backed union blocks resolve to null rather than pointing at assets that were
    // never uploaded.
    //
    // Downstream still needs a well-formed (empty) assets index — the delta step in
    // migration.service.ts reads assets/index.json and aborts the whole run before the
    // import CLI if it is absent. writeEmptyAssetsIndex keeps that contract.
    const allAssetJSON: any = {};
    await writeEmptyAssetsIndex({ baseDir, destinationStackId, projectId });
    // Inherited fields live inside global fields; load their definitions so flat Sitecore
    // fields can be routed to the nested global-field paths (see buildGlobalFieldPathMap).
    let globalFields: any[] = [];
    try {
      const globalFieldsPath = path.join(
        baseDir,
        MIGRATION_DATA_CONFIG.GLOBAL_FIELDS_DIR_NAME,
        MIGRATION_DATA_CONFIG.GLOBAL_FIELDS_FILE_NAME
      );
      if (fs.existsSync(globalFieldsPath)) {
        globalFields =
          JSON.parse(await fs.promises.readFile(globalFieldsPath, 'utf8')) ?? [];
      }
    } catch (err) {
      console.error('🚀 ~ createEntry ~ failed to load global fields:', err);
    }
    const folderName: any = getSafePath(
      path.join(packagePath, 'items', 'master', 'sitecore', 'content')
    );
    const entriesData: any = [];
    const childIndex: Record<string, string[]> = {};
    if (fs.existsSync(folderName)) {
      const entryPath = read?.(folderName);
      for await (const file of entryPath) {
        if (file?.endsWith('data.json')) {
          const data = await fs.promises.readFile(
            path.join(folderName, file),
            'utf8'
          );
          const jsonData = JSON.parse(data);
          const { language, template } = jsonData?.item?.$ ?? {};
          const id = idCorrector({ id: jsonData?.item?.$?.id });
          // Parent -> children, built here because this loop already reads every item's
          // meta. Used to expand a folder datasource into the children a rendering
          // actually displays (see rendering-composer.utils.ts). Keyed by raw uppercased
          // GUID to match the `s:ds` attribute rather than the corrected entry uid.
          const rawId = `${jsonData?.item?.$?.id ?? ''}`.toUpperCase();
          const rawParent = `${jsonData?.item?.$?.parentid ?? ''}`.toUpperCase();
          if (rawId && rawParent) {
            if (!childIndex[rawParent]) childIndex[rawParent] = [];
            if (!childIndex[rawParent].includes(rawId)) {
              childIndex[rawParent].push(rawId);
            }
          }
          const entries: any = {};
          entries[id] = {
            meta: jsonData?.item?.$,
            fields: jsonData?.item?.fields,
          };
          const templateIndex = entriesData?.findIndex(
            (ele: any) => ele?.template === template
          );
          if (templateIndex >= 0) {
            const entry = entriesData?.[templateIndex]?.locale?.[language];
            if (entry !== undefined) {
              entry[id] = {
                meta: jsonData?.item?.$,
                fields: jsonData?.item?.fields,
              };
            } else {
              entriesData[templateIndex].locale[language] = entries;
            }
          } else {
            const locale: any = {};
            locale[language] = entries;
            entriesData?.push({ template, locale });
          }
        }
      }
    }
    for await (const ctType of contentTypes) {
      const message = getLogMessage(
        srcFunc,
        `Transforming entries of Content Type ${
          keyMapper?.[ctType?.contentstackUid] ?? ctType?.contentstackUid
        } has begun.`,
        {}
      );
      await customLogger(projectId, destinationStackId, 'info', message);
      // Flat Sitecore key -> full nested path for fields that live inside this content type's
      // global fields (inherited fields like metatitle/pagedescription).
      const globalFieldPathMap = buildGlobalFieldPathMap(
        ctType?.fieldMapping,
        globalFields
      );
      // Present only when the mapper ran with renderings enabled and this template
      // carries layout. Absent otherwise, which keeps composition entirely opt-in.
      const componentsField = ctType?.fieldMapping?.find(
        (item: any) =>
          item?.contentstackFieldType === 'modular_blocks' &&
          item?.isRenderingBlocks === true
      );
      const entryPresent: any = entriesData?.find(
        (item: any) =>
          uidCorrector({ uid: item?.template }) === ctType?.contentstackUid
      );
      if (entryPresent) {
        const locales: any = Object?.keys(entryPresent?.locale);
        const allLocales: any = {
          masterLocale: project?.master_locale ?? LOCALE_MAPPER?.masterLocale,
          ...(project?.locales ?? {}),
        };
        for await (const locale of locales) {
          const newLocale = mapLocales({
            masterLocale: master_locale,
            locale,
            locales: allLocales,
          });
          const entryLocale: any = {};
          // Awaited: the callbacks below populate `entryLocale`, which is written to
          // disk once this resolves. Without the await the write can race ahead of the
          // async work and emit an empty locale file.
          await Promise.all(
            Object.entries(entryPresent?.locale?.[locale] || {}).map(
            async ([uid, entry]: any) => {
              const entryObj: any = {};
              entryObj.uid = uid;
              // Always set title/url from the Sitecore meta block so entries
              // get created even when the content type has no mappable user
              // fields (e.g. system-only `__` fields). These don't depend on
              // fieldMapping at all.
              entryObj.title = entry?.meta?.name;
              // Only build a url when a key is present, otherwise we'd emit
              // a meaningless "/undefined".
              if (entry?.meta?.key) {
                entryObj.url = `/${entry?.meta?.key}`;
              }
              for await (const field of entry?.fields?.field ?? []) {
                for await (const fsc of ctType?.fieldMapping ?? []) {
                  if (
                    fsc?.contentstackFieldType !== 'group' &&
                    // Modular block children are written by their parent block field, so
                    // skip them here. Without this a child like
                    // `redirect to item.folder.path` would flatten to `path` and could
                    // match an unrelated Sitecore field of that name.
                    fsc?.contentstackFieldType !== 'modular_blocks_child' &&
                    // Leaf rows inside a block (`<field>.<block>.<leaf>`) are likewise
                    // the parent's responsibility.
                    `${fsc?.uid ?? ''}`.split('.').length < 3 &&
                    !isSkippableSystemField(field?.$?.key)
                  ) {
                    if (flattenFieldName(fsc?.uid) === field?.$?.key) {
                      const content: any = await entriesFieldCreator({
                        field: fsc,
                        content: field?.content,
                        idCorrector,
                        allAssetJSON,
                        contentTypes,
                        entriesData,
                        locale,
                        // A union block's branches are sibling rows in the flat mapping,
                        // so the writer needs the full list to know which branches exist.
                        siblingFields: ctType?.fieldMapping,
                      });
                      const gpData: any = ctType?.fieldMapping?.find(
                        (elemant: any) =>
                          elemant?.uid === fsc?.uid?.split('.')?.[0]
                      );
                      if (gpData?.uid) {
                        const ctUid = uidCorrector({ uid: gpData?.uid });
                        if (
                          ctUid !== gpData?.contentstackFieldUid &&
                          fsc?.contentstackFieldUid?.includes(ctUid)
                        ) {
                          if (fsc?.contentstackFieldUid?.includes('_changed') && gpData?.contentstackFieldUid?.includes('_changed')) {
                            const newUid: any =
                            fsc?.contentstackFieldUid?.replace(
                              ctUid + '_changed',
                              gpData?.contentstackFieldUid
                            );
                            entryObj[newUid] = content;
                          }
                          else{
                            const newUid: any =
                            fsc?.contentstackFieldUid?.replace( 
                              ctUid, 
                              gpData?.contentstackFieldUid 
                            );
                            entryObj[newUid] = content;
                          }
                        } else {
                          entryObj[fsc?.contentstackFieldUid] = content;
                        }
                      } else {
                        entryObj[fsc?.contentstackFieldUid] = content;
                      }
                    }
                  }
                }
                // Fallback for inherited fields: they live inside a global field and aren't in
                // this content type's top-level fieldMapping, so the loop above never matches
                // them. Route the flat Sitecore value to its nested global-field path so
                // unflatten() rebuilds the correct depth (e.g. metatitle ->
                // blh_page_base.page_metadata.metadata_details.metatitle).
                if (!isSkippableSystemField(field?.$?.key)) {
                  const leaf =
                    globalFieldPathMap?.[normalizeSitecoreKey(field?.$?.key)];
                  if (leaf?.path && !(leaf.path in entryObj)) {
                    const content: any = await entriesFieldCreator({
                      field: { contentstackFieldType: dataTypeToFieldType(leaf?.dataType) },
                      content: field?.content,
                      idCorrector,
                      allAssetJSON,
                      contentTypes,
                      entriesData,
                      locale,
                    });
                    entryObj[leaf.path] = content;
                  }
                }
              }
              // Layout composition. Handled outside the field loop above because
              // `__renderings` is filtered by isSkippableSystemField before it can ever
              // match a mapping row — see rendering-composer.utils.ts.
              if (componentsField?.contentstackFieldUid) {
                // xml2js runs with `explicitArray: false`, so an item holding a single
                // field yields an object rather than a one-element array.
                const rawFields = entry?.fields?.field;
                const fieldList = Array.isArray(rawFields)
                  ? rawFields
                  : rawFields
                    ? [rawFields]
                    : [];
                const layoutField = fieldList.find(
                  (f: any) => f?.$?.key === '__renderings'
                );
                if (layoutField?.content) {
                  const components = composeComponents({
                    layoutContent: layoutField?.content,
                    fieldMapping: ctType?.fieldMapping,
                    componentsUid: componentsField?.contentstackFieldUid,
                    entriesData,
                    locale,
                    idCorrector,
                    uidCorrector,
                    childIndex,
                  });
                  if (components?.length) {
                    entryObj[componentsField.contentstackFieldUid] = components;
                  }
                }
              }
              entryObj.publish_details = [];
              if (entryObj?.title) {
                if (Object.keys?.(entryObj)?.length > 1) {
                  entryLocale[uid] = unflatten(entryObj) ?? {};
                  const message = getLogMessage(
                    srcFunc,
                    `Entry title "${entryObj?.title}"(${
                      keyMapper?.[ctType?.contentstackUid] ??
                      ctType?.contentstackUid
                    }) in the ${newLocale} locale has been successfully transformed.`,
                    {}
                  );
                  await customLogger(
                    projectId,
                    destinationStackId,
                    'info',
                    message
                  );
                }
              }
            }
            )
          );
          const mapperCt: string =
            keyMapper?.[ctType?.contentstackUid] !== '' &&
            keyMapper?.[ctType?.contentstackUid] !== undefined
              ? keyMapper?.[ctType?.contentstackUid]
              : ctType?.contentstackUid;
          const fileMeta = { '1': `${newLocale}.json` };
          const entryPath = path.join(
            process.cwd(),
            entrySave,
            mapperCt,
            newLocale
          );
          await writeFiles(entryPath, fileMeta, entryLocale, newLocale);
        }
      } else {
        const message = getLogMessage(
          srcFunc,
          `No entries found for the content type ${
            keyMapper?.[ctType?.contentstackUid] ?? ctType?.contentstackUid
          }.`,
          {}
        );
        await customLogger(projectId, destinationStackId, 'error', message);
      }
    }
    return true;
  } catch (err) {
    console.error('🚀 ~ createEntry ~ err:', err);
  }
};

const createLocale = async (
  req: any,
  destinationStackId: string,
  projectId: string,
  project: any
) => {
  const srcFunc = 'createLocale';
  try {
    const baseDir = path.join(baseDirName, destinationStackId);
    const localeSave = path.join(baseDir, LOCALE_DIR_NAME);
    const allLocalesResp = await orgService.getLocales(req);
    const masterLocale = Object?.keys?.(
      project?.master_locale ?? LOCALE_MAPPER?.masterLocale
    )?.[0];

    const msLocale: any = {};
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

    const localesObject = project?.locales ?? LOCALE_MAPPER;

    const allLocales: any = {};
    for (const [key, value] of Object.entries(localesObject)) {
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
      } else {
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

const createEnvironment = async (destinationStackId: string) => {
  const baseDir = path.join(baseDirName, destinationStackId);
  const environmentSave = path.join(baseDir, ENVIRONMENTS_DIR_NAME);
  const environmentFile = path.join(environmentSave, ENVIRONMENTS_FILE_NAME);

  // Ensure the directory exists
  await fs.promises.mkdir(environmentSave, { recursive: true });

  // Write an empty environments file (or replace {} with your actual data)
  await fs.promises.writeFile(environmentFile, JSON.stringify({}), 'utf8');
};

export const siteCoreService = {
  createEntry,
  createAssets,
  createLocale,
  createVersionFile,
  createEnvironment,
};
