import ProjectModelLowdb from "../models/project-lowdb.js";
import getAssetMapperDb from "../models/assetMapper.js";
import path from "path";
import fs from "node:fs";
import { MIGRATION_DATA_CONFIG, DATABASE_FILES } from "../constants/index.js";

/**
 * Helper function to write log entries to file
 */
const writeLogEntry = (
  message: string,
  methodName: string,
  loggerPath?: string,
) => {
  if (loggerPath) {
    const directLogEntry = {
      level: "info",
      message,
      methodName,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + "\n");
  }
};

interface AssetMetadata {
  filename: string;
  file_size: string;
  url: string;
}

/**
 * A matched asset the user chose to update in place: the existing Contentstack
 * asset (kept at the same `uid`) whose binary should be replaced with the file
 * at `filePath` after the import completes.
 */
export interface AssetUpdate {
  uid: string;
  filePath: string;
  filename: string;
  title: string;
}

/**
 * Traverses an object and replaces any asset reference whose uid matches
 * a source asset ID with the corresponding Contentstack asset UID.
 * Two reference shapes are handled:
 *   1. Object refs — `{ uid: "<sourceUid>", ... }` (mapped "file" fields).
 *   2. Bare string refs — `{ src: "<sourceUid>" }` etc. AEM stores many asset
 *      references (e.g. carousel `image[].src`) as the plain uid string, not an
 *      object; without this branch those refs keep the source uid and the import
 *      rejects them with "is not a valid upload."
 */
const replaceAssetRefsInObject = (
  obj: any,
  assetUidMap: Map<string, string>,
): boolean => {
  if (!obj || typeof obj !== "object") return false;

  let modified = false;

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    // Bare string asset uid reference, e.g. { src: "<sourceUid>" }.
    if (typeof value === "string" && assetUidMap?.has(value)) {
      obj[key] = assetUidMap?.get(value);
      modified = true;
      continue;
    }

    if (!value || typeof value !== "object") continue;

    if (value?.uid && assetUidMap?.has(value?.uid)) {
      obj[key] = assetUidMap?.get(value?.uid);
      modified = true;
    } else {
      const childModified = replaceAssetRefsInObject(value, assetUidMap);
      if (childModified) modified = true;
    }
  }

  return modified;
};

/**
 * Saves asset metadata from index.json to database/{projectId}/{iteration}/asset-metadata.json.
 * Used for validation in subsequent iterations.
 */
export const saveAssetMetadata = (
  indexData: Record<string, any>,
  projectId: string,
  iteration: number,
  loggerPath?: string,
): void => {
  const metadata: Record<string, AssetMetadata> = {};

  for (const [assetId, asset] of Object.entries(indexData)) {
    metadata[assetId] = {
      filename: asset?.filename || "",
      file_size: asset?.file_size || "",
      url: asset?.url || "",
    };
  }

  const metadataDir = path.join(
    process.cwd(),
    DATABASE_FILES.DIRECTORY,
    projectId,
    iteration.toString(),
  );
  fs.mkdirSync(metadataDir, { recursive: true });
  const metadataPath = path.join(metadataDir, DATABASE_FILES.ASSET_METADATA);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  writeLogEntry(
    `Asset metadata saved: ${
      Object?.keys(metadata)?.length
    } assets → ${metadataPath}`,
    "saveAssetMetadata",
    loggerPath,
  );
};

/**
 * Loads asset metadata from a previous iteration.
 */
export const loadPreviousAssetMetadata = (
  projectId: string,
  prevIteration: number,
): Record<string, AssetMetadata> => {
  const metadataPath = path.join(
    process.cwd(),
    DATABASE_FILES.DIRECTORY,
    projectId,
    prevIteration.toString(),
    DATABASE_FILES.ASSET_METADATA,
  );
  if (!fs.existsSync(metadataPath)) {
    // Note: This function doesn't have access to loggerPath, keeping as console for internal function
    console.info(`No previous asset metadata found at ${metadataPath}`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  } catch (err) {
    console.error("Failed to read previous asset metadata:", err);
    return {};
  }
};

/**
 * Loads the asset uid mapping from a previous iteration's uid-mapper.json.
 */
const loadPreviousAssetUidMap = (
  projectId: string,
  prevIteration: number,
): Record<string, string> => {
  const uidMapperPath = path.join(
    process.cwd(),
    DATABASE_FILES.DIRECTORY,
    projectId,
    prevIteration.toString(),
    DATABASE_FILES.UID_MAPPER,
  );
  if (!fs.existsSync(uidMapperPath)) {
    // Note: This function doesn't have access to loggerPath, keeping as console for internal function
    console.info(`No uid-mapper found at ${uidMapperPath}`);
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(uidMapperPath, "utf-8"));
    return data?.assets || {};
  } catch (err) {
    console.error("Failed to read uid-mapper:", err);
    return {};
  }
};

