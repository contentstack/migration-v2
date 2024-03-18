import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

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
}

interface ExecutionLog {
  log_url: string;
  date: Date;
}

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
  status: string;
  current_step: number;
  destination_stack_id: string;
  legacy_cms: LegacyCMS;
  content_mapper: [];
  execution_log: [ExecutionLog];
  created_at: string;
  updated_at: string;
}

interface ProjectDocument {
  projects: Project[];
}

const defaultData: ProjectDocument = { projects: [] };

const db = new LowWithLodash(
  new JSONFile<ProjectDocument>("database/project.json"),
  defaultData
);

export default db;
