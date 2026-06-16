import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import path from "path";
import fs from 'node:fs';
import { DATABASE_FILES } from "../constants/index.js";

/**
 * Represents an entry mapper object.
 */
interface EntryMapper {
  entry: Record<string, any>;
  assets: Record<string, any>;
  /**
   * Per-locale entry uid mapping. Source uid → destination uid, scoped by destination
   * locale code. Populated by writePerLocaleEntryUidMapping after each CLI import so the
   * delta flow can tell which entries actually have a variant in a given locale.
   */
  entryByLocale?: Record<string, Record<string, string>>;
}

const defaultData: EntryMapper = { entry: {}, assets: {}, entryByLocale: {} };

/**
 * Creates and returns a database instance for the field mapper for a specific project.
 * @param projectId - The unique identifier of the project
 * @returns The database instance for the field mapper
 */
const getUidMapperDb = (projectId: string, iteration: number) => {
  fs.mkdirSync(path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId, iteration.toString()), { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<EntryMapper>(
      path.join(process.cwd(), DATABASE_FILES.DIRECTORY, projectId, iteration.toString(), DATABASE_FILES.UID_MAPPER)
    ),
    defaultData
  );
  return db;
};

export default getUidMapperDb;
