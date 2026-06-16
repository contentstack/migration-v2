import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import path from "path";
import fs from 'node:fs';
import { DATABASE_FILES } from "../constants/index.js";
import { sanitizeProjectId } from "../utils/sanitize-path.utils.js";

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
  // projectId is HTTP-derived in several routes; validate it via an allowlist
  // before using it as a path segment to prevent path traversal (CWE-23).
  // sanitizeProjectId returns null for unsafe input (e.g. containing "..", "/").
  const safeProjectId = sanitizeProjectId(projectId);
  if (safeProjectId === null) {
    throw new Error("Invalid projectId");
  }
  const dir = path.join(
    process.cwd(),
    DATABASE_FILES.DIRECTORY,
    safeProjectId,
    iteration.toString()
  );
  fs.mkdirSync(dir, { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<AssetMapper>(path.join(dir, DATABASE_FILES.ASSET_MAPPER)),
    defaultData
  );
  return db;
};

export default getAssetMapperDb;
