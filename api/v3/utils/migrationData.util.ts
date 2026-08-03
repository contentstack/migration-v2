import path from "path";

/**
 * Root of the v3-owned `cmsMigrationData` tree, under `api/v3/` — kept
 * separate from the legacy v1/v2 engine's own `cmsMigrationData` at the api
 * root (`runCli.service.ts`'s `MIGRATION_DATA_CONFIG.DATA`), since v3 is a
 * self-contained system and its exported data shouldn't mix with the legacy
 * pipeline's. A later v3 import/destination step reads its source bundle
 * straight from here — a real folder, not a zip — with no extra
 * unzip/relocate step. V3_MIGRATION_DATA_DIR overrides the target dir for
 * tests.
 */
export const migrationDataDir = (): string =>
  process.env.V3_MIGRATION_DATA_DIR
    ? path.resolve(process.env.V3_MIGRATION_DATA_DIR)
    : path.resolve(process.cwd(), "v3", "cmsMigrationData");

export const stackDataDir = (stackId: string): string => path.join(migrationDataDir(), stackId);
