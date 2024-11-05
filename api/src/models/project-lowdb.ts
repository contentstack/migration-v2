import path from 'path';
import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

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
    buketKey: string;
  };
  file_path: string;
  is_fileValid: boolean;
  is_localPath: boolean;
}

interface StackDetails {
  uid: string;
  label: string;
  master_locale: string;
  created_at: string;
  isNewStack: boolean;
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
  mapperKeys: {};
  extract_path: string;
  isMigrationStarted: boolean;
}

interface ProjectDocument {
  projects: Project[];
}

const defaultData: ProjectDocument = { projects: [] };

/**
 * Represents the database instance for the project.
 */
const db = new LowWithLodash(
  new JSONFile<ProjectDocument>(path.join(process.cwd(), "database/project.json")),
  defaultData
);

export default db;
