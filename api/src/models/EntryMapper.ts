import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import path from "path";
import fs from 'node:fs';

/**
 * Represents the advanced configuration options for a field mapper.
 */
export interface Advanced {
  validationRegex: string;
  mandatory: boolean;
  multiple: boolean;
  unique: boolean;
  nonLocalizable: boolean;
  embedObject: boolean;
  embedObjects: any;
  minChars: string;
  maxChars: number;
  default_value: string;
  description: string;
  validationErrorMessage: string;
  options: any[];
}

/**
 * Represents an entry mapper object.
 */
interface EntryMapper {
  entry_mapper: {
    contentTypeUid: string;
    entryName: string;
    otherCmsEntryUid: string;
    isUpdate: boolean;
  }[];
}

const defaultData: EntryMapper = { entry_mapper: [] };

/**
 * Creates and returns a database instance for the field mapper for a specific project.
 * @param projectId - The unique identifier of the project
 * @returns The database instance for the field mapper
 */
const getEntryMapperDb = (projectId: string, iteration: number) => {
  fs.mkdirSync(path.join(process.cwd(), "database", projectId), { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<EntryMapper>(
      path.join(process.cwd(), "database", projectId, iteration.toString(), 'entry-mapper.json')
    ),
    defaultData
  );
  return db;
};

export default getEntryMapperDb;
