import { describe, it, expect, vi, afterEach } from "vitest";
import path from "path";

/**
 * TDD — v3 migrationData.util. Resolves the shared `cmsMigrationData`
 * directory the legacy migration engine's import step already reads its
 * source bundle from — real exports must land there (as a folder) so a
 * later import step can read them with no extra relocate step.
 * V3_MIGRATION_DATA_DIR is test-overridable so tests never touch the real
 * on-disk cmsMigrationData/.
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
  // cmsMigrationData folder (under api/v3/, not the legacy api/cmsMigrationData
  // the v1/v2 engine owns), not an error/undefined.
  it("(negative) migrationDataDir falls back to <api>/v3/cmsMigrationData when unset", () => {
    vi.unstubAllEnvs();
    expect(migrationDataDir().endsWith(path.join("api", "v3", "cmsMigrationData"))).toBe(true);
  });

  it("(positive) stackDataDir joins the stack id onto migrationDataDir", () => {
    vi.stubEnv("V3_MIGRATION_DATA_DIR", "/tmp/fake-migration-data");
    expect(stackDataDir("blt123")).toBe(path.join("/tmp/fake-migration-data", "blt123"));
  });
});
