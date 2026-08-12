import path from "path";

/**
 * Root of the v3-owned `exportData` tree, under `api/v3/`.
 *
 * Renamed from `cmsMigrationData` on 2026-08-12. ⚠️ The legacy v1/v2 engine has
 * its OWN `cmsMigrationData` at the api root (`runCli.service.ts`'s
 * `MIGRATION_DATA_CONFIG.DATA`) which keeps that name — the rename applies only to
 * v3's tree. The two were always separate directories, and the distinct names now
 * make that impossible to confuse. A later v3 import/destination step reads its source bundle
 * straight from here — a real folder, not a zip — with no extra
 * unzip/relocate step. V3_MIGRATION_DATA_DIR overrides the target dir for
 * tests.
 */
export const migrationDataDir = (): string =>
  process.env.V3_MIGRATION_DATA_DIR
    ? path.resolve(process.env.V3_MIGRATION_DATA_DIR)
    : path.resolve(process.cwd(), "v3", "exportData");

/**
 * One path segment, with anything that could escape the directory removed.
 *
 * ⚠️ Both segments below come from STORED values, and `stackApiKey` is only ever
 * checked for presence when a source is persisted — never for format. Used raw,
 * `stackDataDir('../../../../etc')` resolved to `/Users/<user>/etc`, so the audit
 * reader and the content-mapping inventory would read a directory outside
 * `exportData` entirely.
 *
 * Sanitising HERE rather than at each call site is deliberate: the write path in
 * `export.service.ts` already sanitised while both read paths did not, which is
 * exactly the split that leaves one door open. One choke point, and every caller
 * inherits it.
 *
 * Path separators become `-`, so a traversal collapses into a single harmless
 * segment rather than being rejected — an export folder that lands somewhere odd is
 * recoverable, whereas throwing here would break the read path for a project whose
 * source was persisted before this rule existed.
 */
const safeSegment = (value: string): string => {
  const cleaned = String(value ?? "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    // A leading dot run is the traversal primitive; strip it so no segment can be
    // `.` or `..` no matter what the separators collapsed to.
    .replace(/^\.+/, "")
    .slice(0, 80);
  return cleaned || "unknown";
};

/**
 * The export directory for one project's source stack:
 * `exportData/<projectId>/<stackApiKey>/`.
 *
 * Nested under the project as of 2026-08-12. Previously the stack id sat directly
 * under the root, so two projects exporting the SAME stack shared one directory —
 * the second export overwrote the first, and both projects' audit caches collided on
 * a single `audit.json`. Four projects in the live store point at one stack, so this
 * was the real situation rather than a hypothetical.
 */
export const stackDataDir = (projectId: string, stackId: string): string =>
  path.join(migrationDataDir(), safeSegment(projectId), safeSegment(stackId));
