import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import path from "path";
import fs from 'node:fs';
import { DATABASE_FILES } from "../constants/index.js";

/**
 * Represents an asset mapper object. Rows exist only for assets whose source
 * uid is stable across export runs; isUpdate=true means "update the existing
 * Contentstack asset in place (same UID, new file)" on a delta iteration,
 * isUpdate=false means "keep/reuse the existing asset as-is".
 */
export interface AssetMapper {
  asset_mapper: {
    id: string;
    projectId: string;
    otherCmsAssetUid: string;
    filename: string;
    title: string;
    file_size: number | string;
    assetPath: string;
    isUpdate: boolean;
    contentstackAssetUid: string;
    isChanged: boolean;
  }[];
}

const defaultData: AssetMapper = { asset_mapper: [] };

/**
 * Creates and returns a database instance for the asset mapper for a specific
 * project and iteration.
 * @param projectId - The unique identifier of the project
 * @param iteration - The migration iteration the mapping belongs to
 * @returns The database instance for the asset mapper
 */
const getAssetMapperDb = (projectId: string, iteration: number) => {
  fs.mkdirSync(path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId, iteration.toString()), { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<AssetMapper>(
      path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId, iteration.toString(), DATABASE_FILES.ASSET_MAPPER)
    ),
    defaultData
  );
  return db;
};

export default getAssetMapperDb;