/**
 * Determines whether an asset has changed by comparing current metadata
 * against the previous iteration's stored metadata.
 */
const hasAssetChanged = (
  assetId: string,
  currentAsset: any,
  prevMetadata: Record<string, AssetMetadata>,
): boolean => {
  const prev = prevMetadata[assetId];
  if (!prev) return true;

  const currentFilename = currentAsset?.filename || "";
  const currentFileSize = currentAsset?.file_size || "";

  if (currentFilename !== prev.filename || currentFileSize !== prev.file_size) {
    // Note: This function doesn't have access to loggerPath, keeping as console for internal function
    console.info(
      `Asset "${assetId}" changed: ` +
        `filename "${prev.filename}" → "${currentFilename}", ` +
        `file_size "${prev.file_size}" → "${currentFileSize}"`,
    );
    return true;
  }

  return false;
};

/**
 * Reconciles already-migrated assets in cmsMigrationData against the user's
 * Asset Mapper decisions so matched assets are never re-imported as duplicates.
 *
 * For iteration 1: only saves asset metadata for future comparisons.
 * For iteration 2+:
 *   1. Reads uid-mapper.assets from previous iteration
 *   2. Reads asset-metadata.json from previous iteration
 *   3. For each asset in current index.json:
 *      - If NOT in uid-mapper → new asset, keep it for import
 *      - If in uid-mapper and the user chose "update" (isUpdate=true; default
 *        when the file changed) → keep its existing CS UID, drop it from the
 *        import and collect it for an in-place binary replace after import
 *      - If in uid-mapper and the user chose "reuse" (isUpdate=false) → keep
 *        its existing CS UID, drop it from the import, leave the asset untouched
 *   4. Repoints asset references in entry JSON files to the existing CS UID
 *   5. Removes matched assets from index.json (and reused assets' file folders)
 *   6. Saves current asset metadata for the next iteration
 *
 * @returns the assets to replace in place (empty when there are none).
 */
