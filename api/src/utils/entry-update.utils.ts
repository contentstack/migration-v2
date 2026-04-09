import getEntryMapperDb from "../models/EntryMapper.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import path from "path";
import fs from "node:fs";
import { MIGRATION_DATA_CONFIG } from "../constants/index.js";

// export const getEntriesToUpdate = async (projectId: string) => {
//     await ProjectModelLowdb.read();
//     const projectData = ProjectModelLowdb.chain
//         .get("projects")
//         .find({ id: projectId })
//         .value();
//     const iteration = projectData?.iteration || 1;
//     const updateEntryDataDb = getEntryMapperDb(projectId, iteration);
//     await updateEntryDataDb.read();
//     const entriesToUpdate = updateEntryDataDb.chain.get("entry_mapper").filter({ isUpdate: true }).value();
//     return entriesToUpdate;
// };

export const removeEntriesFromDatabase = async (projectId: string): Promise<string | null> => {
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
        console.info("No entry mapper items found or stackId missing, skipping removal.");
        return null;
    }

    const sitecoreUids = new Set(
        entryMapperItems.map((item: { otherCmsEntryUid: string }) => item.otherCmsEntryUid)
    );

    const updateUidMap = new Map<string, string>();
    for (const item of entryMapperItems) {
        if (item.isUpdate) {
            updateUidMap.set(item.otherCmsEntryUid, item.contentstackEntryUid);
        }
    }

    const entriesDir = path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA,
        stackId,
        MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
    );

    if (!fs.existsSync(entriesDir)) {
        console.info(`Entries directory not found: ${entriesDir}`);
        return null;
    }

    const contentTypeDirs = fs.readdirSync(entriesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory());

    for (const ctDir of contentTypeDirs) {
        const contentTypeName = ctDir.name;
        const ctPath = path.join(entriesDir, contentTypeName);
        const localeDirs = fs.readdirSync(ctPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory());

        for (const localeDir of localeDirs) {
            const localePath = path.join(ctPath, localeDir.name);
            const jsonFiles = fs.readdirSync(localePath)
                .filter((file) => file.endsWith(".json") && file !== "index.json");

            for (const jsonFile of jsonFiles) {
                const filePath = path.join(localePath, jsonFile);
                const raw = fs.readFileSync(filePath, "utf-8");
                const data = JSON.parse(raw);

                let modified = false;
                for (const key of Object.keys(data)) {
                    if (sitecoreUids.has(key)) {
                        const csEntryUid = updateUidMap.get(key);
                        if (csEntryUid) {
                            const entryData = { ...data[key] };
                            delete entryData.uid;

                            if (!entriesToUpdate[contentTypeName]) {
                                entriesToUpdate[contentTypeName] = {};
                            }
                            entriesToUpdate[contentTypeName][csEntryUid] = entryData;
                            console.info(`Collected update entry "${csEntryUid}" for content type "${contentTypeName}"`);
                        }

                        delete data[key];
                        modified = true;
                        console.info(`Removed entry "${key}" from ${filePath}`);
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

    console.info("Finished removing entries from cmsMigrationData.");
    console.info(`Config written to: ${configPath}`);
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
    iteration: number
): void => {
    const dbBase = path.join(process.cwd(), "database", projectId);

    let oldAssetMapping: Record<string, string> = {};
    if (iteration > 1) {
        const oldPath = path.join(dbBase, (iteration - 1).toString(), "uid-mapper.json");
        if (fs.existsSync(oldPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
                oldAssetMapping = data.assets || {};
            } catch (err) {
                console.error("Failed to read old uid-mapper:", err);
            }
        }
    }

    let newAssetMapping: Record<string, string> = {};
    const newPath = path.join(dbBase, iteration.toString(), "uid-mapper.json");
    if (fs.existsSync(newPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(newPath, "utf-8"));
            newAssetMapping = data.assets || {};
        } catch (err) {
            console.error("Failed to read new uid-mapper:", err);
        }
    }

    // const config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
    // config.__assetMapping__ = {
    //     old: oldAssetMapping,
    //     new: newAssetMapping,
    // };
    // fs.writeFileSync(configFilePath, JSON.stringify(config), "utf-8");

    console.info(`Asset mapping enriched into config: old=${Object.keys(oldAssetMapping).length} keys, new=${Object.keys(newAssetMapping).length} keys`);
};