#!/usr/bin/env npx tsx
// Reconcile a SAP SmartEdit migration against the export it came from.
//
//   npx tsx scripts/reconcile-sap.ts <source.impex|sourceFolder> <migrationDataDir> \
//     [--json out.json] [--content-types contentTypes.json]
//
// --content-types points at a JSON dump of the SAME contentTypes array createEntry
// was given (source-type -> destination-uid mapping). Without it, the type map
// falls back to a heuristic read of content_types/*.json titles, which can be
// wrong if a mapping was renamed during "Map Content Fields" — see
// sap-smartedit-reconcile.service.ts. The runtime hook in migration.service.ts
// always has the array in memory and does not need this flag.
//
// Exits 1 when anything CRITICAL or ERROR is found, so it can gate a release or a
// customer migration rather than being advisory. Runs entirely on disk: no
// Contentstack credentials, no network.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reconcile, formatReport } from '../src/services/sap-smartedit-reconcile.service.js';

/**
 * Extracted so it can be unit-tested without spawning the CLI as a subprocess.
 *
 * A flag's OWN index and its value's index must only be consumed when that flag
 * was actually found. `args.indexOf(flag) + 1` is 0 whenever the flag is absent
 * (indexOf returns -1), and 0 is a valid array index — so an unguarded
 * `[jsonAt, jsonAt + 1, ...].filter(i => i >= 0)` silently ate positional
 * argument 0 (the source path) any time EITHER optional flag was omitted. Only
 * surfaced when this was run for real with just one flag present — every prior
 * manual test happened to pass both flags together.
 */
export function parseArgs(args: string[]): {
  sourcePath?: string;
  migrationDir?: string;
  jsonOut: string | null;
  ctPath: string | null;
} {
  const jsonAt = args.indexOf('--json');
  const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
  const ctAt = args.indexOf('--content-types');
  const ctPath = ctAt >= 0 ? args[ctAt + 1] : null;

  const consumed = new Set<number>();
  if (jsonAt >= 0) consumed.add(jsonAt).add(jsonAt + 1);
  if (ctAt >= 0) consumed.add(ctAt).add(ctAt + 1);
  const positional = args.filter((_, i) => !consumed.has(i));

  return { sourcePath: positional[0], migrationDir: positional[1], jsonOut, ctPath };
}

function main(): void {
  const { sourcePath, migrationDir, jsonOut, ctPath } = parseArgs(process.argv.slice(2));
  if (!sourcePath || !migrationDir) {
    console.error('Usage: npx tsx scripts/reconcile-sap.ts <source.impex|sourceFolder> <migrationDataDir> [--json out.json] [--content-types contentTypes.json]');
    process.exit(2);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(2);
  }
  if (!fs.existsSync(migrationDir)) {
    console.error(`Migration output not found: ${migrationDir}`);
    process.exit(2);
  }
  const contentTypes = ctPath ? JSON.parse(fs.readFileSync(ctPath, 'utf8')) : undefined;

  const report = reconcile(sourcePath, path.resolve(migrationDir), contentTypes);
  console.log(formatReport(report));

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nMachine-readable report: ${jsonOut}`);
  }

  const { critical, error } = report.summary;
  if (critical || error) {
    console.error(`\nFAILED: ${critical} critical, ${error} error finding(s).`);
    process.exit(1);
  }
  console.log('\nPASSED.');
}

/**
 * Only run when executed directly — NOT when imported (e.g. by
 * reconcile-sap.args.test.ts, which imports just parseArgs). Without this
 * guard, importing the module for that test would also run the full CLI,
 * including process.exit(), which would kill the test runner.
 *
 * A plain `import.meta.url === \`file://${process.argv[1]}\`` NEVER matches on
 * macOS: import.meta.url resolves through the /private/tmp symlink (and would
 * also percent-encode the space in this project's own path, "Migration v2"),
 * while process.argv[1] stays literal. That silently disabled the CLI
 * entirely — caught only by actually running it after adding the guard,
 * not by the unit tests, which never invoke this branch at all.
 * fileURLToPath + realpathSync normalizes both sides before comparing.
 */
function isRunDirectly(): boolean {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] ?? '');
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  main();
}
