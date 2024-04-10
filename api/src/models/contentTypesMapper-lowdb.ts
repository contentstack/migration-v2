import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

interface ContentTypesMapper {
  id: string;
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  updateAt: Date;
  contentstackTitle: string;
  contentstackUid: string;
  fieldMapping: [];
}

// interface ContentTypesMapper {
//   id: string;
//   projectId: string;
//   contentTypes: [contentTypes];
// }

interface ContentTypeMapperDocument {
  ContentTypesMappers: ContentTypesMapper[];
}

const defaultData: ContentTypeMapperDocument = { ContentTypesMappers: [] };

const db = new LowWithLodash(
  new JSONFile<ContentTypeMapperDocument>("database/contentTypesMapper.json"),
  defaultData
);

export default db;
