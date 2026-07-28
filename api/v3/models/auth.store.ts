import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

/**
 * Read-only accessor for the SHARED auth store (`database/authentication.json`)
 * that the shared login writes. v3 READS it (session data, not v2 code) to get
 * the Contentstack credential for the logged-in user. v3 never writes it.
 * Path overridable via V3_AUTH_STORE (used by tests).
 */
interface AuthUser {
  user_id: string;
  email: string;
  region: string;
  authtoken: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}

interface AuthDocument {
  users: AuthUser[];
}

const storePath = process.env.V3_AUTH_STORE
  ? path.resolve(process.env.V3_AUTH_STORE)
  : path.join(process.cwd(), "database", "authentication.json");

const db = new Low<AuthDocument>(new JSONFile<AuthDocument>(storePath), {
  users: [],
});

const findUser = async (
  region: string,
  userId: string
): Promise<AuthUser | undefined> => {
  await db.read();
  return db.data.users.find(
    (u) => u.region === region && u.user_id === userId
  );
};

/** CS authtoken for a non-SSO user, or null if absent. */
export const getAuthtoken = async (
  region: string,
  userId: string
): Promise<string | null> => (await findUser(region, userId))?.authtoken ?? null;

/** CS OAuth access token for an SSO user, or null if absent. */
export const getAccessToken = async (
  region: string,
  userId: string
): Promise<string | null> =>
  (await findUser(region, userId))?.access_token ?? null;
