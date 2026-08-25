#!/usr/bin/env npx tsx
// Reconcile a SAP SmartEdit source export against what is ACTUALLY live in a
// Contentstack stack right now — not our own local staging files under
// cmsMigrationData (that's what reconcile-sap.ts / the in-pipeline
// reconciliation check compare against). A local-only check can never catch a
// bug in the CLI import step itself, or content that changed/broke after
// import; this script proves the real destination matches the real source.
//
//   npx tsx scripts/reconcile-live.ts <source.impex|sourceFolder> <stackId> \
//     [--json out.json] [--content-types contentTypes.json]
//
// Exports the live stack fresh into a throwaway temp directory using this
// app's own stored Contentstack credentials (the same auth pattern
// runCli.service.ts already uses for imports), translates its real,
// Contentstack-assigned uids back onto OUR OWN deterministic uids (see
// "uid translation" below), then runs the EXACT SAME reconciliation logic
// reconcile-sap.ts uses — reimplementing the comparison here would let the
// two drift and quietly agree on the same wrong answer.
//
// UID TRANSLATION: Contentstack does NOT keep the uid our connector computes
// for an entry/asset when it actually imports it — it assigns its own new
// one (confirmed live: our uid for "Edge Normal Template" and its real
// Contentstack uid are completely different strings). Every check this
// project has ever had before this script only ever compared our OWN copy of
// the data, pre-import, so this never mattered until now — it is exactly the
// blind spot this script exists to close. The import step already keeps a
// before→after uid map for this (written by uid-mapper.utils.ts after every
// real migration, originally for the delta/update feature); this script
// reuses that same map to translate the live export's real uids back onto
// our own before comparing, so the existing, already-tested reconcile()
// logic can run completely unmodified.
//
// Exits 1 when anything CRITICAL or ERROR is found, matching reconcile-sap.ts.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import AuthenticationModel from '../src/models/authentication.js';
import ProjectModelLowdb from '../src/models/project-lowdb.js';
import getUidMapperDb from '../src/models/uidMapper.js';
import { setBasicAuthConfig, setOAuthConfig } from '../src/utils/config-handler.util.js';
import { reconcile, formatReport } from '../src/services/sap-smartedit-reconcile.service.js';

/** Extracted so it can be unit-tested without spawning the CLI or exporting anything. */
export function parseArgs(args: string[]): {
  sourcePath?: string;
  stackId?: string;
  jsonOut: string | null;
  ctPath: string | null;
  projectId: string | null;
  iteration: number | null;
} {
  const jsonAt = args.indexOf('--json');
  const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
  const ctAt = args.indexOf('--content-types');
  const ctPath = ctAt >= 0 ? args[ctAt + 1] : null;
  // Set by an automated caller (e.g. runCli.service.ts's post-migration trigger) that
  // already knows exactly which project/iteration this stack belongs to — bypasses
  // resolveProjectForStack's search-by-stack-id below, which can match the WRONG
  // project when more than one record's destination_stack_id/current_test_stack_id
  // happens to reference the same stack (stale test-stack ids left over from an
  // earlier, abandoned attempt are common in a dev/test environment).
  const projectIdAt = args.indexOf('--project-id');
  const projectId = projectIdAt >= 0 ? args[projectIdAt + 1] : null;
  const iterationAt = args.indexOf('--iteration');
  const iteration = iterationAt >= 0 ? Number(args[iterationAt + 1]) : null;

  const consumed = new Set<number>();
  if (jsonAt >= 0) consumed.add(jsonAt).add(jsonAt + 1);
  if (ctAt >= 0) consumed.add(ctAt).add(ctAt + 1);
  if (projectIdAt >= 0) consumed.add(projectIdAt).add(projectIdAt + 1);
  if (iterationAt >= 0) consumed.add(iterationAt).add(iterationAt + 1);
  const positional = args.filter((_, i) => !consumed.has(i));

  return { sourcePath: positional[0], stackId: positional[1], jsonOut, ctPath, projectId, iteration };
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { shell: true, stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`))));
  });
}

/**
 * A live Contentstack export writes one or more batch files per folder
 * (`<random-id>-entries.json`, `<random-id>-assets.json`) instead of the
 * single fixed filename our own connector writes and reconcile() expects.
 * Merged in-memory here (not written back verbatim) because the caller still
 * has to translate the uids inside before this can be handed to reconcile().
 */
export function mergeBatchFiles(dir: string, suffix: string): Record<string, any> {
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(suffix));
  } catch {
    return {};
  }
  const merged: Record<string, any> = {};
  for (const f of files) {
    try {
      Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch {
      /* a corrupt batch file just contributes nothing */
    }
  }
  return merged;
}

/**
 * Given a real project's most recent migration, look up which project a
 * stack id belongs to (it could be the final destination stack or a test
 * stack) so the SAME migration's uid translation map can be loaded — the map
 * is filed per project/iteration, not per stack.
 */
export async function resolveProjectForStack(stackId: string): Promise<{ projectId: string; iteration: number }> {
  await ProjectModelLowdb.read();
  const project: any = ProjectModelLowdb.chain
    .get('projects')
    .find((p: any) => p?.destination_stack_id === stackId || p?.current_test_stack_id === stackId)
    .value();
  if (!project) {
    throw new Error(
      `No project found whose destination or test stack id matches "${stackId}" — the uid translation this check needs comes from that project's own migration history.`,
    );
  }
  return { projectId: project.id, iteration: project.iteration || 1 };
}

