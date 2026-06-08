// src/models/Authentication.ts
import path from 'path';
import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
import { DATABASE_FILES } from "../constants/index.js";
/**
 * Represents the authentication document.
 */
interface AuthenticationDocument {
  users: {
    user_id: string;
    email: string;
    region: string;
    authtoken: string;
    created_at: string;
    updated_at: string;
    access_token: string;
    /**
     * Stack-to-stack migration: persisted regional source-login session.
     * Replaces the prior sessionStorage-based UI store so the source app
     * token never lives in browser storage and survives across sessions.
     */
    source_session?: {
      region: string;
      appToken: string;
    };
  }[];
}

const defaultData: AuthenticationDocument = { users: [] };

/**
 * Represents the database instance for authentication data.
 */
const db = new LowWithLodash(
  new JSONFile<AuthenticationDocument>(path.join(process.cwd(), DATABASE_FILES.DIRECTORY, DATABASE_FILES.AUTHENTICATION)),
  defaultData
);

export default db;