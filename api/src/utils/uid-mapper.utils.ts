import path from "path";
import { DATABASE_FILES } from "../constants";
import getUidMapperDb from "../models/uidMapper";
import customLogger from "./custom-logger.utils";
import fs from "fs";
import projectModelLowdb from "../models/project-lowdb";

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

    // If no meaningful data found and we have previous iteration, use fallback
    if (Object?.keys(assetJson)?.length === 0 && iteration > 1) {
      const prevAssetMapperPath = path.join(
        process.cwd(),
        DATABASE_FILES.DIRECTORY,
        projectId,
        (iteration - 1).toString(),
        DATABASE_FILES.UID_MAPPER,
      );
      if (fs.existsSync(prevAssetMapperPath)) {
        const prevData = JSON.parse(
          fs.readFileSync(prevAssetMapperPath, "utf-8"),
        );
        assetJson = prevData?.assets || {};
      }
      await customLogger(
        projectId,
        destinationStackId,
        "info",
        `Using previous iteration data for assets from ${prevAssetMapperPath}: ${JSON.stringify(
          assetJson,
        )}`,
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

      // If no meaningful data found and we have previous iteration, use fallback
      if (Object?.keys(entryJson)?.length === 0 && iteration > 1) {
        const prevEntryMapperPath = path.join(
          process.cwd(),
          DATABASE_FILES.DIRECTORY,
          projectId,
          (iteration - 1).toString(),
          DATABASE_FILES.UID_MAPPER,
        );
        if (fs.existsSync(prevEntryMapperPath)) {
          const prevData = JSON.parse(
            fs.readFileSync(prevEntryMapperPath, "utf-8"),
          );
          await customLogger(
          projectId,
          destinationStackId,
          "info",
          `Using previous iteration data for entries from ${prevEntryMapperPath}: ${JSON.stringify(
            entryJson,
          )}`,
        );
          entryJson = prevData?.entry || {};
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
    }
  } catch (error) {
    console.error("Error writing UID mapping file:", error);
  }
};

export default writeUidMapping;
