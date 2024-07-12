import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

/**
 * Represents a content type mapper.
 */
export interface ContentTypesMapper {
  id: string;
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  updateAt: Date;
  contentstackTitle: string;
  contentstackUid: string;
  status: number;
  fieldMapping: [];
}


// interface ContentTypesMapper {
//   id: string;
//   projectId: string;
//   contentTypes: [contentTypes];
// }

/**
 * Represents a content type mapper document.
 */
interface ContentTypeMapperDocument {
  ContentTypesMappers: ContentTypesMapper[];
}

/**
 * Default data for the ContentTypeMapperDocument.
 */
const defaultData: ContentTypeMapperDocument = { ContentTypesMappers: [] };

/**
 * Represents the database instance for the content types mapper.
 */
const db = new LowWithLodash(
  new JSONFile<ContentTypeMapperDocument>("database/contentTypesMapper.json"),
  defaultData
);

export default db;
