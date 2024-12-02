import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { v4 as uuidv4 } from "uuid";
import _ from 'lodash';
import { LOCALE_MAPPER, MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { entriesFieldCreator, unflatten } from '../utils/entries-field-creator.utils.js';
import { orgService } from './org.service.js';
import { getLogMessage } from '../utils/index.js';
import customLogger from '../utils/custom-logger.utils.js';


const append = "a";

const baseDirName = MIGRATION_DATA_CONFIG.DATA
const {
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE
} = MIGRATION_DATA_CONFIG;

const idCorrector = ({ id }: any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) => match === '-' ? '' : '')
  if (newId) {
    return newId?.toLowerCase()
  } else {
    return id
  }
}

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

function getLastKey(path: string) {
  const keys = path?.split?.('.');
  const lastKey = keys?.[keys?.length - 1];
  return lastKey;
}

const AssetsPathSpliter = ({ path, id }: any) => {
  let newPath = path?.split(id)?.[0]
  if (newPath?.includes("media library/")) {
    newPath = newPath?.split("media library/")?.[1]
  }
  return newPath;
}



async function writeOneFile(indexPath: string, fileMeta: any) {
  fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
    if (err) {
      console.error('Error writing file: 3', err);
    }
  });
}

async function writeFiles(entryPath: string, fileMeta: any, entryLocale: any, locale: string) {
  try {
    const indexPath = path.join(entryPath, 'index.json');
    const localePath = path.join(entryPath, `${locale}.json`);
    fs.access(entryPath, async (err) => {
      if (err) {
        fs.mkdir(entryPath, { recursive: true }, async (err) => {
          if (err) {
            console.error('Error writing file: 2', err);
          } else {
            await writeOneFile(indexPath, fileMeta)
            await writeOneFile(localePath, entryLocale)
          }
        });
      } else {
        await writeOneFile(indexPath, fileMeta)
        await writeOneFile(localePath, entryLocale)
      }
    });
  } catch (error) {
    console.error('Error writing files:', error);
  }
}

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()}`
  }
  return _.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()
}

const cretaeAssets = async ({ packagePath, baseDir, destinationStackId, projectId }: any) => {
  const srcFunc = 'cretaeAssets';
  const assetsSave = path.join(baseDir, ASSETS_DIR_NAME);
  const allAssetJSON: any = {};
  const folderName: any = path.join(packagePath, 'items', 'master', 'sitecore', 'media library');
  const entryPath = read?.(folderName);
  for await (const file of entryPath) {
    if (file?.endsWith('data.json')) {
      const data: any = await fs.promises.readFile(path.join(folderName, file), 'utf8');
      const jsonAsset = JSON.parse(data);
      const assetPath = AssetsPathSpliter({ path: file, id: jsonAsset?.item?.$?.id });
      // const folder = getFolderName({ assetPath });
      const mestaData: any = {};
      mestaData.uid = idCorrector({ id: jsonAsset?.item?.$?.id });
      jsonAsset?.item?.fields?.field?.forEach?.((field: any) => {
        if (field?.$?.key === "blob" && field?.$?.type === "attachment") {
          mestaData.id = field?.content?.replace(/[{}]/g, "")?.toLowerCase();
        }
        if (field?.$?.key === "extension") {
          mestaData.extension = field?.content;
        }
        if (field?.$?.key === "mime type") {
          mestaData.content_type = field?.content;
        }
        if (field?.$?.key === "size") {
          mestaData.size = field?.content;
        }
      })
      const blobPath: any = path.join(packagePath, 'blob', 'master');
      const assetsPath = read(blobPath);
      if (assetsPath?.length) {
        const isIdPresent = assetsPath?.find((ast) => ast?.includes(mestaData?.id));
        if (isIdPresent) {
          try {
            const assets = fs.readFileSync(path.join(blobPath, isIdPresent));
            fs.mkdirSync(path.join(assetsSave, 'files', mestaData?.uid), { recursive: true });
            fs.writeFileSync(
              path.join(
                process.cwd(),
                assetsSave, 'files', mestaData?.uid,
                `${jsonAsset?.item?.$?.name}.${mestaData?.extension}`
              )
              , assets)
          } catch (err) {
            console.error("🚀 ~ file: assets.js:52 ~ xml_folder?.forEach ~ err:", err)
            const message = getLogMessage(
              srcFunc,
              `Not able to read the asset"${jsonAsset?.item?.$?.name}(${mestaData?.uid})".`,
              {},
              err
            )
            await customLogger(projectId, destinationStackId, 'error', message);
          }
          allAssetJSON[mestaData?.uid] = {
            urlPath: `/assets/${mestaData?.uid}`,
            uid: mestaData?.uid,
            content_type: mestaData?.content_type,
            file_size: mestaData.size,
            tags: [],
            filename: `${jsonAsset?.item?.$?.name}.${mestaData?.extension}`,
            is_dir: false,
            parent_uid: null,
            title: jsonAsset?.item?.$?.name,
            publish_details: [],
            assetPath
          }
          const message = getLogMessage(
            srcFunc,
            `Asset "${jsonAsset?.item?.$?.name}" has been successfully transformed.`,
            {}
          )
          await customLogger(projectId, destinationStackId, 'info', message);
          allAssetJSON[mestaData?.uid].parent_uid = '2146b0cee522cc3a38d'
        } else {
          const message = getLogMessage(
            srcFunc,
            `Asset "${jsonAsset?.item?.$?.name}" blob is not there for this asstes.`,
            {}
          )
          await customLogger(projectId, destinationStackId, 'error', message);
        }
      }
    }
  }
  const fileMeta = { "1": ASSETS_SCHEMA_FILE };
  fs.writeFileSync(
    path.join(
      process.cwd(),
      assetsSave,
      ASSETS_FILE_NAME
    ),
    JSON.stringify(fileMeta)
  );
  fs.writeFileSync(
    path.join(
      process.cwd(),
      assetsSave,
      ASSETS_SCHEMA_FILE
    ),
    JSON.stringify(allAssetJSON)
  );
  return allAssetJSON;
}

const createEntry = async ({ packagePath, contentTypes, master_locale = 'en-us', destinationStackId, projectId }: { packagePath: any; contentTypes: any; master_locale?: string, destinationStackId: string, projectId: string }) => {
  try {
    const srcFunc = 'createEntry';
    const baseDir = path.join(baseDirName, destinationStackId);
    const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
    const allAssetJSON: any = await cretaeAssets({ packagePath, baseDir, destinationStackId, projectId });
    const folderName: any = path.join(packagePath, 'items', 'master', 'sitecore', 'content');
    const entriesData: any = [];
    if (fs.existsSync(folderName)) {
      const entryPath = read?.(folderName);
      for await (const file of entryPath) {
        if (file?.endsWith('data.json')) {
          const data = await fs.promises.readFile(path.join(folderName, file), 'utf8');
          const jsonData = JSON.parse(data);
          const { language, template } = jsonData?.item?.$ ?? {};
          const id = idCorrector({ id: jsonData?.item?.$?.id });
          const entries: any = {};
          entries[id] = { meta: jsonData?.item?.$, fields: jsonData?.item?.fields };
          const templateIndex = entriesData?.findIndex((ele: any) => ele?.template === template);
          if (templateIndex >= 0) {
            const entry = entriesData?.[templateIndex]?.locale?.[language];
            entry[id] = { meta: jsonData?.item?.$, fields: jsonData?.item?.fields };
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
        `Transforming entries of Content Type ${ctType?.contentstackUid} has begun.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      const entryPresent: any = entriesData?.find((item: any) => uidCorrector({ uid: item?.template }) === ctType?.contentstackUid)
      if (entryPresent) {
        const locales: any = Object?.keys(entryPresent?.locale);
        for await (const locale of locales) {
          let newLocale = locale;
          const entryLocale: any = {};
          if (typeof LOCALE_MAPPER?.masterLocale === 'object' && LOCALE_MAPPER?.masterLocale !== null && LOCALE_MAPPER?.masterLocale?.[master_locale] === locale) {
            newLocale = Object?.keys(LOCALE_MAPPER?.masterLocale)?.[0];
            Object.entries(entryPresent?.locale?.[locale] || {}).map(async ([uid, entry]: any) => {
              const entryObj: any = {};
              entryObj.uid = uid;
              for await (const field of entry?.fields?.field ?? []) {
                for await (const fsc of ctType?.fieldMapping ?? []) {
                  if (fsc?.contentstackFieldType !== 'group' && !field?.$?.key?.includes('__')) {
                    if (fsc?.contentstackFieldUid === 'title') {
                      entryObj[fsc?.contentstackFieldUid] = entry?.meta?.name;
                    }
                    if (fsc?.contentstackFieldUid === 'url') {
                      entryObj[fsc?.contentstackFieldUid] = `/${entry?.meta?.key}`;
                    }
                    if (getLastKey(fsc?.uid) === field?.$?.key) {
                      const content: any = await entriesFieldCreator({ field: fsc, content: field?.content, idCorrector, allAssetJSON, contentTypes, entriesData, locale })
                      entryObj[fsc?.contentstackFieldUid] = content;
                    }
                  }
                }
              }
              if (Object.keys?.(entryObj)?.length > 1) {
                entryLocale[uid] = unflatten(entryObj) ?? {};
                const message = getLogMessage(
                  srcFunc,
                  `Entry title "${entryObj?.title}"(${ctType?.contentstackUid}) in the ${newLocale} locale has been successfully transformed.`,
                  {}
                )
                await customLogger(projectId, destinationStackId, 'info', message)
              }
            });
          }
          const fileMeta = { "1": `${newLocale}.json` };
          const entryPath = path.join(
            process.cwd(),
            entrySave,
            ctType?.contentstackUid,
            newLocale
          );
          await writeFiles(entryPath, fileMeta, entryLocale, newLocale)
        }
      } else {
        const message = getLogMessage(
          srcFunc,
          `No entries found for the content type ${ctType?.contentstackUid}.`,
          {}
        )
        await customLogger(projectId, destinationStackId, 'error', message)
        console.info('Entries missing for', ctType?.contentstackUid)
      }
    }
    return true;
  } catch (err) {
    console.error("🚀 ~ createEntry ~ err:", err)
  }
}