export const removeExistingAssets = async (
  projectId: string,
  loggerPath?: string,
): Promise<AssetUpdate[]> => {
  await ProjectModelLowdb.read();
  const projectData = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  const iteration = projectData?.iteration || 1;
  const stackId = projectData?.destination_stack_id;

  if (!stackId) {
    writeLogEntry(
      "No stackId found, skipping asset dedup.",
      "removeExistingAssets",
      loggerPath,
    );
    return [];
  }

  const assetsDir = path.join(
    process.cwd(),
    MIGRATION_DATA_CONFIG.DATA,
    stackId,
    MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME,
  );
  const indexPath = path.join(
    assetsDir,
    MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE,
  );
  if (!fs.existsSync(indexPath)) {
    writeLogEntry(
      `Assets index.json not found at ${indexPath}, skipping.`,
      "removeExistingAssets",
      loggerPath,
    );
    return [];
  }
  writeLogEntry(
    `Assets index.json found at ${indexPath}`,
    "removeExistingAssets",
    loggerPath,
  );

  let indexData: Record<string, any>;
  try {
    const raw = fs.readFileSync(indexPath, "utf-8");
    if (!raw.trim()) {
      console.error(`Assets index.json is empty at ${indexPath}`);
      return [];
    }
    indexData = JSON.parse(raw);
  } catch (error) {
    console.error(
      `Failed to parse assets index.json at ${indexPath}:`,
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }

  saveAssetMetadata(indexData, projectId, iteration, loggerPath);

  if (iteration <= 1) {
    writeLogEntry(
      "Iteration 1: asset metadata saved, no dedup needed.",
      "removeExistingAssets",
      loggerPath,
    );
    return [];
  }
  writeLogEntry(
    `Iteration ${iteration} found, loading previous asset uid map and metadata.`,
    "removeExistingAssets",
    loggerPath,
  );

  const prevIteration = iteration - 1;
  const prevAssetUidMap = loadPreviousAssetUidMap(projectId, prevIteration);
  writeLogEntry(
    `Previous asset uid map loaded from ${prevIteration} iteration.`,
    "removeExistingAssets",
    loggerPath,
  );
  const prevMetadata = loadPreviousAssetMetadata(projectId, prevIteration);

  if (!Object?.keys(prevAssetUidMap)?.length) {
    writeLogEntry(
      "No previous asset uid mapping found, skipping dedup.",
      "removeExistingAssets",
      loggerPath,
    );
    return [];
  }
  writeLogEntry(
    `Previous asset metadata loaded from ${prevIteration} iteration.`,
    "removeExistingAssets",
    loggerPath,
  );
  // User decisions from the Asset Mapper screen (present when the connector
  // provides upload-time asset rows, e.g. AEM). isUpdate=true means "update the
  // existing Contentstack asset in place (same UID, new file)"; isUpdate=false
  // means "keep/reuse the existing asset as-is". Assets without a row fall back
  // to automatic filename+size change detection (changed → update).
  const AssetMapperModel = getAssetMapperDb(projectId, iteration);
  await AssetMapperModel.read();
  const decisionByUid = new Map<string, boolean>();
  for (const row of (AssetMapperModel.data as any)?.asset_mapper ?? []) {
    if (row?.otherCmsAssetUid) {
      decisionByUid.set(row.otherCmsAssetUid, Boolean(row.isUpdate));
    }
  }

  // Both reused and updated assets keep their existing Contentstack UID, so
  // their entry references are repointed to it and they are dropped from the
  // fresh import (no duplicate). Reused assets need nothing more; updated assets
  // additionally have their binary replaced in place after the import runs.
  const assetUidReplacements = new Map<string, string>();
  const assetsToRemoveFromIndex: string[] = [];
  const assetsToDeleteFiles: string[] = [];
  const assetUpdates: AssetUpdate[] = [];

  const filesDir = path.join(assetsDir, "files");

  for (const [assetId, assetData] of Object.entries(indexData)) {
    const contentstackUid = prevAssetUidMap[assetId];
    if (!contentstackUid) continue;

    const decision = decisionByUid.get(assetId);

    // No explicit Asset Mapper decision (e.g. connectors that don't populate
    // the asset mapper): keep the legacy automatic behavior — unchanged assets
    // are reused, changed assets are re-imported as new.
    if (decision === undefined) {
      if (hasAssetChanged(assetId, assetData, prevMetadata)) {
        writeLogEntry(
          `Asset "${assetId}" changed (no mapper decision) → re-import`,
          "removeExistingAssets",
          loggerPath,
        );
        continue; // leave it in index.json for a normal import
      }
      assetUidReplacements.set(assetId, contentstackUid);
      assetsToRemoveFromIndex.push(assetId);
      assetsToDeleteFiles.push(assetId);
      writeLogEntry(
        `Asset "${assetId}" unchanged (no mapper decision) → reuse existing CS UID "${contentstackUid}"`,
        "removeExistingAssets",
        loggerPath,
      );
      continue;
    }

    // Explicit user decision. Either way the asset keeps its existing CS UID and
    // is dropped from the fresh import; its references are repointed to that UID.
    assetUidReplacements.set(assetId, contentstackUid);
    assetsToRemoveFromIndex.push(assetId);

    const filename = assetData?.filename ?? "";
    const filePath = path.join(filesDir, assetId, filename);

    if (decision && filename && fs.existsSync(filePath)) {
      assetUpdates.push({
        uid: contentstackUid,
        filePath,
        filename,
        title: assetData?.title ?? filename,
      });
      writeLogEntry(
        `Asset "${assetId}" → update existing CS UID "${contentstackUid}" in place`,
        "removeExistingAssets",
        loggerPath,
      );
    } else {
      // Reuse (user unchecked) or update requested but the binary is missing —
      // keep the existing asset and just repoint the reference, so it never
      // lands as a dangling source uid in the entry.
      assetsToDeleteFiles.push(assetId);
      if (decision) {
        writeLogEntry(
          `Asset "${assetId}" marked for update but file missing at ${filePath}; reusing CS UID "${contentstackUid}"`,
          "removeExistingAssets",
          loggerPath,
        );
      } else {
        writeLogEntry(
          `Asset "${assetId}" → reuse existing CS UID "${contentstackUid}"`,
          "removeExistingAssets",
          loggerPath,
        );
      }
    }
  }

  if (!assetUidReplacements.size) {
    writeLogEntry(
      "No matched assets to reuse or update.",
      "removeExistingAssets",
      loggerPath,
    );
    return assetUpdates;
  }

  // 1. Replace asset references in entry JSON files
  const entriesDir = path.join(
    process.cwd(),
    MIGRATION_DATA_CONFIG.DATA,
    stackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
  );

  if (fs.existsSync(entriesDir)) {
    const contentTypeDirs = fs
      .readdirSync(entriesDir, { withFileTypes: true })
      ?.filter((d) => d?.isDirectory());

    for (const ctDir of contentTypeDirs) {
      const ctPath = path.join(entriesDir, ctDir?.name);

      if (!fs.existsSync(ctPath)) {
        console.warn(`Content type directory not found: ${ctPath}`);
        continue;
      }

      const localeDirs = fs
        .readdirSync(ctPath, { withFileTypes: true })
        ?.filter((d) => d?.isDirectory());

      for (const localeDir of localeDirs) {
        const localePath = path.join(ctPath, localeDir?.name);

        if (!fs.existsSync(localePath)) {
          console.warn(`Locale directory not found: ${localePath}`);
          continue;
        }

        const jsonFiles = fs
          .readdirSync(localePath)
          .filter((f) => f.endsWith(".json") && f !== "index.json");

        for (const jsonFile of jsonFiles) {
          const filePath = path.join(localePath, jsonFile);

          try {
            const raw = fs.readFileSync(filePath, "utf-8");

            // Check if file is empty or contains only whitespace
            if (!raw.trim()) {
              console.warn(`Skipping empty file: ${filePath}`);
              continue;
            }

            const data = JSON.parse(raw);

            const modified = replaceAssetRefsInObject(data, assetUidReplacements);
            if (modified) {
              fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
              writeLogEntry(
                `Replaced asset refs in ${filePath}`,
                "removeExistingAssets",
                loggerPath,
              );
            }
          } catch (error) {
            console.error(
              `Failed to process file ${filePath}:`,
              error instanceof Error ? error.message : String(error),
            );
            console.warn(`Skipping problematic file: ${filePath}`);
            continue; // Skip this file and continue with others
          }
        }
      }
    }
  }

  // 2. Remove deduplicated assets from index.json
  for (const assetId of assetsToRemoveFromIndex) {
    delete indexData[assetId];
    writeLogEntry(
      `Asset "${assetId}" has been removed from migration data (already exists in Contentstack)`,
      "removeExistingAssets",
      loggerPath,
    );
  }
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 4), "utf-8");
  writeLogEntry(
    `Removed ${assetsToRemoveFromIndex?.length} assets from index.json`,
    "removeExistingAssets",
    loggerPath,
  );

  // 3. Remove reused assets' file folders. Assets queued for an in-place update
  //    keep their folder so the replace step can still upload the binary.
  if (fs.existsSync(filesDir)) {
    for (const assetId of assetsToDeleteFiles) {
      const assetFolder = path.join(filesDir, assetId);
      if (fs.existsSync(assetFolder)) {
        fs.rmSync(assetFolder, { recursive: true, force: true });
        writeLogEntry(
          `Removed asset folder: ${assetFolder}`,
          "removeExistingAssets",
          loggerPath,
        );
        writeLogEntry(
          `Asset "${assetId}" physical files have been removed from migration data`,
          "removeExistingAssets",
          loggerPath,
        );
      }
    }
  }

  writeLogEntry(
    `Asset processing complete: ${assetsToDeleteFiles.length} reused, ` +
      `${assetUpdates.length} to update in place, ` +
      `${Object?.keys(indexData)?.length} remaining for import.`,
    "removeExistingAssets",
    loggerPath,
  );
  return assetUpdates;
};