/** uid-mapper.utils.ts writes {ourSourceUid: realContentstackUid} — flip it to look up the other direction. */
export function invertMap(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}

/**
 * Recursively replace any string value that is a KEY in either DEST->SOURCE
 * uid map with its OUR-SIDE equivalent — covers both an entry's own
 * top-level `uid` field and any uid embedded inside a reference/file field's
 * value. Safe the same way toEntryUid's own design already relies on: a
 * blt+16hex Contentstack uid is astronomically unlikely to appear, by
 * coincidence, inside unrelated plain text.
 */
function remapEmbeddedUids(value: any, destToSourceEntry: Record<string, string>, destToSourceAsset: Record<string, string>): any {
  if (typeof value === 'string') return destToSourceEntry[value] ?? destToSourceAsset[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => remapEmbeddedUids(v, destToSourceEntry, destToSourceAsset));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = remapEmbeddedUids(v, destToSourceEntry, destToSourceAsset);
    return out;
  }
  return value;
}

/**
 * Merge each content type/locale's live entry batch files, translate every
 * real Contentstack uid embedded anywhere in them back onto our own, and
 * write the result as reconcile()'s expected `<locale>.json`. An entry with
 * no translation available (never migrated by this project, or created
 * outside this migration entirely) is kept under its REAL uid rather than
 * dropped — reconcile() then correctly reports it as row.extra instead of
 * silently disappearing.
 */
function normalizeEntries(exportRoot: string, entryMap: Record<string, string>, assetMap: Record<string, string>): void {
  // entryMap/assetMap are {ourSourceUid: realContentstackUid} (that is how
  // uid-mapper.utils.ts writes them) — translating a LIVE export back onto
  // our own uids needs the OPPOSITE direction, so invert both here once.
  const destToSourceEntry = invertMap(entryMap);
  const destToSourceAsset = invertMap(assetMap);

  const entriesDir = path.join(exportRoot, 'entries');
  if (!fs.existsSync(entriesDir)) return;
  for (const ct of fs.readdirSync(entriesDir)) {
    const ctDir = path.join(entriesDir, ct);
    if (!fs.statSync(ctDir).isDirectory()) continue;
    for (const locale of fs.readdirSync(ctDir)) {
      const localeDir = path.join(ctDir, locale);
      if (!fs.statSync(localeDir).isDirectory()) continue;
      const merged = mergeBatchFiles(localeDir, '-entries.json');
      if (!Object.keys(merged).length) continue;
      const remapped: Record<string, any> = {};
      for (const [realUid, entry] of Object.entries(merged)) {
        const sourceUid = destToSourceEntry[realUid] ?? realUid;
        remapped[sourceUid] = remapEmbeddedUids(entry, destToSourceEntry, destToSourceAsset);
      }
      fs.writeFileSync(path.join(localeDir, `${locale}.json`), JSON.stringify(remapped, null, 2), 'utf-8');
    }
  }
}

/**
 * Same translation, for assets: merge the live batch files (keyed by
 * Contentstack's real asset uid) into reconcile()'s expected
 * assets/index.json, keyed by OUR OWN synthetic assetKey(code) — using the
 * SAME authoritative map, not a filename guess. The matched binary is also
 * copied under the synthetic key's expected path so checkAssets()'s existing
 * on-disk size check runs unmodified against a live export too. An asset our
 * map has no record of (never migrated by this project) is simply left out
 * of the index — checkAssets() then correctly reports it as asset.missing.
 */
