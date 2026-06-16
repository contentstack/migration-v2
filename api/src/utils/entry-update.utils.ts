import getEntryMapperDb from "../models/EntryMapper.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import path from "path";
import fs from "node:fs";
import { MIGRATION_DATA_CONFIG, DATABASE_FILES } from "../constants/index.js";
import { sanitizeStackId, assertResolvedPathUnderBase } from "./sanitize-path.utils.js";
import {
    isFullMigrationForLocale,
    getSourceLocaleForDestination,
} from "./locale-migration.utils.js";

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

/**
 * Deletes the transformed entries tree for a stack before a fresh import.
 *
 * Each import run writes entry chunk files with fresh random UUID names and overwrites
 * index.json, but never removes the previous run's chunk files. Those orphans carry
 * stale (previous-iteration) content that can later clobber current data during update.
 * Wiping the entries tree up front guarantees the importer starts from a clean slate.
 *
 * Scope is limited to the `entries/` subtree only — assets, references, environments,
 * locales and content-type creation (driven by the lowdb mappers, not this folder) are
 * untouched.
 */
export const clearStaleEntries = (stackId: string, loggerPath?: string): void => {
    const safeStackId = sanitizeStackId(stackId);
    if (!safeStackId) {
        writeLogEntry(`Invalid stackId, skipping stale entries cleanup.`, "clearStaleEntries", loggerPath);
        return;
    }

    const dataBase = path.resolve(process.cwd(), MIGRATION_DATA_CONFIG.DATA);
    const entriesDir = path.join(dataBase, safeStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME);
    assertResolvedPathUnderBase(dataBase, entriesDir);

    if (!fs.existsSync(entriesDir)) {
        writeLogEntry(`No existing entries directory to clear: ${entriesDir}`, "clearStaleEntries", loggerPath);
        return;
    }

    fs.rmSync(entriesDir, { recursive: true, force: true });
    writeLogEntry(`Cleared stale entries directory before import: ${entriesDir}`, "clearStaleEntries", loggerPath);
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

    // Per (otherCmsEntryUid, sourceLanguage) lookup so we can find the exact row that
    // corresponds to a given locale directory. Same source entry may have N rows — one per
    // source-locale variant — each with its own isUpdate flag.
    const rowByUidAndLang = new Map<string, any>();
    const csUidByOtherCmsUid = new Map<string, string>();
    for (const item of entryMapperItems) {
        if (item?.contentstackEntryUid) {
            csUidByOtherCmsUid.set(item?.otherCmsEntryUid, item?.contentstackEntryUid);
            const lang = (item as any)?.language ?? '';
            rowByUidAndLang.set(`${item?.otherCmsEntryUid}::${lang}`, item);
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
            const localeCode = localeDir.name;
            // Newly-added locales have no prior migration state to diff against. Leave their
            // import data alone (so the regular full-import pipeline picks them up) and skip
            // generating any update payloads for them.
            if (isFullMigrationForLocale(projectData ?? {}, localeCode)) {
                writeLogEntry(
                    `Skipping delta cleanup for new locale "${localeCode}" — full import.`,
                    "removeEntriesFromDatabase",
                    loggerPath,
                );
                continue;
            }
            // entry_mapper rows are tagged with the SOURCE locale code (e.g. "en-IN");
            // directories on disk use the DESTINATION code (e.g. "en-in"). Translate.
            const sourceLocale = getSourceLocaleForDestination(projectData ?? {}, localeCode);
            const localePath = path.join(ctPath, localeDir.name);
            // Respect index.json — only the chunk files it lists are current. Each import run
            // writes chunk files with fresh random UUID names and overwrites index.json, but does
            // not delete prior runs' chunk files. Globbing all *.json would pick up those orphans,
            // whose stale (previous-iteration) content can then clobber the current entry data.
            const indexPath = path.join(localePath, MIGRATION_DATA_CONFIG.ENTRIES_MASTER_FILE);
            let jsonFiles: string[];
            if (fs.existsSync(indexPath)) {
                // Guard against a missing/corrupt/non-object index.json — a parse failure or
                // unexpected shape here would otherwise throw and abort the entire removal step.
                let indexData: unknown;
                try {
                    indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
                } catch (err) {
                    writeLogEntry(`Failed to parse index.json at ${indexPath}, skipping locale: ${(err as Error)?.message}`, "removeEntriesFromDatabase", loggerPath);
                    continue;
                }
                if (!indexData || typeof indexData !== "object") {
                    writeLogEntry(`index.json at ${indexPath} is not an object, skipping locale.`, "removeEntriesFromDatabase", loggerPath);
                    continue;
                }
                jsonFiles = Object.values(indexData as Record<string, unknown>)
                    // Sanitize to path.basename — index values are trusted verbatim otherwise,
                    // so an unexpected value could introduce extra path segments.
                    .filter((file): file is string => typeof file === "string" && file.endsWith(".json"))
                    .map((file) => path.basename(file));
            } else {
                // Legacy data without an index.json — fall back to globbing.
                jsonFiles = fs.readdirSync(localePath)
                    ?.filter((file) => file?.endsWith(".json") && file !== MIGRATION_DATA_CONFIG.ENTRIES_MASTER_FILE);
            }

            for (const jsonFile of jsonFiles) {
                const filePath = path.join(localePath, jsonFile);
                const raw = fs.readFileSync(filePath, "utf-8");
                const data = JSON.parse(raw);

                let modified = false;
                for (const key of Object?.keys(data)) {
                    if (sitecoreUids.has(key)) {
                        const csEntryUid = csUidByOtherCmsUid.get(key);
                        // No Contentstack entry uid → this entry was never migrated, so leave it in
                        // the import data to be CREATED this iteration. Deleting it would silently
                        // drop the entry (data loss).
                        if (!csEntryUid) {
                            continue;
                        }

                        // Look up the entry_mapper row for THIS source-locale variant. Same source
                        // entry has separate rows for each source locale; `isUpdate` is per-row.
                        const row = sourceLocale
                            ? rowByUidAndLang.get(`${key}::${sourceLocale}`)
                            : undefined;
                        if (row?.isUpdate) {
                            const entryData = { ...data[key], __locale: localeCode, __csUid: csEntryUid };
                            delete entryData?.uid;

                            if (!entriesToUpdate[contentTypeName]) {
                                entriesToUpdate[contentTypeName] = {};
                            }
                            entriesToUpdate[contentTypeName][`${csEntryUid}::${localeCode}`] = entryData;
                            writeLogEntry(`Collected update entry "${csEntryUid}" (locale "${localeCode}") for content type "${contentTypeName}"`, "removeEntriesFromDatabase", loggerPath);
                            writeLogEntry(`Entry "${key}" has been prepared for update in Contentstack as "${csEntryUid}" (locale "${localeCode}")`, "removeEntriesFromDatabase", loggerPath);
                        }

                        // Existing entry → remove from import data so it is NOT re-created.
                        delete data[key];
                        modified = true;
                        writeLogEntry(`Removed entry "${key}" from ${filePath}`, "removeEntriesFromDatabase", loggerPath);
                        writeLogEntry(`Entry "${key}" has been removed from migration data (exists in Contentstack)`, "removeEntriesFromDatabase", loggerPath);
                    }
                }

                if (modified) {
                    fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
                }
            }
        }
    }

    const configDir = path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId, iteration.toString());
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, DATABASE_FILES.UPDATED_ENTRIES);
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
    const dbBase = path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId);

    let oldAssetMapping: Record<string, string> = {};
    if (iteration > 1) {
        const oldPath = path.join(dbBase, (iteration - 1).toString(), DATABASE_FILES.UID_MAPPER);
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
    const newPath = path.join(dbBase, iteration.toString(), DATABASE_FILES.UID_MAPPER);
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