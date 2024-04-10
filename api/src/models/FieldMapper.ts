import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

interface FieldMapper {
  field_mapper: {
    id: string;
    uid: string;
    otherCmsField: string;
    otherCmsType: string;
    contentstackField: string;
    contentstackFieldUid: string;
    ContentstackFieldType: string;
    isDeleted: boolean;
    backupFieldType: string;
    refrenceTo: { uid: string; title: string };
  }[];
}

const defaultData: FieldMapper = { field_mapper: [] };

const db = new LowWithLodash(
  new JSONFile<FieldMapper>("database/field-mapper.json"),
  defaultData
);

export default db;
