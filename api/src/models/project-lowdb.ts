import path from 'path';
import { JSONFile } from 'lowdb/node';
import LowWithLodash from '../utils/lowdb-lodash.utils.js';
import { DATABASE_FILES } from '../constants/index.js';

/**
 * Represents the LegacyCMS object.
 */
interface LegacyCMS {
  cms: string;
  affix: string;
  affix_confirmation: boolean;
  file_format: string;
  file_format_confirmation: boolean;
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    path: string;
  };
  awsDetails: {
    awsRegion: string;
    bucketName: string;
    bucketKey: string;
  };
  file_path: string;
  is_fileValid: boolean;
  is_localPath: boolean;
  source_details?: {
    source_mode: 'credentials' | 'imported_export';
    source_region_id: string;
    source_org_id: string;
    source_stack_id: string;
    source_branch: string;
    imported_data_path: string;
    exported_at?: string;
    export_path?: string;
  };
  audit?: {
    generated_at?: string;
    summary?: {
      unused_assets?: number;
      unpublished_entries?: number;
      empty_content_types?: number;
      unused_global_fields?: number;
    };
    is_mapper_generated?: boolean;
    excludedItems?: Array<{
      uid: string;
      type: string;
      contentType?: string;
      locale?: string;
    }>;
    selectionStats?: {
      totalItems: number;
      selectedItems: number;
      excludedItems: number;
    };
  };
  validation?: {
    isValid?: boolean;
    missing?: string[];
    message?: string;
  };
}

/**
 * Represents an execution log.
 */
interface ExecutionLog {
  log_url: string;
  date: Date;
}

/**
 * Represents a project.
 */
interface Project {
  id: string;
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  updated_by: string;
  former_owner_ids: [];
  name: string;
  description: string;
  status: number;
  current_step: number;
  destination_stack_id: string;
  test_stacks: [];
  current_test_stack_id: string;
  legacy_cms: LegacyCMS;
  content_mapper: any[];
  execution_log: [ExecutionLog];
  created_at: string;
  updated_at: string;
  isDeleted: boolean;
  isNewStack: boolean;
  newStackId: string;
  stackDetails: [];
  mapperKeys: object;
  extract_path: string;
  source_locales?: Array<{
    label: string;
    value: string;
    uid: string;
    code: string;
    name: string;
  }>;
  isMigrationStarted: boolean;
  isMigrationCompleted: boolean;
  migration_execution: boolean;
  taxonomies?: any[];
  isSSO: boolean;
  iteration: number;
  master_locale?: Record<string, string>;
  locales?: Record<string, string>;
  source_locales?: string[];
  migrated_locales?: string[];
}

interface  ProjectDocument {
  projects: Project[];
}

const defaultData: ProjectDocument = { projects: [] };

/**
 * Represents the database instance for the project.
 */
const db = new LowWithLodash(
  new JSONFile<ProjectDocument>(
    path.join(process.cwd(), DATABASE_FILES.DIRECTORY, DATABASE_FILES.PROJECT),
  ),
  defaultData,
);

export default db;
