import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { v4 as uuidv4 } from "uuid";
import _ from 'lodash';
import { LOCALE_MAPPER } from '../constants/index.js';
import { entriesFieldCreator, unflatten } from '../utils/entries-field-creator.utils.js';
import { orgService } from './org.service.js';
const assetsSave = path.join('sitecoreMigrationData', 'assets');
const entrySave = path.join('sitecoreMigrationData', 'entries');
const localeSave = path.join('sitecoreMigrationData', 'locale');
const append = "a";

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
  const lastKey = keys[keys.length - 1];
  return lastKey;
}

const AssetsPathSpliter = ({ path, id }: any) => {
  let newPath = path?.split(id)?.[0]
  if (newPath?.includes("media library/")) {
    newPath = newPath?.split("media library/")?.[1]
  }
  return newPath;
}

// const getFolderName = ({ assetPath }: any) => {
//   const name = assetPath?.split("/")
//   if (name?.length) {
//     return name[name?.length - 2]
//   }
// }

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

const cretaeAssets = async ({ packagePath }: any) => {
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
          }
        } else {
          console.info("asstes id not found.")
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
        allAssetJSON[mestaData?.uid].parent_uid = '2146b0cee522cc3a38d'
      }
    }
  }
  const fileMeta = { "1": "index.json" };
  fs.writeFileSync(
    path.join(
      process.cwd(),
      assetsSave,
      'assets.json'
    ),
    JSON.stringify(fileMeta)
  );
  fs.writeFileSync(
    path.join(
      process.cwd(),
      assetsSave,
      'index.json'
    ),
    JSON.stringify(allAssetJSON)
  );
  return allAssetJSON;
}

const createEntry = async ({ packagePath, contentTypes, master_locale = 'en-us' }: { packagePath: any; contentTypes: any; master_locale?: string }) => {
  try {
    const allAssetJSON: any = await cretaeAssets({ packagePath });
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
      const entryPresent: any = entriesData?.find((item: any) => uidCorrector({ uid: item?.template }) === ctType?.contentstackUid)
      if (entryPresent) {
        const locales: any = Object?.keys(entryPresent?.locale);
        for await (const locale of locales) {
          let newLocale = locale;
          const entryLocale: any = {};
          if (typeof LOCALE_MAPPER?.masterLocale === 'object' && LOCALE_MAPPER?.masterLocale !== null && LOCALE_MAPPER?.masterLocale?.[master_locale] === locale) {
            newLocale = Object?.keys(LOCALE_MAPPER?.masterLocale)?.[0];
            Object.entries(entryPresent?.locale?.[locale] || {}).forEach(async ([uid, entry]: any) => {
              const entryObj: any = {};
              entryObj.uid = uid;
              for await (const field of entry?.fields?.field ?? []) {
                for await (const fsc of ctType?.fieldMapping ?? []) {
                  if (fsc?.ContentstackFieldType !== 'group' && !field?.$?.key?.includes('__')) {
                    if (fsc?.contentstackFieldUid === 'title') {
                      entryObj[fsc?.contentstackFieldUid] = entry?.meta?.name;
                    }
                    if (fsc?.contentstackFieldUid === 'url') {
                      entryObj[fsc?.contentstackFieldUid] = `/${entry?.meta?.key}`;
                    }
                    if (getLastKey(fsc?.uid) === field?.$?.key) {
                      const content: any = await entriesFieldCreator({ field: fsc, content: field?.content, idCorrector, allAssetJSON })
                      entryObj[fsc?.contentstackFieldUid] = content;
                    }
                  }
                }
              }
              entryLocale[uid] = unflatten(entryObj) ?? {};
            });
          }
          const fileMeta = { "1": `${locale}.json` };
          const entryPath = path.join(
            process.cwd(),
            entrySave,
            ctType?.contentstackUid,
            newLocale
          );
          await writeFiles(entryPath, fileMeta, entryLocale, locale)
        }
      } else {
        console.info('Entries missing for', ctType?.contentstackUid)
      }
    }
  } catch (err) {
    console.error("🚀 ~ createEntry ~ err:", err)
  }
}

const createLocale = async (req: any) => {
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
    }
  }
  const masterPath = path.join(localeSave, 'master-locale.json');
  const allLocalePath = path.join(localeSave, 'locales.json');
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
}

export const siteCoreService = {
  createEntry,
  cretaeAssets,
  createLocale
};