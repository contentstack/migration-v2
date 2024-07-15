// src/models/Authentication.ts

import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";

/**
 * Represents the structure of the authentication document.
 */
interface AuthenticationDocument {
  users: {
    user_id: string;
    region: string;
    authtoken: string;
    created_at: string;
    updated_at: string;
  }[];
}

/**
 * Represents the default data for the authentication document.
 */
const defaultData: AuthenticationDocument = { users: [] };

/**
 * Represents the database instance for the authentication document.
 */
const db = new LowWithLodash(
  new JSONFile<AuthenticationDocument>("database/authentication.json"),
  defaultData
);

export default db;
