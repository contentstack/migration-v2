import path from 'path';
import fs from 'fs';
import read from 'fs-readdir-recursive';
import _ from 'lodash';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';

const {
  ENTRIES_DIR_NAME,
  ASSETS_DIR_NAME,
  ASSETS_SCHEMA_FILE,
  CONTENT_TYPES_SCHEMA_FILE,
  ENTRIES_MASTER_FILE,
  GLOBAL_FIELDS_DIR_NAME,
  GLOBAL_FIELDS_FILE_NAME
} = MIGRATION_DATA_CONFIG;


async function writeOneFile(indexPath: string, fileMeta: any) {
  fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
    if (err) {
      console.error('Error writing file: 3', err);
    }
  });
}

async function writeFiles(entryPath: string, fileMeta: any, entryLocale: any, locale: string) {
  try {
    const indexPath = path.join(entryPath, ENTRIES_MASTER_FILE);
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

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid }: any) => {
  if (startsWithNumber(uid)) {
    return `a_${_.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()}`
  }
  return _.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()
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


async function cleanDirectory(folderPath: string, foldersToKeep: any[]): Promise<void> {
  try {
    // Ensure we're only working with the first 10 folders to keep
    const foldersToKeepLimited = foldersToKeep.map((item: any) => item?.uid);

    // Read all items (files and folders) in the directory
    const itemsInDirectory = await fs.promises.readdir(folderPath, { withFileTypes: true });

    // Loop through all items in the directory
    for (const item of itemsInDirectory) {
      const itemPath = path.join(folderPath, item?.name);

      // Check if the item is a directory and if it's not in the list of folders to keep
      if (item?.isDirectory() && !foldersToKeepLimited?.includes(item?.name)) {
        // Delete the folder and its contents
        await fs.promises.rm(itemPath, { recursive: true, force: true });
        console.info(`Deleted folder: ${item.name}`);
      }
    }
    console.info("Cleanup completed!");
  } catch (err) {
    console.error(`Error while cleaning directory: ${(err as Error).message}`);
  }
}


async function deleteFolderAsync(folderPath: string): Promise<void> {
  try {
    await fs.promises.rm(folderPath, { recursive: true, force: true });
    console.info(`Folder ${folderPath} deleted successfully.`);
  } catch (err) {
    console.error(`Error while deleting folder: ${(err as Error).message}`);
  }
}

const lookForReference = async (
  field: any,
  finalData: any,
) => {
  for (const child of field?.schema ?? []) {
    switch (child?.data_type) {
      case 'reference':
      case 'global_field':
      case 'blocks': {
        break;
      }
      case 'json': {
        if (child?.field_metadata?.allow_json_rte) {
          const ctSelected = finalData?.map((item: any) => item?.contentType);
          const refs: any = ["sys_assets"];
          child?.reference_to?.forEach((item: any) => {
            const correctUid = uidCorrector({ uid: item });
            if (ctSelected?.includes(correctUid)) {
              refs?.push(item);
            }
          })
          if (refs?.length === 0) {
            child.field_metadata.embed_entry = false;
          }
          child.reference_to = refs;
        }
        break;
      }
      case 'group': {
        lookForReference(child, finalData);
        break;
      }
      case 'text': {
        if (child?.field_metadata?.allow_rich_text) {
          const ctSelected = finalData?.map((item: any) => item?.contentType);
          const refs: any = [];
          child?.reference_to?.forEach((item: any) => {
            const correctUid = uidCorrector({ uid: item });
            if (ctSelected?.includes(correctUid)) {
              refs?.push(item);
            }
          })
          if (refs?.length === 0) {
            if (child?.field_metadata) {
              delete child.field_metadata.embed_entry;
              delete child.field_metadata.ref_multiple_content_types;
            }
            if (child?.reference_to) {
              delete child.reference_to;
            }
          } else {
            child.reference_to = refs
          }
          break;
        }
      }
    }
  }
}



const sortAssets = async (baseDir: string) => {
  const assetsPath = path.join(process.cwd(), baseDir, ASSETS_DIR_NAME);
  try {
    await fs.promises.access(assetsPath);
    const assetsFilesPath = path.join(assetsPath, 'files');
    const assetsJson = JSON.parse(await fs.promises.readFile(path.join(assetsPath, ASSETS_SCHEMA_FILE), 'utf8') ?? {});
    const sortAsset = Object?.values?.(assetsJson)?.slice(0, 10);
    const assetsMeta: any = {};
    sortAsset?.forEach((item: any) => {
      assetsMeta[item?.uid] = item;
    })
    await cleanDirectory(assetsFilesPath, sortAsset);
    await fs.promises.writeFile(path.join(assetsPath, ASSETS_SCHEMA_FILE), JSON?.stringify?.(assetsMeta));
  } catch (err) {
    console.error('assest not exits on Path:', assetsPath);
  }
}

const writeGlobalField = async (schema: any, globalSave: string, filePath: string) => {
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
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(schema, null, 2));
  } catch (writeErr) {
    console.error("🚀 ~ fs.writeFile ~ err:", writeErr);
  }
};

