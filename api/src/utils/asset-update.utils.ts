import ProjectModelLowdb from "../models/project-lowdb.js";
import path from "path";
import fs from "node:fs";
import { MIGRATION_DATA_CONFIG } from "../constants/index.js";

/**
 * Helper function to write log entries to file
 */
const writeLogEntry = (message: string, methodName: string, loggerPath?: string) => {
    if (loggerPath) {
        const directLogEntry = {
            level: 'info',
            message,
            methodName,
            timestamp: new Date().toISOString(),
        };
        fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + '\n');
    }
};

interface AssetMetadata {
    filename: string;
    file_size: string;
    url: string;
}

/**
 * Traverses an object and replaces any asset reference whose uid matches
 * a source asset ID with the corresponding Contentstack asset UID.
 * Asset references are objects with a "uid" property matching a known source asset ID.
 */
const replaceAssetRefsInObject = (
    obj: any,
    assetUidMap: Map<string, string>
): boolean => {
    if (!obj || typeof obj !== "object") return false;

    let modified = false;

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (!value || typeof value !== "object") continue;

        if (value.uid && assetUidMap.has(value.uid)) {
            obj[key] = assetUidMap.get(value.uid);
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
const saveAssetMetadata = (
    indexData: Record<string, any>,
    projectId: string,
    iteration: number,
    loggerPath?: string
): void => {
    const metadata: Record<string, AssetMetadata> = {};

    for (const [assetId, asset] of Object.entries(indexData)) {
        metadata[assetId] = {
            filename: asset?.filename || "",
            file_size: asset?.file_size || "",
            url: asset?.url || "",
        };
    }

    const metadataDir = path.join(process.cwd(), "database", projectId, iteration.toString());
    fs.mkdirSync(metadataDir, { recursive: true });
    const metadataPath = path.join(metadataDir, "asset-metadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    writeLogEntry(`Asset metadata saved: ${Object.keys(metadata).length} assets → ${metadataPath}`, "saveAssetMetadata", loggerPath);
};

/**
 * Loads asset metadata from a previous iteration.
 */
const loadPreviousAssetMetadata = (
    projectId: string,
    prevIteration: number
): Record<string, AssetMetadata> => {
    const metadataPath = path.join(
        process.cwd(), "database", projectId,
        prevIteration.toString(), "asset-metadata.json"
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
    prevIteration: number
): Record<string, string> => {
    const uidMapperPath = path.join(
        process.cwd(), "database", projectId,
        prevIteration.toString(), "uid-mapper.json"
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
    prevMetadata: Record<string, AssetMetadata>
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
            `file_size "${prev.file_size}" → "${currentFileSize}"`
        );
        return true;
    }

    return false;
};

/**
 * Removes existing (already-migrated) assets from cmsMigrationData to prevent duplicates.
 *
 * For iteration 1: only saves asset metadata for future comparisons.
 * For iteration 2+:
 *   1. Reads uid-mapper.assets from previous iteration
 *   2. Reads asset-metadata.json from previous iteration
 *   3. For each asset in current index.json:
 *      - If NOT in uid-mapper → new asset, keep it
 *      - If in uid-mapper AND metadata matches → unchanged, replace refs with CS UID, remove from import
 *      - If in uid-mapper BUT metadata differs → updated asset, keep it for re-import
 *   4. Replaces asset references in entry JSON files with Contentstack UIDs
 *   5. Removes deduplicated asset entries from index.json and their file folders
 *   6. Saves current asset metadata for the next iteration
 */
export const removeExistingAssets = async (projectId: string, loggerPath?: string): Promise<void> => {
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
        .get("projects")
        .find({ id: projectId })
        .value();

    const iteration = projectData?.iteration || 1;
    const stackId = projectData?.destination_stack_id;

    if (!stackId) {
        writeLogEntry("No stackId found, skipping asset dedup.", "removeExistingAssets", loggerPath);
        return;
    }

    const assetsDir = path.join(
        process.cwd(), MIGRATION_DATA_CONFIG.DATA, stackId,
        MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );
    const indexPath = path.join(assetsDir, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);

    if (!fs.existsSync(indexPath)) {
        writeLogEntry(`Assets index.json not found at ${indexPath}, skipping.`, "removeExistingAssets", loggerPath);
        return;
    }
    writeLogEntry(`Assets index.json found at ${indexPath}`, "removeExistingAssets", loggerPath);

    let indexData: Record<string, any>;
    try {
        const raw = fs.readFileSync(indexPath, "utf-8");
        if (!raw.trim()) {
            console.error(`Assets index.json is empty at ${indexPath}`);
            return;
        }
        indexData = JSON.parse(raw);
    } catch (error) {
        console.error(`Failed to parse assets index.json at ${indexPath}:`, error instanceof Error ? error.message : String(error));
        return;
    }

    saveAssetMetadata(indexData, projectId, iteration, loggerPath);

    if (iteration <= 1) {
        writeLogEntry("Iteration 1: asset metadata saved, no dedup needed.", "removeExistingAssets", loggerPath);
        return;
    }
    writeLogEntry(`Iteration ${iteration} found, loading previous asset uid map and metadata.`, "removeExistingAssets", loggerPath);

    const prevIteration = iteration - 1;
    const prevAssetUidMap = loadPreviousAssetUidMap(projectId, prevIteration);
    writeLogEntry(`Previous asset uid map loaded from ${prevIteration} iteration.`, "removeExistingAssets", loggerPath);
    const prevMetadata = loadPreviousAssetMetadata(projectId, prevIteration);

    if (!Object.keys(prevAssetUidMap).length) {
        writeLogEntry("No previous asset uid mapping found, skipping dedup.", "removeExistingAssets", loggerPath);
        return;
    }
    writeLogEntry(`Previous asset metadata loaded from ${prevIteration} iteration.`, "removeExistingAssets", loggerPath);
    const assetsToReuse = new Map<string, string>();
    const assetsToRemoveFromIndex: string[] = [];

    for (const [assetId, assetData] of Object.entries(indexData)) {
        const contentstackUid = prevAssetUidMap[assetId];
        if (!contentstackUid) continue;

        if (!hasAssetChanged(assetId, assetData, prevMetadata)) {
            assetsToReuse.set(assetId, contentstackUid);
            assetsToRemoveFromIndex.push(assetId);
            writeLogEntry(`Asset "${assetId}" unchanged → reuse CS UID "${contentstackUid}"`, "removeExistingAssets", loggerPath);
            writeLogEntry(`Asset "${assetId}" has been reused from previous migration`, "removeExistingAssets", loggerPath);
        } else {
            writeLogEntry(`Asset "${assetId}" changed → will re-import`, "removeExistingAssets", loggerPath);
        }
    }

    if (!assetsToReuse.size) {
        writeLogEntry("No unchanged assets to deduplicate.", "removeExistingAssets", loggerPath);
        return;
    }

    // 1. Replace asset references in entry JSON files
    const entriesDir = path.join(
        process.cwd(), MIGRATION_DATA_CONFIG.DATA, stackId,
        MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
    );

    if (fs.existsSync(entriesDir)) {
        const contentTypeDirs = fs.readdirSync(entriesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory());

        for (const ctDir of contentTypeDirs) {
            const ctPath = path.join(entriesDir, ctDir.name);
            
            if (!fs.existsSync(ctPath)) {
                console.warn(`Content type directory not found: ${ctPath}`);
                continue;
            }
            
            const localeDirs = fs.readdirSync(ctPath, { withFileTypes: true })
                .filter((d) => d.isDirectory());

            for (const localeDir of localeDirs) {
                const localePath = path.join(ctPath, localeDir.name);
                
                if (!fs.existsSync(localePath)) {
                    console.warn(`Locale directory not found: ${localePath}`);
                    continue;
                }
                
                const jsonFiles = fs.readdirSync(localePath)
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

                        const modified = replaceAssetRefsInObject(data, assetsToReuse);
                        if (modified) {
                            fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
                            writeLogEntry(`Replaced asset refs in ${filePath}`, "removeExistingAssets", loggerPath);
                        }
                    } catch (error) {
                        console.error(`Failed to process file ${filePath}:`, error instanceof Error ? error.message : String(error));
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
        writeLogEntry(`Asset "${assetId}" has been removed from migration data (already exists in Contentstack)`, "removeExistingAssets", loggerPath);
    }
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 4), "utf-8");
    writeLogEntry(`Removed ${assetsToRemoveFromIndex.length} assets from index.json`, "removeExistingAssets", loggerPath);

    // 3. Remove asset file folders
    const filesDir = path.join(assetsDir, "files");
    if (fs.existsSync(filesDir)) {
        for (const assetId of assetsToRemoveFromIndex) {
            const assetFolder = path.join(filesDir, assetId);
            if (fs.existsSync(assetFolder)) {
                fs.rmSync(assetFolder, { recursive: true, force: true });
                writeLogEntry(`Removed asset folder: ${assetFolder}`, "removeExistingAssets", loggerPath);
                writeLogEntry(`Asset "${assetId}" physical files have been removed from migration data`, "removeExistingAssets", loggerPath);
            }
        }
    }

    writeLogEntry(
        `Asset dedup complete: ${assetsToReuse.size} reused, ` +
        `${Object.keys(indexData).length} remaining for import.`,
        "removeExistingAssets",
        loggerPath
    );
};