const createLocale = async (req: any, destinationStackId: string, projectId: string) => {
  const srcFunc = 'createLocale';
  try {
    const baseDir = path.join(baseDirName, destinationStackId);
    const localeSave = path.join(baseDir, LOCALE_DIR_NAME);
    const allLocalesResp = await orgService.getLocales(req)
    const masterLocale = Object?.keys?.(LOCALE_MAPPER?.masterLocale)?.[0];
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
    for (const [key, value] of Object.entries(LOCALE_MAPPER)) {
      const localeUid = uuidv4();
      if (key !== 'masterLocale' && typeof value === 'string') {
        allLocales[localeUid] = {
          "code": value,
          "fallback_locale": masterLocale,
          "uid": localeUid,
          "name": allLocalesResp?.data?.locales?.[value] ?? ''
        }
        const message = getLogMessage(
          srcFunc,
          `locale ${value} has been successfully transformed.`,
          {}
        )
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

const createVersionFile = async (destinationStackId: string) => {
  const baseDir = path.join(baseDirName, destinationStackId);
  fs.writeFile(path?.join?.(baseDir, EXPORT_INFO_FILE), JSON.stringify({
    "contentVersion": 2,
    "logsPath": ""
  }), (err) => {
    if (err) {
      console.error('Error writing file: 3', err);
    }
  });
}

export const siteCoreService = {
  createEntry,
  cretaeAssets,
  createLocale,
  createVersionFile
};