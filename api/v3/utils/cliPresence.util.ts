import fs from "fs";
import path from "path";

/**
 * v3 Contentstack CLI presence check — Impact 7 of
 * `docs/plans/source-export-revamp.md`.
 *
 * Without this, a missing CLI surfaces as whatever `npx --no-install csdx` prints:
 * an opaque failure that names neither the cause nor the fix. The export runs the
 * CLI from THIS package's own `node_modules`, so the answer is always `npm install`
 * here — worth saying outright rather than leaving the operator to infer it from a
 * non-zero exit code.
 *
 * A filesystem probe rather than a trial spawn, because oclif takes ~0.85s to boot
 * and this runs before every export. Probing the executable the spawn actually
 * resolves keeps the check from disagreeing with reality — a check that can pass
 * while the spawn fails is worse than no check, because it is believed.
 */

/**
 * The local `csdx` executable, as `npx --no-install csdx` resolves it.
 *
 * `process.cwd()` is the api package root — the same value `runOne` passes as the
 * spawn's `cwd`, so the two cannot drift apart.
 */
export const cliBinPath = (): string => path.join(process.cwd(), "node_modules", ".bin", "csdx");

export const isCliInstalled = (): boolean => {
  try {
    return fs.existsSync(cliBinPath());
  } catch {
    // An unreadable node_modules is indistinguishable from a missing CLI as far as
    // the export is concerned, and the same fix applies.
    return false;
  }
};

/**
 * Throws before any export work begins when the CLI is unavailable.
 *
 * Deliberately raised at the start of the export rather than at server startup:
 * booting the server is not when the operator can act on it, and a startup check
 * would either add oclif's boot cost to every launch or block the server on
 * something only the export needs.
 */
export const assertCliAvailable = (): void => {
  if (isCliInstalled()) return;
  throw new Error(
    "The Contentstack CLI (csdx) is not available. Run `npm install` in the api " +
      "directory — the export runs the CLI from this package's own node_modules."
  );
};
