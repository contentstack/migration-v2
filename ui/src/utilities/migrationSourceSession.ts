const KEY_TOKEN = 'migration_source_app_token';
const KEY_REGION = 'migration_source_region_id';

export function setMigrationSourceSession(region: string, appToken: string): void {
  try {
    sessionStorage.setItem(KEY_TOKEN, appToken);
    sessionStorage.setItem(KEY_REGION, region.trim());
  } catch {
    /* ignore */
  }
}

export function getMigrationSourceSession(): { region: string; appToken: string } | null {
  try {
    const appToken = sessionStorage.getItem(KEY_TOKEN) || '';
    const region = sessionStorage.getItem(KEY_REGION) || '';
    if (!appToken || !region) return null;
    return { region, appToken };
  } catch {
    return null;
  }
}

export function clearMigrationSourceSession(): void {
  try {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_REGION);
  } catch {
    /* ignore */
  }
}
