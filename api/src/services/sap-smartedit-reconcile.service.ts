// api/src/services/sap-smartedit-reconcile.service.ts
//
// Reconciliation harness for the SAP SmartEdit connector: given the SOURCE ImpEx
// export and the migration output directory, prove that nothing was silently lost.
//
// WHY THIS EXISTS: every bug found in this connector so far failed SILENTLY —
// translations dropped because no destination locale was created, plain-text fields
// corrupted by a uid remap, entries collapsed onto one title, whole columns not
// carried across. None produced an error or a log line; all were found by a human
// eyeballing output, which does not scale to a customer catalog of tens of
// thousands of rows.
//
// The harness reads the source with the connector's OWN parser (imported, never
// reimplemented — a second parser would let the two drift and agree on the same
// wrong answer) and then checks the generated output against it.
//
// It deliberately runs BEFORE/WITHOUT the Contentstack import: every bug listed
// above is detectable on disk, needs no credentials or network, and so can run in
// CI on every change.
import fs from 'fs';
import path from 'path';
import {
  parseImpexAll,
  rowSourceId,
  resolveInputPath,
  toEntryUid,
  assetKey,
  ASSET_TYPE,
  type ImpexBlock,
} from './sap-smartedit.service.js';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';

const {
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_FILE_NAME,
  LOCALE_MASTER_LOCALE,
  ASSETS_DIR_NAME,
  CONTENT_TYPES_DIR_NAME,
} = MIGRATION_DATA_CONFIG;

export type Severity = 'critical' | 'error' | 'warning' | 'info';

export interface Finding {
  /** critical = data is provably lost; error = likely wrong; warning = worth a look. */
  severity: Severity;
  check: string;
  sourceType?: string;
  id?: string;
  locale?: string;
  detail: string;
}

export interface ReconcileReport {
  sourcePath: string;
  migrationDir: string;
  /**
   * "authoritative" when the caller passed the live contentTypes array (exactly
   * what createEntry used); "heuristic" when falling back to on-disk content-type
   * file titles, which can be wrong for a renamed mapping. Surfaced so a critical
   * "type.unmapped" finding under "heuristic" is read with appropriate suspicion.
   */
  typeMappingSource: 'authoritative' | 'heuristic';
  summary: {
    sourceTypes: number;
    sourceRows: number;
    contentTypes: number;
    entriesWritten: number;
    localesDeclared: string[];
    assetsDeclared: number;
    assetsWritten: number;
    critical: number;
    error: number;
    warning: number;
  };
  perType: Array<{ sourceType: string; sourceRows: number; entries: number; contentTypeUid: string | null }>;
  findings: Finding[];
}

const readJson = (p: string): any => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

/** The literal SAP "Null" reference and blanks both mean "no value". */
const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || String(v).trim() === '' || String(v).trim().toLowerCase() === 'null';

/**
 * Flatten every string a destination entry holds, at any depth, so a source value
 * can be looked for regardless of HOW it was mapped (scalar, reference object,
 * asset record, array). Field-level reconciliation deliberately does not assume a
 * source-column -> destination-field mapping: the mapper re-points columns (a
 * source `name` becomes uid `title`), so asserting on a presumed mapping would
 * miss real loss while flagging correct output.
 */
function collectStrings(value: any, out: Set<string> = new Set()): Set<string> {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string') out.add(value.trim());
  else if (typeof value === 'number' || typeof value === 'boolean') out.add(String(value));
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

/**
 * Content types the migration produced: destination uid -> source type name.
 *
 * Two ways to build this map, in order of trust:
 *
 * 1. The SAME `contentTypes` array createEntry was given, resolved EXACTLY the way
 *    createEntry itself resolves it (`otherCmsTitle ?? contentstackTitle`, then
 *    `mapperKeys[uid] ?? uid`). This is authoritative — pass it whenever it is
 *    available (the runtime hook always has it, since it is the same array already
 *    in scope at the createEntry call site).
 *
 * 2. Falling back to the on-disk `content_types/*.json` files' `title` field, for
 *    the standalone CLI script, which has no access to the live mapper data. This
 *    is a HEURISTIC, not authoritative: `contenTypeMaker` persists
 *    `contentType.contentstackTitle` — the DESTINATION display title a user can
 *    rename during "Map Content Fields" — not necessarily the original SAP type
 *    name. It happens to match for an unrenamed mapping (every mapping this
 *    session used), but a renamed one would report a false "type went missing".
 */
function resolveContentTypeMap(
  migrationDir: string,
  contentTypes?: any[],
  mapperKeys?: Record<string, string>,
): Map<string, string> {
  if (contentTypes?.length) {
    const map = new Map<string, string>();
    for (const ct of contentTypes) {
      if (ct?.type === 'global_field') continue;
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (srcType && ctUid) map.set(ctUid, srcType);
    }
    return map;
  }

  const dir = path.join(migrationDir, CONTENT_TYPES_DIR_NAME);
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'schema.json');
  } catch {
    return map;
  }
  for (const f of files) {
    const ct = readJson(path.join(dir, f));
    if (ct?.uid && ct?.title) map.set(ct.uid, ct.title);
  }
  return map;
}

