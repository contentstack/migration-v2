import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

/**
 * Represents the advanced configuration options for a field mapper.
 */
interface Advanced {
  validationRegex: string;
  Mandatory: boolean;
  Multiple: boolean;
  Unique: boolean;
  NonLocalizable: boolean;
  EmbedObject: boolean;
  EmbedObjects:any;
  MinChars: string;
  MaxChars: number;
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
    ContentstackFieldType: string;
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
  new JSONFile<FieldMapper>("database/field-mapper.json"),
  defaultData
);

export default db;
