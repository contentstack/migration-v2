import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

/**
 * Accessor for the SHARED auth store (`database/authentication.json`) that the
 * shared (v2) login writes for the user's home-region session. v3 normally only
 * READS it (session data, not v2 code) to get the Contentstack credential for
 * the logged-in user.
 *
 * The one exception is cross-region source authentication (FR — region-login):
 * when a user picks a Source region other than their home-region session, v3
 * performs its own real Contentstack login for that region (own standalone call
 * to the CS Management API — not via v2 code) and writes the resulting
 * credential into this SAME shared store, keyed by (region, user_id), using the
 * identical row shape v2 writes. This keeps a single source of truth for CS
 * credentials across both v2 and v3 rather than forking a parallel store.
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

/**
 * Persists a non-SSO Contentstack credential for (region, userId) — used by
 * the region-login flow (a real CS `/user-session` login for a region other
 * than the user's home-region session). Upserts in place; never removes an
 * existing row for a different region/user.
 */
export const saveAuthtoken = async (
  region: string,
  userId: string,
  email: string,
  authtoken: string
): Promise<void> => {
  await db.read();
  const nowIso = new Date().toISOString();
  const existing = db.data.users.find(
    (u) => u.region === region && u.user_id === userId
  );
  if (existing) {
    existing.authtoken = authtoken;
    existing.email = email;
    existing.updated_at = nowIso;
  } else {
    db.data.users.push({
      region,
      user_id: userId,
      email,
      authtoken,
      access_token: "",
      created_at: nowIso,
      updated_at: nowIso,
    });
  }
  await db.write();
};
