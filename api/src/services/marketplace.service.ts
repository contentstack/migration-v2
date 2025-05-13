import path from 'path';
import fs from 'fs';
import getAuthtoken from "../utils/auth.utils.js";
import { MIGRATION_DATA_CONFIG, KEYTOREMOVE } from '../constants/index.js';
import { getAppManifestAndAppConfig } from '../utils/market-app.utils.js';
import { v4 as uuidv4 } from "uuid";


const {
  EXTENSIONS_MAPPER_DIR_NAME,
  MARKETPLACE_APPS_DIR_NAME,
  MARKETPLACE_APPS_FILE_NAME
} = MIGRATION_DATA_CONFIG;


const groupByAppUid = (data: any) => {
  return data?.reduce?.((acc: any, item: any) => {
    if (!acc[item.appUid]) {
      acc[item.appUid] = [];
    }
    acc[item.appUid].push(item.extensionUid);
    return acc;
  }, {});
}
const removeKeys = (obj: any, keysToRemove: any) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keysToRemove.includes(key))
  );
}

const writeManifestFile = async ({ destinationStackId, appManifest }: any) => {
  const dirPath = path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, destinationStackId, MARKETPLACE_APPS_DIR_NAME);
  try {
    await fs.promises.access(dirPath);
  } catch (err) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (mkdirErr) {
      console.error("🚀 ~ fs.mkdir ~ err:", mkdirErr);
      return;
    }
  }
  try {
    const filePath = path.join(dirPath, MARKETPLACE_APPS_FILE_NAME);
    await fs.promises.writeFile(filePath, JSON.stringify(appManifest, null, 2));
  } catch (writeErr) {
    console.error("🚀 ~ fs.writeFile ~ err:", writeErr);
  }
}



const createAppManifest = async ({ destinationStackId, region, userId, orgId }: any) => {
  const authtoken = await getAuthtoken(region, userId);
  const marketPlacePath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, EXTENSIONS_MAPPER_DIR_NAME);
  const AppMapper: any = await fs.promises.readFile(marketPlacePath, "utf-8").catch(async () => { });
  if (AppMapper !== undefined) {
    const appManifest: any = [];
    const groupUids: any = groupByAppUid(JSON.parse(AppMapper));
    for await (const [key, value] of Object?.entries?.(groupUids) || {}) {
      const data: any = await getAppManifestAndAppConfig({ organizationUid: orgId, authtoken, region, manifestUid: key });
      data.manifest = removeKeys(data, KEYTOREMOVE);
      const extensionUids: any = new Set(value) ?? [];
      const locations: any = [];
      for (const ext of extensionUids ?? []) {
        const seprateUid = ext?.split?.('-');
        const type: string = seprateUid?.[1];
        const extUid: string = seprateUid?.[0];
        for (const loc of data?.ui_location?.locations ?? []) {
          if (loc?.type === type) {
            const isPresent = locations?.meta?.findIndex((item: any) => item?.extension_uid === extUid);
            if (isPresent === undefined) {
              locations?.push({
                type,
                meta: [{ ...(loc?.meta?.[0] || {}), extension_uid: extUid }]
              })
            }
          }
        }
      }
      const configData = data?.ui_location?.locations?.find((ele: any) => ele?.type === 'cs.cm.stack.config');
      if (configData) {
        locations?.push({
          type: configData?.type,
          meta: [{ ...(configData?.meta?.[0] || {}), name: 'Config', extension_uid: uuidv4() }]
        })
      }
      data.ui_location.locations = locations;
      data.status = "installed";
      data.target = {
        "type": "stack",
        "uid": destinationStackId
      };
      data.installation_uid = data?.uid;
      data.configuration = "";
      data.server_configuration = "";
      appManifest?.push(removeKeys(data, KEYTOREMOVE));
    }
    await writeManifestFile({ destinationStackId, appManifest });
  }
}

export const marketPlaceAppService = {
  createAppManifest
}