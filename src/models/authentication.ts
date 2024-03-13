// src/models/Authentication.ts
import { JSONFileSyncPreset } from "lowdb/node";

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

export default JSONFileSyncPreset<AuthenticationDocument>(
  "database/authentication.json",
  defaultData
);