/** Every locale the destination stack will actually have. */
function loadLocales(migrationDir: string): { master: string | null; all: string[]; names: Record<string, string> } {
  const dir = path.join(migrationDir, LOCALE_DIR_NAME);
  const masterFile = readJson(path.join(dir, LOCALE_MASTER_LOCALE)) ?? {};
  const localesFile = readJson(path.join(dir, LOCALE_FILE_NAME)) ?? {};
  const names: Record<string, string> = {};
  const masterEntry = Object.values(masterFile)[0] as any;
  const master = masterEntry?.code ?? null;
  if (masterEntry) names[masterEntry.code] = masterEntry.name;
  const all = master ? [master] : [];
  for (const l of Object.values(localesFile) as any[]) {
    if (l?.code) {
      all.push(l.code);
      names[l.code] = l.name;
    }
  }
  return { master, all, names };
}

function loadEntries(migrationDir: string, ctUid: string, locale: string): Record<string, any> {
  return readJson(path.join(migrationDir, ENTRIES_DIR_NAME, ctUid, locale, `${locale}.json`)) ?? {};
}

function localesOnDisk(migrationDir: string, ctUid: string): string[] {
  try {
    return fs
      .readdirSync(path.join(migrationDir, ENTRIES_DIR_NAME, ctUid))
      .filter((d) => !d.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * Reconcile a migration output directory against the source export it came from.
 *
 * `migrationDir` is the generated stack folder (the one holding entries/,
 * content_types/, locales/, assets/).
 */
export function reconcile(
  sourcePath: string,
  migrationDir: string,
  contentTypes?: any[],
  mapperKeys?: Record<string, string>,
): ReconcileReport {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  const inputPath = resolveInputPath(sourcePath, undefined);
  const blocks = parseImpexAll(inputPath);
  const ctByUid = resolveContentTypeMap(migrationDir, contentTypes, mapperKeys);
  const sourceTypeToCtUid = new Map<string, string>();
  for (const [uid, srcType] of ctByUid) sourceTypeToCtUid.set(srcType, uid);

  // The real migration hook always calls reconcile() with the authoritative
  // contentTypes array, so this is only ever true for the standalone CLI run
  // by hand without --content-types.
  const isHeuristic = !contentTypes?.length;

  const { master, all: declaredLocales, names: localeNames } = loadLocales(migrationDir);
  const assetIndex = readJson(path.join(migrationDir, ASSETS_DIR_NAME, 'index.json')) ?? {};

  // ---- locale sanity -------------------------------------------------------
  if (!master) {
    add({ severity: 'critical', check: 'locale.master', detail: 'No master locale was written; the import has no locale to land entries in.' });
  }
  for (const code of declaredLocales) {
    // A locale whose name is its code makes the importer block on an interactive
    // "update name of master language?" prompt that --yes does not suppress.
    if (localeNames[code] && localeNames[code] === code) {
      add({
        severity: 'error',
        check: 'locale.name',
        locale: code,
        detail: `Locale "${code}" is named after its own code; the importer will stop on an interactive prompt that cannot be answered from the UI.`,
      });
    }
  }

  // ---- per-type reconciliation --------------------------------------------
  const perType: ReconcileReport['perType'] = [];
  let sourceRowTotal = 0;
  let entriesWritten = 0;

  for (const [sourceType, block] of blocks) {
    if (sourceType === ASSET_TYPE) continue;
    sourceRowTotal += block.rows.length;

    const ctUid = sourceTypeToCtUid.get(sourceType) ?? null;
    if (!ctUid) {
      // The customer-data guard: a source type nobody mapped is a whole class of
      // content silently absent from the destination. BUT in heuristic mode this
      // can also mean the content type was renamed during "Map Content Fields" —
      // heuristic mode guesses the source type from the CONTENTSTACK display
      // name (content_types/*.json's "title", which real production code always
      // writes as the possibly-renamed name, never the original SAP type), so a
      // rename alone reproduces this exact shape with zero actual data loss.
      // Confirmed live: a renamed ContentPage was migrated correctly and showed
      // as unmapped ONLY in heuristic mode, never in authoritative mode. Since
      // authoritative mode (what every real migration uses) cannot produce this
      // false positive, only heuristic mode's own guess is ever downgraded here.
      add({
        severity: isHeuristic ? 'warning' : 'critical',
        check: 'type.unmapped',
        sourceType,
        detail: isHeuristic
          ? `${block.rows.length} source rows of type "${sourceType}" produced no content type under heuristic mode's guess — this may be a false positive if the content type was renamed during "Map Content Fields", not real data loss. Re-run with --content-types for a reliable answer.`
          : `${block.rows.length} source rows of type "${sourceType}" produced NO content type — every one of these items is missing from the destination.`,
      });
      perType.push({ sourceType, sourceRows: block.rows.length, entries: 0, contentTypeUid: null });
      continue;
    }

    const masterEntries = master ? loadEntries(migrationDir, ctUid, master) : {};
    entriesWritten += Object.keys(masterEntries).length;
    perType.push({
      sourceType,
      sourceRows: block.rows.length,
      entries: Object.keys(masterEntries).length,
      contentTypeUid: ctUid,
    });

    // Entry folders must not exist for locales the stack will not have — that is
    // exactly how every translation was silently dropped once already.
    for (const loc of localesOnDisk(migrationDir, ctUid)) {
      if (!declaredLocales.includes(loc)) {
        add({
          severity: 'critical',
          check: 'locale.undeclared',
          sourceType,
          locale: loc,
          detail: `Entries were written for locale "${loc}" but no such locale is created in the stack; the importer will drop all of them.`,
        });
      }
    }

    checkRows(block, sourceType, ctUid, masterEntries, add);
    checkLocalizedValues(block, sourceType, ctUid, migrationDir, declaredLocales, master, add);
  }

  // ---- assets --------------------------------------------------------------
  const mediaBlock = blocks.get(ASSET_TYPE);
  const assetsDeclared = mediaBlock?.rows.length ?? 0;
  checkAssets(mediaBlock, migrationDir, assetIndex, add);

  const bySeverity = (s: Severity) => findings.filter((f) => f.severity === s).length;

  return {
    sourcePath: inputPath,
    migrationDir,
    typeMappingSource: isHeuristic ? 'heuristic' : 'authoritative',
    summary: {
      sourceTypes: blocks.size,
      sourceRows: sourceRowTotal,
      contentTypes: ctByUid.size,
      entriesWritten,
      localesDeclared: declaredLocales,
      assetsDeclared,
      assetsWritten: Object.keys(assetIndex).length,
      critical: bySeverity('critical'),
      error: bySeverity('error'),
      warning: bySeverity('warning'),
    },
    perType,
    findings,
  };
}

/** Every source row must exist as an entry, and carry its values across. */
function checkRows(
  block: ImpexBlock,
  sourceType: string,
  ctUid: string,
  entries: Record<string, any>,
  add: (f: Finding) => void,
): void {
  const seenUids = new Set<string>();
  const titles = new Map<string, string[]>();

  for (const row of block.rows) {
    const id = rowSourceId(row, block);
    if (!id) {
      add({
        severity: 'critical',
        check: 'row.noIdentity',
        sourceType,
        detail: `A source row has no identity (no uid/code and no [unique=true] columns), so it cannot become an entry: ${JSON.stringify(row).slice(0, 160)}`,
      });
      continue;
    }
    const uid = toEntryUid(id);
    seenUids.add(uid);
    const entry = entries[uid];
    if (!entry) {
      add({ severity: 'critical', check: 'row.missing', sourceType, id, detail: `Source row "${id}" has no entry in the destination.` });
      continue;
    }

    if (!/^blt[0-9a-f]{16}$/.test(uid)) {
      add({
        severity: 'error',
        check: 'uid.shape',
        sourceType,
        id,
        detail: `Entry uid "${uid}" is not in Contentstack's blt+16hex shape; the importer will reassign it and rewrite any text containing the old id.`,
      });
    }

    const t = String(entry.title ?? '');
    if (!titles.has(t)) titles.set(t, []);
    titles.get(t)!.push(id);

    // Value-presence: every non-empty source cell must be represented somewhere in
    // the entry, however it was mapped/transformed.
    const present = collectStrings(entry);
    const label = row.title ?? row.name;
    for (const [col, val] of Object.entries(row)) {
      if (isEmpty(val)) continue;
      if (col.startsWith('@')) continue; // binary pointer, not content
      if (isValueRepresented(String(val), present)) continue;

      // Known, deliberate trade rather than an unexplained disappearance: when a
      // label is shared by several rows the entry title falls back to the row's
      // unique id (otherwise every one of them is titled identically and they are
      // indistinguishable in the UI). The label itself then has nowhere to live,
      // because the mapper re-points the source label column ONTO uid `title`.
      // Surfaced, not silenced — it is real content that did not come across.
      if (String(val) === label && String(entry.title ?? '') === id) {
        add({
          severity: 'warning',
          check: 'label.droppedForAmbiguity',
          sourceType,
          id,
          detail: `Label ${JSON.stringify(String(val))} is shared by several rows, so this entry is titled by its id instead and the label is not stored anywhere.`,
        });
        continue;
      }

      add({
        severity: 'error',
        check: 'field.missing',
        sourceType,
        id,
        detail: `Source value for "${col}" is not present in the entry: ${JSON.stringify(String(val).slice(0, 120))}`,
      });
    }
  }

  for (const [title, ids] of titles) {
    if (ids.length > 1) {
      add({
        severity: 'warning',
        check: 'title.duplicate',
        sourceType,
        detail: `${ids.length} entries share the title ${JSON.stringify(title)} (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''}); they are indistinguishable in the Contentstack UI.`,
      });
    }
  }

  for (const uid of Object.keys(entries)) {
    if (!seenUids.has(uid)) {
      add({
        severity: 'warning',
        check: 'row.extra',
        sourceType,
        id: uid,
        detail: `Entry "${uid}" exists in the destination but matches no source row.`,
      });
    }
  }
}

/**
 * A source value survives if it appears verbatim, as a reference/asset key, or as a
 * member of a comma-separated list (ImpEx multi-value columns).
 */
function isValueRepresented(raw: string, present: Set<string>): boolean {
  const val = raw.trim();
  if (!val) return true;
  if (present.has(val)) return true;

  // Booleans/numbers are coerced to other primitive spellings.
  const lowered = val.toLowerCase();
  for (const p of present) if (p.toLowerCase() === lowered) return true;

  // References and assets are stored under a derived uid, and ImpEx multi-value
  // columns are comma-separated lists of them.
  const asRef = (s: string) => present.has(toEntryUid(s)) || present.has(assetKey(s)) || present.has(s);
  if (asRef(val)) return true;
  const parts = val.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(asRef)) return true;

  // Containment is allowed ONLY for long values — rich text that may have been
  // re-serialized or embedded in a larger field. A short scalar must match
  // exactly: otherwise "SiteContext" counts as present merely because some title
  // happens to contain it as a substring, and genuine loss goes unreported. That
  // exact false negative hid the dropped-label case during development.
  if (val.length > 40) {
    for (const p of present) if (p.includes(val)) return true;
  }
  return false;
}

/** A genuinely translated source value must land in THAT locale's entry. */
function checkLocalizedValues(
  block: ImpexBlock,
  sourceType: string,
  ctUid: string,
  migrationDir: string,
  declaredLocales: string[],
  master: string | null,
  add: (f: Finding) => void,
): void {
  if (!block.localizedValues.size) return;

  const cache = new Map<string, Record<string, any>>();
  const entriesFor = (loc: string) => {
    if (!cache.has(loc)) cache.set(loc, loadEntries(migrationDir, ctUid, loc));
    return cache.get(loc)!;
  };

  // Mirrors createEntry's own labelOwners: a title/name shared by more than one
  // row is "ambiguous", and createEntry drops it from the entry in EVERY locale
  // (not just the primary one) in favor of the row's id — see the `title:`
  // assignment in createEntry and label.droppedForAmbiguity in checkRows above.
  const labelOwners = new Map<string, Set<string>>();
  for (const row of block.rows) {
    const label = row.title ?? row.name;
    const rid = rowSourceId(row, block);
    if (!label || !rid) continue;
    if (!labelOwners.has(label)) labelOwners.set(label, new Set());
    labelOwners.get(label)!.add(toEntryUid(rid));
  }

  for (const row of block.rows) {
    const id = rowSourceId(row, block);
    if (!id) continue;
    const localized = block.localizedValues.get(row);
    if (!localized) continue;
    const uid = toEntryUid(id);
    const defaultLabel = row.title ?? row.name;
    const labelAmbiguous = !!defaultLabel && (labelOwners.get(defaultLabel)?.size ?? 0) > 1;

    for (const [attr, byLang] of Object.entries(localized)) {
      // The title/name column is not a "translation" to verify here when its
      // label is ambiguous — createEntry replaces it with the row's id in every
      // locale, already validated (as a warning) by checkRows/
      // label.droppedForAmbiguity. Checking it again here, unaware of that
      // exception, produced a false positive for EVERY ambiguous row's value in
      // EVERY locale it was translated into, not only the primary one — 2,320
      // of them on one real run, most (but not all) on the primary locale.
      if ((attr === 'title' || attr === 'name') && labelAmbiguous) continue;
      for (const [lang, value] of Object.entries(byLang)) {
        if (isEmpty(value)) continue;
        // The PRIMARY language's value is not a "translation" to verify here —
        // it is the row's own default value. This must be skipped
        // unconditionally, not only when no destination locale happens to
        // match (en-us IS always a real declared locale).
        if (master && lang.toLowerCase() === master.split('-')[0]) continue;
        // SAP's bare code -> the destination locale it was migrated into.
        const dest = declaredLocales.find((l) => l.startsWith(`${lang.toLowerCase()}-`)) ?? null;
        if (!dest) {
          add({
            severity: 'critical',
            check: 'locale.missingForValue',
            sourceType,
            id,
            locale: lang,
            detail: `"${attr}" has a ${lang} translation but no ${lang} locale exists in the destination; that translation is lost.`,
          });
          continue;
        }
        const entry = entriesFor(dest)[uid];
        if (!entry) {
          add({
            severity: 'critical',
            check: 'locale.entryMissing',
            sourceType,
            id,
            locale: dest,
            detail: `"${attr}" has a ${lang} translation but entry "${id}" was not written for locale ${dest}.`,
          });
          continue;
        }
        if (!isValueRepresented(String(value), collectStrings(entry))) {
          add({
            severity: 'error',
            check: 'locale.valueMissing',
            sourceType,
            id,
            locale: dest,
            detail: `The ${lang} value of "${attr}" is missing from the ${dest} entry: ${JSON.stringify(String(value).slice(0, 120))}`,
          });
        }
      }
    }
  }
}

/** Every declared Media item must become an asset with real bytes on disk. */
function checkAssets(
  mediaBlock: ImpexBlock | undefined,
  migrationDir: string,
  assetIndex: Record<string, any>,
  add: (f: Finding) => void,
): void {
  const failures = readJson(path.join(migrationDir, ASSETS_DIR_NAME, 'logs', 'assets', 'cs_failed.json')) ?? {};
  for (const [key, reason] of Object.entries(failures)) {
    add({ severity: 'critical', check: 'asset.failed', id: key, detail: `Asset could not be resolved: ${reason}` });
  }

  for (const row of mediaBlock?.rows ?? []) {
    const code = row.code;
    if (!code) continue;
    const key = assetKey(code);
    const rec = assetIndex[key];
    if (!rec) {
      if (!failures[key]) {
        add({ severity: 'critical', check: 'asset.missing', id: code, detail: `Media "${code}" produced no asset in the destination.` });
      }
      continue;
    }
    const file = path.join(migrationDir, ASSETS_DIR_NAME, 'files', key, rec.filename);
    let size = -1;
    try {
      size = fs.statSync(file).size;
    } catch {
      /* missing */
    }
    if (size < 0) {
      add({ severity: 'critical', check: 'asset.noFile', id: code, detail: `Asset "${code}" is indexed but its binary is missing at ${file}` });
    } else if (size === 0) {
      add({ severity: 'critical', check: 'asset.empty', id: code, detail: `Asset "${code}" was written as a 0-byte file.` });
    }
  }
}

/** Human-readable report. Returns the text; callers decide where it goes. */
/**
 * Report lines shaped for a running migration's log stream (customLogger), rather
 * than a terminal. One line per severity group — collapsed by check, same as
 * formatReport — so a systemic bug does not flood the log with one line per row.
 * Kept framework-agnostic (plain data, no logging dependency here); the caller
 * decides how each level is actually written.
 */
export function summarizeForLog(report: ReconcileReport): Array<{ level: 'info' | 'warn' | 'error'; message: string }> {
  const lines: Array<{ level: 'info' | 'warn' | 'error'; message: string }> = [];
  const s = report.summary;

  lines.push({
    level: 'info',
    message: `Reconciliation: ${s.sourceRows} source rows across ${s.sourceTypes} types -> ${s.entriesWritten} entries in ${s.contentTypes} content types; assets ${s.assetsDeclared} declared -> ${s.assetsWritten} written; locales ${s.localesDeclared.join(', ') || '(none)'}.`,
  });
  if (report.typeMappingSource === 'heuristic') {
    lines.push({
      level: 'warn',
      message: 'Reconciliation ran without the live content-type mapping; a "type went missing" finding could be a renamed mapping rather than real loss.',
    });
  }
  if (!report.findings.length) {
    lines.push({ level: 'info', message: 'Reconciliation: no findings — every source row, value, translation and asset is accounted for.' });
    return lines;
  }

  for (const sev of ['critical', 'error', 'warning'] as Severity[]) {
    const group = report.findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    const level = sev === 'warning' ? 'warn' : 'error';
    const byCheck = new Map<string, Finding[]>();
    for (const f of group) {
      if (!byCheck.has(f.check)) byCheck.set(f.check, []);
      byCheck.get(f.check)!.push(f);
    }
    for (const [check, list] of byCheck) {
      const where = [list[0].sourceType, list[0].id, list[0].locale].filter(Boolean).join('/');
      lines.push({
        level,
        message: `Reconciliation ${sev.toUpperCase()} [${check}]: ${list.length} finding(s). e.g. ${where ? where + ': ' : ''}${list[0].detail}`,
      });
    }
  }
  return lines;
}

export function formatReport(report: ReconcileReport): string {
  const L: string[] = [];
  const s = report.summary;
  L.push('SAP SmartEdit — migration reconciliation');
  L.push(`  source : ${report.sourcePath}`);
  L.push(`  output : ${report.migrationDir}`);
  if (report.typeMappingSource === 'heuristic') {
    L.push('  NOTE   : type mapping is a heuristic (no live content-type data was passed in);');
    L.push('           a "type.unmapped" finding under this mode may be a renamed mapping, not real loss.');
  }
  L.push('');
  L.push(`  source rows ${s.sourceRows} across ${s.sourceTypes} types -> ${s.entriesWritten} entries in ${s.contentTypes} content types`);
  L.push(`  assets      ${s.assetsDeclared} declared -> ${s.assetsWritten} written`);
  L.push(`  locales     ${s.localesDeclared.join(', ') || '(none)'}`);
  L.push('');
  L.push('  per type:');
  for (const t of report.perType) {
    const flag = t.contentTypeUid ? (t.sourceRows === t.entries ? ' ' : '!') : 'X';
    L.push(`   ${flag} ${t.sourceType.padEnd(28)} ${String(t.sourceRows).padStart(5)} rows -> ${String(t.entries).padStart(5)} entries`);
  }
  L.push('');

  if (!report.findings.length) {
    L.push('  No findings — every source row, value, translation and asset is accounted for.');
    return L.join('\n');
  }

  for (const sev of ['critical', 'error', 'warning'] as Severity[]) {
    const group = report.findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    L.push(`  ${sev.toUpperCase()} (${group.length}):`);
    // Collapse by check so one systemic bug does not print 10,000 lines.
    const byCheck = new Map<string, Finding[]>();
    for (const f of group) {
      if (!byCheck.has(f.check)) byCheck.set(f.check, []);
      byCheck.get(f.check)!.push(f);
    }
    for (const [check, list] of byCheck) {
      L.push(`    [${check}] ${list.length} finding(s)`);
      for (const f of list.slice(0, 10)) {
        const where = [f.sourceType, f.id, f.locale].filter(Boolean).join('/');
        L.push(`      - ${where ? where + ': ' : ''}${f.detail}`);
      }
      if (list.length > 10) L.push(`      … and ${list.length - 10} more`);
    }
    L.push('');
  }
  return L.join('\n');
}
