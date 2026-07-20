import fs from 'fs';
import path from 'path';

export interface DocRef {
  apiKey: string; // resolved from the record's __itemTypeId
  uid: string; // toEntryUid(record.id)
}

export interface Counters {
  assetsSkipped: number;
  groupsSkipped: number;
  blocksSkipped: number;
  structuredTextNodesSkipped: number;
}

export const newCounters = (): Counters => ({
  assetsSkipped: 0,
  groupsSkipped: 0,
  blocksSkipped: 0,
  structuredTextNodesSkipped: 0,
});

/**
 * Resolve the DatoCMS export root — the directory directly containing
 * `content_types.json` / `fields.json` / `records.json` / `assets.json` /
 * `assets/`. Tries `file_path` first, then `packagePath` (the archive vs
 * extracted-dir split described in reference/entry-creation.md), BFS-walking
 * each candidate for `content_types.json` before accepting it as the root.
 */
export function resolveExportRoot(filePath: string, packagePath?: string): string {
  const candidates = [filePath, packagePath].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const found = findRootUnder(candidate);
    if (found) return found;
  }
  throw new Error(
    `Could not locate a DatoCMS export root (content_types.json) under file_path="${filePath}" or packagePath="${packagePath}"`,
  );
}

function findRootUnder(input: string): string | null {
  if (!fs.existsSync(input)) return null;
  const stat = fs.statSync(input);
  const start = stat.isDirectory() ? input : path.dirname(input);

  const queue: string[] = [start];
  while (queue.length) {
    const dir = queue.shift() as string;
    if (fs.existsSync(path.join(dir, 'content_types.json'))) return dir;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push(path.join(dir, entry.name));
    }
  }
  return null;
}

export function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** id -> api_key for every DatoCMS content type (entry-level AND block-level). */
export function buildApiKeyById(root: string): Record<string, string> {
  const contentTypes: any[] = readJson(path.join(root, 'content_types.json'));
  const map: Record<string, string> = {};
  contentTypes.forEach((ct) => {
    map[ct.id] = ct.api_key;
  });
  return map;
}

// Contentstack entry uids are hyphen-free; DatoCMS ids are already unique and
// stable, so a straight alnum-only strip keeps them deterministic across runs.
export const toEntryUid = (id: string): string => String(id).replace(/[^a-zA-Z0-9]/g, '');

/** Last segment of a dotted field uid — group/global-field children are stored under it. */
export const getLastUid = (uid: string): string => {
  const parts = String(uid).split('.');
  return parts[parts.length - 1];
};

/** Max nested-group/global-field recursion. Keep in sync with the parser's MAX_GROUP_DEPTH. */
export const MAX_GROUP_DEPTH = 5;

/**
 * Direct children of a (group / modular-blocks / global-field) row from the
 * flat fieldMapping: prefix + exactly-one-level match on contentstackFieldUid,
 * with backupFieldUid fallback for UI-remapped parents.
 */
export function directChildren(field: any, allFields: any[], csType?: string): any[] {
  const parentUid = field?.contentstackFieldUid || '';
  const oldUid = field?.backupFieldUid || '';
  return (allFields ?? []).filter((f: any) => {
    const fUid = f?.contentstackFieldUid || '';
    if (!fUid || f?.isDeleted) return false;
    if (csType && f?.contentstackFieldType !== csType) return false;
    for (const p of [parentUid, oldUid]) {
      if (p && fUid.startsWith(p + '.')) {
        const rest = fUid.substring(p.length + 1);
        if (rest && !rest.includes('.')) return true; // exactly one level deeper
      }
    }
    return false;
  });
}
