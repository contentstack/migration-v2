import path from 'path';
import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

/**
 * Represents an org plan finder entry that stores the complete API response.
 */
export interface OrgPlanEntry {
  org_uid: string;
  region: string;
  authtoken: string;
  organization_response: any; // Complete API response from Contentstack
  fetched_at: string;
  isDeleted?: boolean;
}

/**
 * Represents the document structure for org plan finder.
 */
interface OrgPlanFinderDocument {
  org_plans: OrgPlanEntry[];
}

const defaultData: OrgPlanFinderDocument = { org_plans: [] };

/**
 * Represents the database instance for the org plan finder.
 */
const db = new LowWithLodash(
  new JSONFile<OrgPlanFinderDocument>(path.join(process.cwd(), "database", "org-plan-finder.json")),
  defaultData
);

export default db;
