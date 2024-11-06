import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import path from "path";

/**
 * Represents the advanced configuration options for a field mapper.
 */
interface Advanced {
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
  options: any[];
}

/**
 * Represents a field mapper object.
 */
interface FieldMapper {
  field_mapper: {
    id: string;
    projectId: string;
    uid: string;
    otherCmsField: string;
    otherCmsType: string;
    contentstackField: string;
    contentstackFieldUid: string;
    contentstackFieldType: string;
    isDeleted: boolean;
    backupFieldType: string;
    refrenceTo: { uid: string; title: string };
    advanced: Advanced;
  }[];
}

const defaultData: FieldMapper = { field_mapper: [] };

/**
 * Represents the database instance for the FieldMapper model.
 */
const db = new LowWithLodash(
  new JSONFile<FieldMapper>(path.join(process.cwd(), "database", "field-mapper.json")),
  defaultData
);

export default db;
