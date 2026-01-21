import { JSONFile } from "lowdb/node";
import path from 'node:path';
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import fs from 'node:fs';

/**
 * Represents a content type mapper.
 */
export interface ContentTypesMapper {
  /**
   * The unique identifier of the content type mapper.
   */
  id: string;

  /**
   * The unique identifier of the project.
   */
  projectId: string;

  /**
   * The title of the content type in the other CMS.
   */
  otherCmsTitle: string;

  /**
   * The unique identifier of the content type in the other CMS.
   */
  otherCmsUid: string;

  /**
   * Indicates whether the content type has been updated.
   */
  isUpdated: boolean;

  /**
   * The date when the content type was last updated.
   */
  updateAt: Date;

  /**
   * The title of the content type in Contentstack.
   */
  contentstackTitle: string;

  /**
   * The unique identifier of the content type in Contentstack.
   */
  contentstackUid: string;

  /**
   * The status of the content type.
   */
  status: number;

  /**
   * The field mapping for the content type.
   */
  fieldMapping: [];

  /**
   * The type of the content type.
   */
  type: string;
}

// interface ContentTypesMapper {
//   id: string;
//   projectId: string;
//   contentTypes: [contentTypes];
// }

/**
 * Represents a document containing content type mappers.
 */
interface ContentTypeMapperDocument {
  ContentTypesMappers: ContentTypesMapper[];
}

const defaultData: ContentTypeMapperDocument = { ContentTypesMappers: [] };

/**
 * Creates and returns a database instance for the content types mapper for a specific project.
 * @param projectId - The unique identifier of the project
 * @returns The database instance for the content types mapper
 */
export const getContentTypesMapperDb = (projectId: string, iteration: number) => {    
  fs.mkdirSync(path.join(process.cwd(), "database", projectId, iteration.toString()), { recursive: true });
  const db = new LowWithLodash(
    new JSONFile<ContentTypeMapperDocument>(
      path.join(process.cwd(), "database", projectId, iteration.toString(), 'contentTypesMapper.json'),
    ),
    defaultData
  );
  return db;
};

// For backward compatibility, export a default function that requires projectId
export default getContentTypesMapperDb;
