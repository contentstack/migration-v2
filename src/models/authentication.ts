// src/models/Authentication.ts
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import lodash from "lodash";

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this["data"]> = lodash.chain(this).get("data");
}

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
