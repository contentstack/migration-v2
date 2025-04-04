import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import { LOCALE_MAPPER, MIGRATION_DATA_CONFIG } from '../constants/index.js';
import {
  entriesFieldCreator,
  unflatten,
} from '../utils/entries-field-creator.utils.js';
import { orgService } from './org.service.js';
import { getLogMessage } from '../utils/index.js';
import customLogger from '../utils/custom-logger.utils.js';
import { getSafePath } from '../utils/sanitize-path.utils.js';

const append = 'a';
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

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(
      uid,
      new RegExp('[ -]', 'g'),
      '_'
    )?.toLowerCase()}`;
  }
  return _.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
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
  for await (const file of entryPath) {
    if (file?.endsWith('data.json')) {
      const data: any = await fs.promises.readFile(
        path.join(folderName, file),
        'utf8'
      );
      const jsonAsset = JSON.parse(data);
      const assetPath = AssetsPathSplitter({
        path: file,
        id: jsonAsset?.item?.$?.id,
      });
      // const folder = getFolderName({ assetPath });
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
        const isIdPresent = assetsPath?.find((ast) =>
          ast?.includes(metaData?.id)
        );
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
            parent_uid: null,
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
          allAssetJSON[metaData?.uid].parent_uid = '2146b0cee522cc3a38d';
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
  const fileMeta = { '1': ASSETS_SCHEMA_FILE };
  fs.writeFileSync(
    path.join(process.cwd(), assetsSave, ASSETS_FILE_NAME),
    JSON.stringify(fileMeta)
  );
  fs.writeFileSync(
    path.join(process.cwd(), assetsSave, ASSETS_SCHEMA_FILE),
    JSON.stringify(allAssetJSON)
  );
  return allAssetJSON;
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
    const allAssetJSON: any = await createAssets({
      packagePath,
      baseDir,
      destinationStackId,
      projectId,
    });
    const folderName: any = getSafePath(
      path.join(packagePath, 'items', 'master', 'sitecore', 'content')
    );
    const entriesData: any = [];
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
          Object.entries(entryPresent?.locale?.[locale] || {}).map(
            async ([uid, entry]: any) => {
              const entryObj: any = {};
              entryObj.uid = uid;
              for await (const field of entry?.fields?.field ?? []) {
                for await (const fsc of ctType?.fieldMapping ?? []) {
                  if (
                    fsc?.contentstackFieldType !== 'group' &&
                    !field?.$?.key?.includes('__')
                  ) {
                    if (fsc?.contentstackFieldUid === 'title') {
                      entryObj[fsc?.contentstackFieldUid] = entry?.meta?.name;
                    }
                    if (fsc?.contentstackFieldUid === 'url') {
                      entryObj[
                        fsc?.contentstackFieldUid
                      ] = `/${entry?.meta?.key}`;
                    }
                    if (getLastKey(fsc?.uid) === field?.$?.key) {
                      const content: any = await entriesFieldCreator({
                        field: fsc,
                        content: field?.content,
                        idCorrector,
                        allAssetJSON,
                        contentTypes,
                        entriesData,
                        locale,
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
                          const newUid: any =
                            fsc?.contentstackFieldUid?.replace(
                              ctUid,
                              gpData?.contentstackFieldUid
                            );
                          entryObj[newUid] = content;
                        } else {
                          entryObj[fsc?.contentstackFieldUid] = content;
                        }
                      } else {
                        entryObj[fsc?.contentstackFieldUid] = content;
                      }
                    }
                  }
                }
              }
              entryObj.publish_details = [];
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
        console.info(
          'Entries missing for',
          keyMapper?.[ctType?.contentstackUid] ?? ctType?.contentstackUid
        );
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
    const allLocales: any = {};
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

export const siteCoreService = {
  createEntry,
  createAssets,
  createLocale,
  createVersionFile,
};
