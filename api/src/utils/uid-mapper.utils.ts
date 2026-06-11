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

export default writeUidMapping;
