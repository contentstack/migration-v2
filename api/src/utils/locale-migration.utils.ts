import ProjectModel from '../models/project-lowdb.js';

interface ProjectLike {
  iteration?: number;
  master_locale?: Record<string, string>;
  locales?: Record<string, string>;
  migrated_locales?: string[];
}

/**
 * Returns every destination locale code mapped on the project (master + additional).
 */
export const getAllMappedLocales = (project: ProjectLike): string[] => {
  const master = Object.keys(project?.master_locale ?? {});
  const additional = Object.keys(project?.locales ?? {});
  return Array.from(new Set([...master, ...additional]));
};

/**
 * Map a destination locale code (e.g. "en-in") to its source locale code
 * (e.g. "en-IN") via the project's master_locale + locales lookup. Returns
 * null if the destination locale isn't mapped on the project.
 */
export const getSourceLocaleForDestination = (
  project: ProjectLike,
  destLocale: string,
): string | null => {
  if (!destLocale) return null;
  if (project?.master_locale && destLocale in project.master_locale) {
    return project.master_locale[destLocale];
  }
  if (project?.locales && destLocale in project.locales) {
    return project.locales[destLocale];
  }
  return null;
};

/**
 * Returns the project's migrated_locales, lazily backfilling for projects that
 * finished a migration before this field existed. For iteration > 1 with no
 * migrated_locales recorded, assume every currently-mapped locale was migrated
 * previously (so they take the delta path, not a surprise re-run).
 */
export const getMigratedLocales = (project: ProjectLike): string[] => {
  if (Array.isArray(project?.migrated_locales)) {
    return project.migrated_locales as string[];
  }
  if ((project?.iteration ?? 1) > 1) {
    return getAllMappedLocales(project);
  }
  return [];
};

/**
 * True when this locale should run a full migration on the current run.
 * That happens when: this is the first iteration overall, OR this is a
 * restart but the locale has no prior migration record (newly-added locale).
 */
export const isFullMigrationForLocale = (
  project: ProjectLike,
  localeCode: string,
): boolean => {
  if ((project?.iteration ?? 1) <= 1) return true;
  return !getMigratedLocales(project).includes(localeCode);
};

/**
 * Extracts destination locale codes that were ACTUALLY targeted by a delta
 * run, from an `updated-entries.json` config object.
 *
 * Per-entry keys in that config are `${csUid}::${localeCode}` (see
 * `removeEntriesFromDatabase` in entry-update.utils.ts) — this reads the
 * locale suffix back out. Bookkeeping keys added by the enrich* helpers
 * (`__assetMapping__`, `__entryMapping__`, `__assetUpdates__`) are skipped.
 *
 * This exists to fix a bug where a locale got marked "migrated" as soon as
 * ANY locale finished a delta run, instead of only the locale(s) that run
 * actually processed — which permanently skipped locales configured ahead of
 * when they were meant to be migrated (see `runCli.service.ts`).
 */
export const extractLocalesFromUpdateConfig = (
  config: Record<string, any> | null | undefined,
): string[] => {
  if (!config || typeof config !== 'object') return [];
  const locales = new Set<string>();
  for (const [ctKey, entries] of Object.entries(config)) {
    if (ctKey.startsWith('__')) continue;
    if (!entries || typeof entries !== 'object') continue;
    for (const entryKey of Object.keys(entries)) {
      const sep = entryKey.lastIndexOf('::');
      if (sep === -1) continue;
      const locale = entryKey.slice(sep + 2);
      if (locale) locales.add(locale);
    }
  }
  return Array.from(locales);
};

/**
 * Set-union the given locales into project.migrated_locales and persist.
 * Idempotent.
 */
export const recordMigratedLocales = async (
  projectId: string,
  locales: string[],
): Promise<void> => {
  if (!locales?.length) return;
  await ProjectModel.read();
  await ProjectModel.update((data: any) => {
    const idx = (data?.projects ?? []).findIndex(
      (p: any) => p && p.id === projectId,
    );
    if (idx < 0) return;
    const existing: string[] = Array.isArray(data.projects[idx].migrated_locales)
      ? data.projects[idx].migrated_locales
      : [];
    data.projects[idx].migrated_locales = Array.from(
      new Set([...existing, ...locales]),
    );
  });
};
