import { describe, it, expect, vi, afterEach } from "vitest";
import path from "path";

/**
 * TDD — v3 migrationData.util. Resolves the shared `exportData`
 * directory the legacy migration engine's import step already reads its
 * source bundle from — real exports must land there (as a folder) so a
 * later import step can read them with no extra relocate step.
 * V3_MIGRATION_DATA_DIR is test-overridable so tests never touch the real
 * on-disk exportData/.
 */
import { migrationDataDir, stackDataDir } from "../../../../v3/utils/migrationData.util.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("v3 migrationData.util", () => {
  it("(positive) migrationDataDir resolves V3_MIGRATION_DATA_DIR when set", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    expect(migrationDataDir()).toBe(path.resolve("/tmp/fake-migration-data"));
  });

  // Negative — taxonomy #1 (missing override): falls back to v3's own
  // exportData folder (under api/v3/, not the legacy api/exportData
  // the v1/v2 engine owns), not an error/undefined.
  it("(negative) migrationDataDir falls back to <api>/v3/exportData when unset", () => {
    vi.unstubAllEnvs();
    expect(migrationDataDir().endsWith(path.join("api", "v3", "exportData"))).toBe(true);
  });

  /*
    ── Nested per project, 2026-08-12 ─────────────────────────────────────────

    Was `exportData/<stackApiKey>/`. Now
    `exportData/<projectId>/<stackApiKey>/`, so two projects exporting the SAME
    stack no longer share one directory — which they did, meaning the second export
    overwrote the first, and both projects' audit caches collided on one `audit.json`.
  */
  it("(positive) stackDataDir nests the stack id under the project id", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    expect(stackDataDir("proj-1", "blt123")).toBe(
      path.join("/tmp/fake-migration-data", "proj-1", "blt123")
    );
  });

  /*
    Negative — the point of nesting: the same stack under two projects must resolve to
    two different directories. Four projects in the live store point at one stack, so
    this is the actual situation, not a hypothetical.
  */
  it("(negative) the same stack under two projects resolves to different directories", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    expect(stackDataDir("proj-1", "blt123")).not.toBe(stackDataDir("proj-2", "blt123"));
  });

  /*
    ── Path containment ──────────────────────────────────────────────────────

    Both segments come from stored values, and `stackApiKey` is only ever checked for
    PRESENCE when a source is persisted — never for format. Passed through raw,
    `stackDataDir('../../../../etc')` resolved to `/Users/<user>/etc`, so the audit
    reader and the content-mapping inventory would read a directory outside
    `exportData` entirely.

    Sanitising inside this function rather than at each call site is deliberate: the
    write path in `export.service.ts` already sanitised, while both READ paths did not,
    which is exactly the kind of split that leaves one door open. One choke point, and
    every caller gets it.
  */
  it("(positive) contains a traversal attempt inside the data directory", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    const root = path.resolve("/tmp/fake-migration-data");

    for (const evil of ["../../../../etc", "..", "a/../../b", "/etc/passwd", "./../x"]) {
      const resolved = path.resolve(stackDataDir("proj-1", evil));
      expect(resolved.startsWith(root + path.sep), `escaped with "${evil}"`).toBe(true);
    }
  });

  // Negative — the project id is a path segment too, and gets the same treatment.
  it("(negative) contains a traversal attempt in the project id as well", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    const root = path.resolve("/tmp/fake-migration-data");

    const resolved = path.resolve(stackDataDir("../../../../etc", "blt123"));
    expect(resolved.startsWith(root + path.sep)).toBe(true);
  });

  /*
    Sanitising must not mangle the ids actually in use — real project ids are UUIDs and
    real api keys are `blt…`. A rule that rewrote those would silently orphan every
    existing export, which is a far more likely outcome than an attack on a local tool.
  */
  it("(positive) leaves real uuids and api keys untouched", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    const real = stackDataDir("baad2e8d-d8d2-4694-aa1c-a45c94c7fbd4", "blt18229446c6d5ea6b");

    expect(real).toBe(
      path.join("/tmp/fake-migration-data", "baad2e8d-d8d2-4694-aa1c-a45c94c7fbd4", "blt18229446c6d5ea6b")
    );
  });
});
