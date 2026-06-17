import path from "path";
import { DATABASE_FILES } from "../constants";
import getUidMapperDb from "../models/uidMapper";
import customLogger from "./custom-logger.utils";
import fs from "fs";
import projectModelLowdb from "../models/project-lowdb";

/**
 * Merges a previous iteration's uid map under the current run's map (current
 * wins on conflict). Values can be plain strings (flat old→new maps) or
 * one-level nested objects (per-content-type entry maps) — nested objects are
 * merged key-wise so a partial current map doesn't clobber a content type's
 * previously known uids.
 */
const mergeUidMaps = (
  prev: Record<string, any>,
  current: Record<string, any>,
): Record<string, any> => {
  const merged: Record<string, any> = { ...(prev || {}) };
  for (const [key, value] of Object.entries(current || {})) {
    const existing = merged[key];
    if (
      value && typeof value === "object" && !Array.isArray(value) &&
      existing && typeof existing === "object" && !Array.isArray(existing)
    ) {
      merged[key] = { ...existing, ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
};

const writeUidMapping = async (
  backupPath: string,
  projectId: string,
  iteration: number,
) => {
  try {
    await projectModelLowdb.read();
    const projectData = projectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const destinationStackId = projectData?.destination_stack_id;
    const assetMapperPath = path.join(
      backupPath,
      "mapper",
      "assets",
      "uid-mapping.json",
    );
    let assetJson = {};

    // Check if file exists and has meaningful data
    if (fs.existsSync(assetMapperPath)) {
      const assetData = fs.readFileSync(assetMapperPath, "utf-8");
      const parsedData = JSON.parse(assetData);
      // Check if data is not empty
      if (parsedData && Object?.keys(parsedData)?.length > 0) {
        assetJson = parsedData;
      }
      await customLogger(
        projectId,
        destinationStackId,
        "info",
        `Asset UID mapping data read successfully from ${assetMapperPath}`,
      );
    }

    const entryMapperPath = path.join(
      backupPath,
      "mapper",
      "entries",
      "uid-mapping.json",
    );
    let entryJson = {};

    // Check if file exists and has meaningful data
    if (fs.existsSync(entryMapperPath)) {
      const entryData = fs.readFileSync(entryMapperPath, "utf-8");
      const parsedData = JSON.parse(entryData);
      // Check if data is not empty
      if (parsedData && Object?.keys(parsedData)?.length > 0) {
        entryJson = parsedData;
      }
      await customLogger(
        projectId,
        destinationStackId,
        "info",
        `Entry UID mapping data read successfully from ${entryMapperPath}`,
      );
    }

    // Carry the previous iteration's mappings forward under the current run's
    // (current wins on conflict). The CLI only maps what it imported this run —
    // deduped assets and updated entries are absent — so without this merge
    // delta matching would only survive a single iteration.
    if (iteration > 1) {
      const prevMapperPath = path.join(
        process.cwd(),
        DATABASE_FILES.DIRECTORY,
        projectId,
        (iteration - 1).toString(),
        DATABASE_FILES.UID_MAPPER,
      );
      if (fs.existsSync(prevMapperPath)) {
        const prevData = JSON.parse(fs.readFileSync(prevMapperPath, "utf-8"));
        assetJson = mergeUidMaps(prevData?.assets || {}, assetJson);
        entryJson = mergeUidMaps(prevData?.entry || {}, entryJson);
        await customLogger(
          projectId,
          destinationStackId,
          "info",
          `Merged previous iteration uid mappings from ${prevMapperPath}`,
        );
      }
    }

    const combinedMapping = {
      assets: assetJson,
      entry: entryJson,
    };
    const UidMapperModelLowdb = getUidMapperDb(projectId, iteration);
    await UidMapperModelLowdb.read();
    UidMapperModelLowdb.data = combinedMapping;
    await UidMapperModelLowdb.write();
    await customLogger(
      projectId,
      destinationStackId,
      "info",
      "UID mapping data written successfully to Lowdb",
    );
  } catch (error) {
    console.error("Error writing UID mapping file:", error);
  }
};

/**
 * Walk the CLI's per-locale entry mapper output and merge a
 * `entryByLocale: { [destLocale]: { [sourceUid]: destUid } }` map into the
 * project's uid-mapper lowdb. Leaves the flat `entry` / `assets` maps untouched.
 *
 * CLI layout this reads from:
 *   <backupPath>/mapper/entries/uid-mapping.json                 (flat lookup)
 *   <backupPath>/mapper/entries/<contentType>/<locale>/index.json
 *   <backupPath>/mapper/entries/<contentType>/<locale>/<uuid>-entries.json
 *   <backupPath>/mapper/entries/<contentType>/<locale>/existing/index.json
 *   <backupPath>/mapper/entries/<contentType>/<locale>/existing/<uuid>-entries.json
 *
 * Files that are missing or malformed are skipped silently — this is best-effort
 * enrichment and must never block the main mapping write.
 */
export const writePerLocaleEntryUidMapping = async (
  backupPath: string,
  projectId: string,
  iteration: number,
): Promise<void> => {
  try {
    await projectModelLowdb.read();
    const projectData = projectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const destinationStackId = projectData?.destination_stack_id;

    const entriesRoot = path.join(backupPath, "mapper", "entries");
    if (!fs.existsSync(entriesRoot)) return;

    // Flat source → dest lookup from the CLI's top-level uid-mapping.json. Used to fill
    // dest uids for source uids we discover under each locale directory.
    const flatMappingPath = path.join(entriesRoot, "uid-mapping.json");
    let flatMap: Record<string, string> = {};
    if (fs.existsSync(flatMappingPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(flatMappingPath, "utf-8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          flatMap = parsed as Record<string, string>;
        }
      } catch {
        /* malformed top-level mapping; per-locale map will be empty values */
      }
    }

    const isDir = (p: string): boolean => {
      try { return fs.statSync(p).isDirectory(); } catch { return false; }
    };
    const readJson = (p: string): any => {
      try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
    };

    // Extract source uids from a chunk-index style file ({ "1": "<uuid>-entries.json", ... }).
    const collectSourceUidsFromLocaleDir = (localeDir: string): string[] => {
      const sourceUids: string[] = [];
      const visit = (indexPath: string, base: string): void => {
        const idx = readJson(indexPath);
        if (!idx || typeof idx !== "object" || Array.isArray(idx)) return;
        for (const file of Object.values(idx as Record<string, unknown>)) {
          if (typeof file !== "string" || !file.endsWith(".json")) continue;
          const chunkPath = path.join(base, path.basename(file));
          const chunk = readJson(chunkPath);
          if (chunk && typeof chunk === "object" && !Array.isArray(chunk)) {
            sourceUids.push(...Object.keys(chunk));
          }
        }
      };
      visit(path.join(localeDir, "index.json"), localeDir);
      const existingDir = path.join(localeDir, "existing");
      if (isDir(existingDir)) {
        visit(path.join(existingDir, "index.json"), existingDir);
      }
      return sourceUids;
    };

    const entryByLocale: Record<string, Record<string, string>> = {};

    for (const ctName of fs.readdirSync(entriesRoot)) {
      const ctPath = path.join(entriesRoot, ctName);
      if (!isDir(ctPath)) continue;
      for (const localeName of fs.readdirSync(ctPath)) {
        const localePath = path.join(ctPath, localeName);
        if (!isDir(localePath)) continue;
        const sourceUids = collectSourceUidsFromLocaleDir(localePath);
        if (!sourceUids?.length) continue;
        if (!entryByLocale[localeName]) entryByLocale[localeName] = {};
        for (const srcUid of sourceUids) {
          const destUid = flatMap[srcUid];
          if (destUid) entryByLocale[localeName][srcUid] = destUid;
        }
      }
    }

    if (!Object?.keys(entryByLocale)?.length) return;

    const UidMapperModelLowdb = getUidMapperDb(projectId, iteration);
    await UidMapperModelLowdb.read();
    // Merge into any existing per-locale map rather than overwriting, so a follow-up
    // import that touches only one locale doesn't wipe the others.
    const existing: Record<string, Record<string, string>> =
      (UidMapperModelLowdb.data as any)?.entryByLocale ?? {};
    const merged: Record<string, Record<string, string>> = { ...existing };
    for (const [loc, m] of Object.entries(entryByLocale)) {
      merged[loc] = { ...(existing[loc] ?? {}), ...m };
    }
    (UidMapperModelLowdb.data as any).entryByLocale = merged;
    await UidMapperModelLowdb.write();
    await customLogger(
      projectId,
      destinationStackId,
      "info",
      `Per-locale entry uid mapping written for locales: ${Object.keys(merged).join(", ")}`,
    );
  } catch (error) {
    console.error("Error writing per-locale uid mapping:", error);
  }
};

export default writeUidMapping;
