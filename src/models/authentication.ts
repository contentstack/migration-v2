// src/models/Authentication.ts
import { JSONFile } from "lowdb/node";
import LowWithLodash from "../utils/lowdb-lodash.utils.js";
interface AuthenticationDocument {
  users: {
    user_id: string;
    region: string;
    authtoken: string;
    created_at: string;
    updated_at: string;
  }[];
}

const defaultData: AuthenticationDocument = { users: [] };

const db = new LowWithLodash(
  new JSONFile<AuthenticationDocument>("database/authentication.json"),
  defaultData
);

export default db;