const sortGlobalField = async (baseDir: string, finalData: any) => {
  const globalSave = path.join(process.cwd(), baseDir, GLOBAL_FIELDS_DIR_NAME);
  const globalPath = path.join(globalSave, GLOBAL_FIELDS_FILE_NAME);
  if (fs.existsSync(globalPath)) {
    const globalData = await JSON.parse(await fs.promises.readFile(globalPath, 'utf8'));
    const globalResult = [];
    for await (const ct of globalData) {
      await lookForReference(ct, finalData);
      globalResult?.push(ct);
    }
    await writeGlobalField(globalResult, globalPath, globalPath);
  }
}

//this code can be used in feature

// const sortContentType = async (baseDir: string, finalData: any) => {
//   const contentTypePath: string = path.join(process.cwd(), baseDir, CONTENT_TYPES_DIR_NAME);
//   const contentSave = path.join(baseDir, CONTENT_TYPES_DIR_NAME);
//   const ctData = await JSON.parse(await fs.promises.readFile(path.join(contentTypePath, CONTENT_TYPES_SCHEMA_FILE), 'utf8'));
//   await sortGlobalField(baseDir, finalData);
//   const contentTypes: any = [];
//   for await (const ct of finalData) {
//     const findCtData = ctData?.find((ele: any) => ele?.uid === ct?.contentType);
//     await lookForReference(findCtData, finalData);
//     contentTypes?.push(findCtData);
//   }
//   await deleteFolderAsync(contentTypePath);
//   for await (const ctItem of contentTypes) {
//     await saveContent(ctItem, contentSave);
//   }
// }



export const testFolderCreator = async ({ destinationStackId }: any) => {
  const sanitizedStackId = path.basename(destinationStackId);
  const baseDir = path.join(MIGRATION_DATA_CONFIG.DATA, sanitizedStackId);
  const entryDelete = path.join(process.cwd(), baseDir, ENTRIES_DIR_NAME);
  const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
  const entriesPath = path.join(process.cwd(), baseDir, ENTRIES_DIR_NAME);
  const allData = [];
  for await (const filePath of read(entriesPath)) {
    if (!filePath?.endsWith('index.json')) {
      const entryData = await JSON?.parse?.(await fs?.promises?.readFile?.(path?.join?.(entriesPath, filePath), 'utf8'));
      if (Object?.keys?.(entryData)?.length) {
        const normalizedPath = path.normalize(filePath);
        // Split using `path.sep` for cross-platform support
        const pathParts = normalizedPath.split(path.sep);
        const ct = pathParts?.[0]; // First directory
        const locale = pathParts?.[1]; // Second directory
        allData?.push({ contentType: ct, count: Object?.keys?.(entryData)?.length ?? 0, entryData, filePath, locale })
      }
    }
  }
  // const sortData = allData?.length > 3 ? allData.sort((a, b) => b?.count - a?.count).slice?.(0, 3) : allData;
  const sortData = allData;
  const finalData: any = [];
  sortData.forEach((et: any) => {
    const entryObj: any = {};
    // const ctData = et?.count > 4 ? Object?.values?.(et?.entryData)?.splice?.(0, 5) : Object?.values?.(et?.entryData);
    const ctData = Object?.values?.(et?.entryData)?.splice?.(0, 1);
    ctData?.forEach?.((entItem: any) => {
      entryObj[entItem?.uid] = entItem;
    })
    finalData?.push({ contentType: et?.contentType, entryObj, locale: et?.locale });
  });
  await sortAssets(baseDir);
  // await sortContentType(baseDir, finalData);
  await deleteFolderAsync(entryDelete);
  for await (const entry of finalData) {
    const fileMeta = { "1": `${entry?.locale}.json` };
    const entryPath = path.join(
      process.cwd(),
      entrySave,
      entry?.contentType,
      entry?.locale
    );
    await writeFiles(entryPath, fileMeta, entry?.entryObj, entry?.locale);
  }
}