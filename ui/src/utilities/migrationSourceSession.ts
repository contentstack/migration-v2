/**
 * Regional source-login session for stack-to-stack migration.
 *
 * The source app token is persisted on the backend user record (see
 * `/v2/user/source-session`) so it never lives in browser storage and
 * survives across browser sessions. All callers must `await` these.
 */
import {
  fetchSourceSession,
  removeSourceSession,
  saveSourceSession
} from '../services/api/user.service';

export async function setMigrationSourceSession(
  region: string,
  appToken: string
): Promise<void> {
  if (!region || !appToken) return;
  await saveSourceSession(region.trim(), appToken);
}

export async function getMigrationSourceSession(): Promise<{
  region: string;
  appToken: string;
} | null> {
  const rec = await fetchSourceSession();
  if (!rec?.appToken || !rec?.region) return null;
  return { region: rec.region, appToken: rec.appToken };
}

export async function clearMigrationSourceSession(): Promise<void> {
  await removeSourceSession();
}