function normalizeAssets(exportRoot: string, assetMap: Record<string, string>): void {
  const assetsDir = path.join(exportRoot, 'assets');
  const liveByRealUid = mergeBatchFiles(assetsDir, '-assets.json');

  const index: Record<string, any> = {};
  for (const [sourceKey, realUid] of Object.entries(assetMap)) {
    const rec = liveByRealUid[realUid];
    if (!rec?.filename) continue; // genuinely absent from the live stack -> checkAssets flags asset.missing, correctly
    index[sourceKey] = { ...rec, uid: sourceKey };
    try {
      const destDir = path.join(assetsDir, 'files', sourceKey);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(path.join(assetsDir, 'files', realUid, rec.filename), path.join(destDir, rec.filename));
    } catch {
      /* export didn't download a binary for this asset -> leave unlinked, checkAssets flags asset.noFile correctly */
    }
  }
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  // No "failed to resolve" concept for a live stack (we aren't re-running
  // getAllAssets) — an empty log means checkAssets relies on index.json alone.
  fs.mkdirSync(path.join(assetsDir, 'logs', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'logs', 'assets', 'cs_failed.json'), '{}');
}

async function main(): Promise<void> {
  const { sourcePath, stackId, jsonOut, ctPath, projectId: projectIdArg, iteration: iterationArg } = parseArgs(process.argv.slice(2));
  if (!sourcePath || !stackId) {
    console.error('Usage: npx tsx scripts/reconcile-live.ts <source.impex|sourceFolder> <stackId> [--json out.json] [--content-types contentTypes.json] [--project-id id] [--iteration n]');
    process.exit(2);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(2);
  }
  const contentTypes = ctPath ? JSON.parse(fs.readFileSync(ctPath, 'utf8')) : undefined;

  const { projectId, iteration } = projectIdArg
    ? { projectId: projectIdArg, iteration: iterationArg ?? 1 }
    : await resolveProjectForStack(stackId);
  const uidMapperDb = getUidMapperDb(projectId, iteration);
  await uidMapperDb.read();
  const entryMap: Record<string, string> = (uidMapperDb.data as any)?.entry ?? {};
  const assetMap: Record<string, string> = (uidMapperDb.data as any)?.assets ?? {};
  if (!Object.keys(entryMap).length) {
    console.error(`No uid translation map found for project ${projectId} (iteration ${iteration}) — has this stack actually been migrated yet?`);
    process.exit(2);
  }

  await AuthenticationModel.read();
  const users = (AuthenticationModel.data as any).users ?? [];
  if (!users.length) {
    console.error('No stored Contentstack credentials found — log in via the app first.');
    process.exit(2);
  }
  if (users.length > 1) {
    console.error(`Multiple stored credentials found (${users.length}); this script only supports a single logged-in user today.`);
    process.exit(2);
  }
  const user = users[0];

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-reconcile-live-'));
  try {
    console.info(`Exporting live stack ${stackId} to a temp directory ...`);
    await runCommand('npx', ['@contentstack/cli', 'config:set:region', user.region || 'NA']);
    if (user.authtoken) setBasicAuthConfig(user);
    else setOAuthConfig(user);
    await runCommand('npx', ['@contentstack/cli', 'cm:stacks:export', '-k', stackId, '-d', exportDir, '--yes']);

    // The export CLI nests everything under a branch-name folder (e.g.
    // "main") plus a sibling branches.json — a wrapper our own generated
    // migration data never has, so reconcile() must be pointed one level in.
    const branchDirs = fs.readdirSync(exportDir).filter((d) => {
      try {
        return fs.statSync(path.join(exportDir, d)).isDirectory();
      } catch {
        return false;
      }
    });
    const exportRoot = path.join(exportDir, branchDirs.includes('main') ? 'main' : branchDirs[0] ?? '');
    if (!fs.existsSync(exportRoot)) {
      console.error(`Export did not produce the expected directory layout under ${exportDir}`);
      process.exit(2);
    }

    normalizeEntries(exportRoot, entryMap, assetMap);
    normalizeAssets(exportRoot, assetMap);

    const report = reconcile(sourcePath, exportRoot, contentTypes);
    console.log(formatReport(report));

    if (jsonOut) {
      fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\nMachine-readable report: ${jsonOut}`);
    }

    const { critical, error } = report.summary;
    if (critical || error) {
      console.error(`\nFAILED: ${critical} critical, ${error} error finding(s).`);
      process.exit(1);
    }
    console.log('\nPASSED.');
  } finally {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
}

/**
 * Only run when executed directly — NOT when imported by
 * reconcile-live.test.ts, which imports the pure helpers only. See
 * reconcile-sap.ts's isRunDirectly for why the naive
 * `import.meta.url === file://process.argv[1]` check does not work on macOS.
 */
function isRunDirectly(): boolean {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1] ?? '');
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  main().catch((err) => {
    console.error('reconcile-live crashed:', err);
    process.exit(2);
  });
}
