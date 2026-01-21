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
 * Represents a field mapper object.
 */
interface FieldMapper {
  field_mapper: {
    id: string;
    projectId: string;
    contentTypeId: string;
    uid: string;
    otherCmsField: string;
    otherCmsType: string;
    contentstackField: string;
    contentstackFieldUid: string;
    contentstackFieldType: string;
    isDeleted: boolean;
    backupFieldType: string;
    backupFieldUid: string
    refrenceTo: { uid: string; title: string };
    advanced: Advanced;
  }[];
}

const defaultData: FieldMapper = { field_mapper: [] };

/**
 * Creates and returns a database instance for the field mapper for a specific project.
 * @param projectId - The unique identifier of the project
 * @returns The database instance for the field mapper
 */
const getFieldMapperDb = (projectId: string, iteration: number) => {
  fs.mkdirSync(path.join(process.cwd(), "database", projectId), { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<FieldMapper>(
      path.join(process.cwd(), "database", projectId, iteration.toString(), 'field-mapper.json')
    ),
    defaultData
  );
  return db;
};

export default getFieldMapperDb;
