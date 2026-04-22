import getEntryMapperDb from "../models/EntryMapper.js";
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

export const removeEntriesFromDatabase = async (projectId: string, loggerPath?: string): Promise<string | null> => {
    const entriesToUpdate: Record<string, Record<string, any>> = {};

    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
        .get("projects")
        .find({ id: projectId })
        .value();
    const iteration = projectData?.iteration || 1;
    const stackId = projectData?.destination_stack_id;
    const updateEntryDataDb = getEntryMapperDb(projectId, iteration);
    await updateEntryDataDb.read();

    const entryMapperItems = updateEntryDataDb.chain.get("entry_mapper").value();
    if (!entryMapperItems?.length || !stackId) {
        writeLogEntry("No entry mapper items found or stackId missing, skipping removal.", "removeEntriesFromDatabase", loggerPath);
        return null;
    }

    const sitecoreUids = new Set(
        entryMapperItems.map((item: { otherCmsEntryUid: string }) => item?.otherCmsEntryUid)
    );

    const updateUidMap = new Map<string, string>();
    for (const item of entryMapperItems) {
        if (item.isUpdate) {
            updateUidMap.set(item?.otherCmsEntryUid, item?.contentstackEntryUid);
        }
    }

    const entriesDir = path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA,
        stackId,
        MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
    );

    if (!fs.existsSync(entriesDir)) {
        writeLogEntry(`Entries directory not found: ${entriesDir}`, "removeEntriesFromDatabase", loggerPath);
        return null;
    }

    const contentTypeDirs = fs.readdirSync(entriesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory());

    for (const ctDir of contentTypeDirs) {
        const contentTypeName = ctDir.name;
        const ctPath = path.join(entriesDir, contentTypeName);
        const localeDirs = fs.readdirSync(ctPath, { withFileTypes: true })
            ?.filter((dirent) => dirent?.isDirectory());

        for (const localeDir of localeDirs) {
            const localePath = path.join(ctPath, localeDir.name);
            const jsonFiles = fs.readdirSync(localePath)
                ?.filter((file) => file?.endsWith(".json") && file !== "index.json");

            for (const jsonFile of jsonFiles) {
                const filePath = path.join(localePath, jsonFile);
                const raw = fs.readFileSync(filePath, "utf-8");
                const data = JSON.parse(raw);

                let modified = false;
                for (const key of Object?.keys(data)) {
                    if (sitecoreUids.has(key)) {
                        const csEntryUid = updateUidMap.get(key);
                        if (csEntryUid) {
                            const entryData = { ...data[key] };
                            delete entryData?.uid;

                            if (!entriesToUpdate[contentTypeName]) {
                                entriesToUpdate[contentTypeName] = {};
                            }
                            entriesToUpdate[contentTypeName][csEntryUid] = entryData;
                            writeLogEntry(`Collected update entry "${csEntryUid}" for content type "${contentTypeName}"`, "removeEntriesFromDatabase", loggerPath);
                            writeLogEntry(`Entry "${key}" has been prepared for update in Contentstack as "${csEntryUid}"`, "removeEntriesFromDatabase", loggerPath);
                        }

                        delete data[key];
                        modified = true;
                        writeLogEntry(`Removed entry "${key}" from ${filePath}`, "removeEntriesFromDatabase", loggerPath);
                        writeLogEntry(`Entry "${key}" has been removed from migration data (will be updated instead of created)`, "removeEntriesFromDatabase", loggerPath);
                    }
                }

                if (modified) {
                    fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
                }
            }
        }
    }

    const configDir = path.join(process.cwd(), "database", projectId, iteration.toString());
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, "updated-entries.json");
    fs.writeFileSync(configPath, JSON.stringify(entriesToUpdate), "utf-8");

    writeLogEntry("Finished removing entries from cmsMigrationData.", "removeEntriesFromDatabase", loggerPath);
    writeLogEntry(`Config written to: ${configPath}`, "removeEntriesFromDatabase", loggerPath);
    writeLogEntry(`Total entries prepared for update: ${Object?.keys(entriesToUpdate)?.reduce((total, ct) => total + Object?.keys(entriesToUpdate[ct])?.length, 0)}`, "removeEntriesFromDatabase", loggerPath);
    return configPath;
};

/**
 * Reads old (previous iteration) and new (current iteration) asset uid mappings
 * and merges them into the updated-entries config file under __assetMapping__.
 * This allows the entry-update-script to resolve asset references using a 3-way comparison:
 *   - newMapping: asset just re-imported in this iteration → always wins
 *   - oldMapping vs stack: detect if user manually changed the asset
 */
export const enrichConfigWithAssetMapping = (
    configFilePath: string,
    projectId: string,
    iteration: number,
    loggerPath?: string
): void => {
    const dbBase = path.join(process.cwd(), "database", projectId);

    let oldAssetMapping: Record<string, string> = {};
    if (iteration > 1) {
        const oldPath = path.join(dbBase, (iteration - 1).toString(), "uid-mapper.json");
        if (fs.existsSync(oldPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
                oldAssetMapping = data?.assets || {};
                writeLogEntry(`Loaded ${Object.keys(oldAssetMapping).length} old asset mappings from iteration ${iteration - 1}`, "enrichConfigWithAssetMapping", loggerPath);
            } catch (err) {
                console.error("Failed to read old uid-mapper:", err);
            }
        } else {
            writeLogEntry(`No old asset mapping found for iteration ${iteration - 1}`, "enrichConfigWithAssetMapping", loggerPath);
        }
    }

    let newAssetMapping: Record<string, string> = {};
    const newPath = path.join(dbBase, iteration.toString(), "uid-mapper.json");
    if (fs.existsSync(newPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(newPath, "utf-8"));
            newAssetMapping = data?.assets || {};
            writeLogEntry(`Loaded ${Object.keys(newAssetMapping).length} new asset mappings from iteration ${iteration}`, "enrichConfigWithAssetMapping", loggerPath);
        } catch (err) {
            console.error("Failed to read new uid-mapper:", err);
        }
    } else {
        writeLogEntry(`No new asset mapping found for iteration ${iteration}`, "enrichConfigWithAssetMapping", loggerPath);
    }

    writeLogEntry(`Asset mapping enriched into config: old=${Object?.keys(oldAssetMapping)?.length} keys, new=${Object?.keys(newAssetMapping)?.length} keys`, "enrichConfigWithAssetMapping", loggerPath);
    writeLogEntry(`Asset mapping configuration has been enriched for iteration ${iteration}`, "enrichConfigWithAssetMapping", loggerPath);
    writeLogEntry(`Asset references will be resolved using combined old and new mappings`, "enrichConfigWithAssetMapping", loggerPath);
};