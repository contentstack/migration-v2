import path from 'path';
import fs from 'fs';
import read from 'fs-readdir-recursive';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';

const { 
  ENTRIES_DIR_NAME,
  ASSETS_DIR_NAME,
  ASSETS_SCHEMA_FILE,
  CONTENT_TYPES_DIR_NAME,
  CONTENT_TYPES_SCHEMA_FILE,
  ENTRIES_MASTER_FILE
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



const sortAssets = async (baseDir: string) => {
  const assetsPath = path.join(process.cwd(), baseDir, ASSETS_DIR_NAME);
  const assetsFilesPath = path.join(assetsPath, 'files');
  const assetsJson = JSON.parse(await fs.promises.readFile(path.join(assetsPath, ASSETS_SCHEMA_FILE), 'utf8'));
  const sortAsset = Object?.values?.(assetsJson)?.slice(0, 10);
  const assetsMeta: any = {};
  sortAsset?.forEach((item: any) => {
    assetsMeta[item?.uid] = item;
  })
  await cleanDirectory(assetsFilesPath, sortAsset);
  await fs.promises.writeFile(path.join(assetsPath, ASSETS_SCHEMA_FILE), JSON?.stringify?.(assetsMeta));
}

const sortContentType = async (baseDir: string, finalData: any) => {
  const contentTypePath: string = path.join(process.cwd(), baseDir, CONTENT_TYPES_DIR_NAME);
  const contentSave = path.join(baseDir, CONTENT_TYPES_DIR_NAME);
  const ctData = await JSON.parse(await fs.promises.readFile(path.join(contentTypePath, CONTENT_TYPES_SCHEMA_FILE), 'utf8'));
  const contentTypes: any = [];
  finalData?.forEach((ct: any) => {
    const findCtData = ctData?.find((ele: any) => ele?.uid === ct?.contentType)
    contentTypes?.push(findCtData);
  })
  await deleteFolderAsync(contentTypePath);
  for await (const ctItem of contentTypes) {
    await saveContent(ctItem, contentSave);
  }
}

export const testFolderCreator = async ({ destinationStackId }: any) => {
  const baseDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);
  const entryDelete = path.join(process.cwd(), baseDir, ENTRIES_DIR_NAME);
  const entrySave = path.join(baseDir, ENTRIES_DIR_NAME);
  const entriesPath = path.join(process.cwd(), baseDir, ENTRIES_DIR_NAME);
  const allData = [];
  for await (const filePath of read(entriesPath)) {
    if (!filePath?.endsWith('index.json')) {
      const entryData = await JSON.parse(await fs.promises.readFile(path.join(entriesPath, filePath), 'utf8'));
      if (Object?.keys?.(entryData)?.length) {
        const ct = filePath?.split?.('/')?.[0];
        const locale = filePath?.split?.('/')?.[1];
        allData?.push({ contentType: ct, count: Object?.keys?.(entryData)?.length, entryData, filePath, locale })
      }
    }
  }
  const sortData = allData.sort((a, b) => b?.count - a?.count)//.slice?.(1, 4);
  const finalData: any = [];
  sortData.forEach((et: any) => {
    const entryObj: any = {};
    const ctData = Object?.values?.(et?.entryData)?.splice?.(0, 5);
    ctData?.forEach((entItem: any) => {
      entryObj[entItem?.uid] = entItem;
    })
    finalData?.push({ contentType: et?.contentType, entryObj, locale: et?.locale });
  });
  await sortAssets(baseDir);
  await sortContentType(baseDir, finalData);
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