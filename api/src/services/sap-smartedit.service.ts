// api/src/services/sap-smartedit.service.ts
//
// Transforms a SAP SmartEdit (SAP Commerce Cloud) ImpEx export into Contentstack
// import files under `cmsMigrationData/<stackId>/`. Content-type SCHEMAS are
// created generically by the mapper; this service creates ENTRIES + ASSETS.
//
// ImpEx is a flat, header-defined, semicolon-delimited text format, so — unlike
// the JSON connectors — there are no nested groups/modular blocks here; every
// column is a scalar, a reference (uid), or a media code. See
// docs/features/sap-smartedit/ and reference/entry-creation.md.
import fs from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { getMimeTypeFromExtension } from '../utils/mimeTypes.js';
import { getAllLocales } from '../utils/index.js';

const {
  DATA,
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  ASSETS_FOLDER_FILE_NAME,
} = MIGRATION_DATA_CONFIG;

/** SAP `Media` items become Contentstack assets, not a content type. */
const ASSET_TYPE = 'Media';

/**
 * Contentstack `contentstackFieldType` -> API data type
 * (from drupal/content-types.service.ts).
 */
function mapFieldTypeToDataType(fieldType: string | null | undefined): string {
  if (!fieldType) return 'text';
  const fieldTypeMap: { [key: string]: string } = {
    single_line_text: 'text', multi_line_text: 'text', text: 'text', html: 'html',
    json: 'json', markdown: 'text', number: 'number', boolean: 'boolean',
    isodate: 'isodate', file: 'file', reference: 'reference', taxonomy: 'taxonomy',
    link: 'link', dropdown: 'text', radio: 'text', checkbox: 'boolean',
    global_field: 'global_field', group: 'group', modular_blocks: 'blocks', url: 'text',
  };
  return fieldTypeMap[fieldType] || 'text';
}

const newUid = (): string => randomBytes(16).toString('hex');

/**
 * Map a SAP ImpEx language code (`$lang = xx` or a `[lang=xx]` column modifier)
 * to a Contentstack locale code. SAP codes are bare ISO 639-1 (`en`, `de`, `fr`);
 * Contentstack needs a language-region code. Common languages are mapped
 * explicitly; anything else falls back to `<code>-<code>` — a documented guess,
 * not authoritative (wrong for e.g. `zh` -> `zh-cn`, `ja` -> `ja-jp`).
 * Duplicated in migration-sap-smartedit/libs/extractLocale.ts — this file has
 * no cross-package dependency on upload-api, by existing convention.
 */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-us', de: 'de-de', fr: 'fr-fr', es: 'es-es', it: 'it-it',
  pt: 'pt-pt', nl: 'nl-nl', ja: 'ja-jp', zh: 'zh-cn', ko: 'ko-kr',
  ru: 'ru-ru', pl: 'pl-pl', sv: 'sv-se', da: 'da-dk', fi: 'fi-fi',
  nb: 'nb-no', tr: 'tr-tr', ar: 'ar-sa', hi: 'hi-in', th: 'th-th',
};
const toContentstackLocale = (code: string): string => {
  const c = code.trim().toLowerCase();
  return LOCALE_MAP[c] ?? `${c}-${c}`;
};

/**
 * Contentstack display names for the locales this connector can produce, used only
 * when the live locale list cannot be fetched. A locale written with its CODE as its
 * name makes the importer block on an un-suppressable interactive prompt (see
 * createLocale), so a wrong-but-plausible name is worse than useless here — these
 * are the exact strings Contentstack uses.
 */
const FALLBACK_LOCALE_NAMES: Record<string, string> = {
  'en-us': 'English - United States', 'de-de': 'German - Germany',
  'fr-fr': 'French - France', 'es-es': 'Spanish - Spain',
  'it-it': 'Italian - Italy', 'pt-pt': 'Portuguese - Portugal',
  'nl-nl': 'Dutch - Netherlands', 'ja-jp': 'Japanese - Japan',
  'zh-cn': 'Chinese - China', 'ko-kr': 'Korean - Korea',
  'ru-ru': 'Russian - Russia', 'pl-pl': 'Polish - Poland',
  'sv-se': 'Swedish - Sweden', 'da-dk': 'Danish - Denmark',
  'fi-fi': 'Finnish - Finland', 'nb-no': 'Norwegian Bokmål - Norway',
  'tr-tr': 'Turkish - Turkey', 'ar-sa': 'Arabic - Saudi Arabia',
  'hi-in': 'Hindi - India', 'th-th': 'Thai - Thailand',
};

/**
 * Contentstack's import tooling expects custom entry uids in its own `blt`+16-hex
 * shape. A plain stripped-alphanumeric uid (e.g. `nimbusBlogPost3`) doesn't match
 * that shape and gets silently discarded and reassigned during import — confirmed
 * live via mapper/entries/uid-mapping.json, which showed effectively every entry
 * remapped this way. Each remap then triggers a reference-fixup pass that also
 * corrupts unrelated plain-text fields that happen to contain the old id as a
 * substring (e.g. a `title` of "body-nimbusBlogPost3" became
 * "body-blt6224c4ff697d1654"). Hashing to a deterministic blt-shaped id instead
 * means Contentstack accepts it as-is, so no remap/fixup pass ever runs.
 */
const toEntryUid = (id: string): string =>
  'blt' + createHash('md5').update(String(id)).digest('hex').slice(0, 16);

/** Stable asset key shared by getAllAssets (index key) and createEntry (lookup). */
const assetKey = (code: string): string => `assets_${String(code).replace(/[^a-z0-9]/gi, '')}`;

/**
 * File extensions treated as migratable assets when sweeping the export directory.
 * Deliberately an allowlist: an SAP export also ships `.impex`, `.properties`, `.xml`,
 * `.vm`/`.vt` templates and `.java`, none of which are content assets.
 */
/**
 * A Media row backed by a real URL is fetched with no timeout by default — a
 * connection that's accepted but never responds (a slow CDN, an outage) would
 * otherwise hang this AWAIT forever. This loop is sequential, so one bad URL
 * anywhere in a real customer's catalog would stall the entire migration with
 * no way to recover short of killing the process. DNS/connection failures
 * already fail fast on their own; this only bounds the "accepted but silent"
 * case. Read fresh on every call (not a module-level constant) so tests can
 * override it via env var to a real, tiny timeout instead of mocking global
 * timers, which fought with the rest of the async runtime.
 */
const assetFetchTimeoutMs = (): number => Number(process.env.SAP_ASSET_FETCH_TIMEOUT_MS) || 30_000;

const ASSET_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tif', 'tiff',
  'pdf', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'woff', 'woff2', 'ttf', 'otf', 'zip',
]);

/**
 * Every asset-like file under the export, as absolute paths.
 *
 * A SAP export carries its binaries on disk, but only a fraction are declared as `Media`
 * rows — the Spartacus sample data ships 17 images and declares 1. The undeclared ones
 * are still the customer's files and are lost if only Media rows are honoured, so they
 * are swept up as assets too.
 */
function findAssetFiles(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      const ext = (e.name.split('.').pop() ?? '').toLowerCase();
      if (ASSET_EXTENSIONS.has(ext)) found.push(full);
    }
  }
  return found.sort();
}

// ---------------------------------------------------------------------------
// Minimal ImpEx parser (self-contained; mirrors migration-sap-smartedit's
// upload-api parser so the api side has no cross-package dependency).
// ---------------------------------------------------------------------------
interface ImpexBlock {
  type: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  /**
   * Columns the header marked `[unique=true]`. ImpEx lets ANY column(s) be the
   * unique key — only some types use `uid`/`code` — so this is what identifies a
   * row for types like ContentSlotName (name + template) or Address
   * (streetname + postalcode + ...). Without it those rows have no key and were
   * dropped entirely.
   */
  uniqueColumns: string[];
  /** attribute name -> distinct SAP [lang=xx] codes seen for it. Absent = never localized. */
  localizedColumns: Record<string, string[]>;
  /**
   * Per-row, per-attribute, per-SAP-lang-code values for columns with more than
   * one [lang=xx] variant (`title[lang=en]` AND `title[lang=de]`). `rows[]` still
   * holds ONE (primary) value per attribute for every locale-unaware consumer;
   * this is ADDITIONAL data for genuine multi-locale entry creation, keyed by row
   * object identity so no existing row shape has to change.
   */
  localizedValues: Map<Record<string, string>, Record<string, Record<string, string>>>;
}

/**
 * The ImpEx column holding a Media item's binary, e.g.
 * `@media[translator=de.hybris.platform.impex.jalo.media.MediaDataTranslator]`.
 * Retained (unlike other `@` columns are conceptually) so assets can be resolved
 * from the export itself; `Media` never becomes a content type, so keeping this
 * key cannot leak into a content-type field.
 */
const MEDIA_SOURCE_KEY = '@media';

const MODE_RE = /^(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+(.+)$/i;
const MACRO_RE = /^\$(\w+)\s*=\s*(.+)$/;
/**
 * SAP Backoffice's own CSV/report exports render an empty reference as the
 * literal text "Null" (e.g. AbstractPage.originalPage), not a blank cell —
 * confirmed against a real Electronics Store export. Treat it exactly like
 * an empty cell so it doesn't become a bogus reference target named "Null"
 * at entry-creation time.
 */
const NULL_LITERAL_RE = /^null$/i;
/**
 * ImpEx scripting directives (`#% beforeEach:`, `#% afterEach: ...`) can be
 * wrapped in quotes, so they don't start with '#' and escape the comment check.
 * Real SAP sample data contains these; untracked, their body lines are consumed
 * as data rows of whichever type preceded them.
 */
const DIRECTIVE_RE = /^"?\s*#%/;

/**
 * Strip ImpEx quoting from a single cell. ImpEx wraps a value in double quotes when
 * it contains markup or separators, escaping an inner quote by doubling it ("").
 * Without this, real content is written with literal quotes around it — the HTML
 * body `"<h2>Oops!</h2>"` became `"\"<h2>Oops!</h2>\""` in the created entry.
 */
const unquoteCell = (cell: string): string => {
  const t = cell.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
};

/**
 * Expand `$macro` references inside a VALUE.
 *
 * ImpEx macros are plain textual substitution, so a value written as
 * `$siteResource/images/Homepage.png` or `$contentCatalog` means nothing unexpanded.
 * This matters beyond cosmetics: such values are often the row's [unique=true] key, so
 * leaving them literal made three different catalogs share the id `$contentCatalog`
 * and collapse into a single entry. An unknown `$name` is left untouched.
 */
const expandMacros = (value: string, macros: Record<string, string>): string => {
  let out = value;
  // A macro definition can itself contain macros — real data has
  // `$syncJob = sync $contentCatalog:Staged->Online` — so one pass leaves the nested
  // reference literal. Iterate until stable, bounded so a self-referential definition
  // cannot loop forever.
  for (let pass = 0; pass < 5; pass++) {
    const next = out.replace(/\$(\w+)/g, (whole, key) => (macros[key] !== undefined ? macros[key] : whole));
    if (next === out) break;
    out = next;
  }
  return out;
};

/**
 * The value a header token supplies when its cell is left empty, e.g.
 * `approvalStatus(code)[default='approved']` or
 * `template(uid,$contentCV)[unique=true][default='CpqConfigurationTemplate']`.
 *
 * SAP applies these, so an empty cell is NOT an empty value — ignoring them dropped
 * real references (a ContentSlotName whose template came from the default looked
 * unlinked) and produced incomplete unique keys. 455 header tokens in the SAP sample
 * data carry a default.
 *
 * Takes the LAST occurrence: a lookup path can carry its own nested defaults
 * (`catalogVersion(Catalog.id[default=$x])[default=$x:Staged]`) and the column's own
 * modifier is the trailing one.
 */
const defaultOf = (token: string): string => {
  const found = [...token.matchAll(/\[default\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\]]*))\]/g)];
  if (!found.length) return '';
  const m = found[found.length - 1];
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
};

/** The [lang=xx] modifier on a header token, or '' when the column isn't localized. */
const langOf = (token: string): string => token.match(/\[[^\]]*\blang\s*=\s*([A-Za-z_-]+)/)?.[1] ?? '';

/** Resolve a header token to its attribute name, or '' for a system/alias column. */
function columnName(rawToken: string, macros: Record<string, string>): string {
  const token = rawToken.trim();
  if (!token || token.startsWith('&')) return '';
  // Keep the Media binary pointer under a reserved key. Every other `@` column stays
  // dropped (its value slot is still consumed, so later cells remain aligned).
  if (token.startsWith('@')) {
    return /^@media\b/i.test(token) ? MEDIA_SOURCE_KEY : '';
  }
  let base = token.replace(/\[[^\]]*\]/g, '').trim();
  const macroMatch = base.match(/^\$(\w+)/);
  if (macroMatch) {
    const m = macroMatch[1].toLowerCase();
    if (m === 'contentcv' || m === 'catalogversion') return '';
    if (macros[macroMatch[1]]) base = macros[macroMatch[1]];
  }
  const nameMatch = base.match(/^([A-Za-z0-9_]+)/);
  const name = nameMatch ? nameMatch[1] : '';
  return name.startsWith('$') ? '' : name;
}

/** Parse an ImpEx file into per-type blocks (merging repeated blocks of a type). */
function parseImpex(filePath: string): Map<string, ImpexBlock> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const macros: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t.startsWith('#') || !t.startsWith('$')) continue;
    const m = t.match(MACRO_RE);
    if (m) macros[m[1]] = m[2].trim();
  }

  const blocks = new Map<string, ImpexBlock>();
  let currentType: string | null = null;
  // One entry per header cell, positionally aligned to data cells. An empty `name`
  // marks a system column whose value slot is still consumed so later cells stay
  // aligned. `def` is the header's [default=...], applied when the cell is empty.
  // `lang` is its [lang=xx] modifier, '' when the column isn't localized.
  let positional: Array<{ name: string; def: string; lang: string }> = [];
  // REMOVE blocks are deletion instructions, not content — their cells carry only
  // the unique keys of what to delete, so creating entries from them would produce
  // stubs for items meant NOT to exist. Real SAP sample data uses REMOVE heavily.
  let skipBlock = false;
  // Inside a multi-line quoted ImpEx scripting directive (see DIRECTIVE_RE).
  let inDirective = false;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('$')) continue;

    if (inDirective) {
      if ((t.match(/"/g) ?? []).length % 2 === 1) inDirective = false;
      continue;
    }
    if (DIRECTIVE_RE.test(t)) {
      if ((t.match(/"/g) ?? []).length % 2 === 1) inDirective = true;
      continue;
    }

    const cells = line.split(';').map(unquoteCell);
    const modeMatch = cells[0].match(MODE_RE);

    if (modeMatch) {
      skipBlock = /^REMOVE$/i.test(modeMatch[1]);
      if (skipBlock) {
        currentType = null;
        positional = [];
        continue;
      }
      // Strip any type-level [modifiers] (e.g. `GenericItem[processor=...]`) so the
      // content type is named after the bare item type.
      currentType = modeMatch[2].replace(/\[[^\]]*\]/g, '').trim();
      const headerTokens = cells.slice(1);
      positional = headerTokens.map((tok) => ({ name: columnName(tok, macros), def: defaultOf(tok), lang: langOf(tok) }));
      let block = blocks.get(currentType);
      if (!block) {
        block = { type: currentType, columns: [], rows: [], uniqueColumns: [], localizedColumns: {}, localizedValues: new Map() };
        blocks.set(currentType, block);
      }
      positional.forEach(({ name, lang }, i) => {
        if (!name) return;
        if (!block!.columns.includes(name)) block!.columns.push(name);
        // Record which columns form this type's unique key.
        if (/\[[^\]]*unique\s*=\s*true[^\]]*\]/i.test(headerTokens[i]) && !block!.uniqueColumns.includes(name)) {
          block!.uniqueColumns.push(name);
        }
        // Two [lang=xx] columns for the same attribute are genuinely different
        // per-locale values (captured per row below) — record every language seen.
        if (lang) {
          const arr = (block!.localizedColumns[name] ??= []);
          if (!arr.includes(lang)) arr.push(lang);
        }
      });
      continue;
    }
    if (!currentType) continue; // data before any header, or inside a REMOVE block

    const block = blocks.get(currentType)!;
    const values = cells.slice(1);
    const row: Record<string, string> = {};
    const rowLocalized: Record<string, Record<string, string>> = {};
    let hasLocalized = false;
    // The file's own declared working language, if any — preferred as the DEFAULT
    // value for a localized column when this row actually has it, so `row[name]`
    // matches the catalog's stated primary language rather than whichever [lang=xx]
    // column happened to appear first in the header.
    const primaryLang = (macros['lang'] || '').toLowerCase();

    positional.forEach(({ name, def, lang }, i) => {
      if (!name) return;
      const cell = values[i];
      // An empty cell means "use the header's default" when one is declared — that is
      // how SAP reads it. NULL_LITERAL rows stay empty (an explicit "no value").
      const v = cell === undefined || cell === '' ? def : cell;
      if (!v || NULL_LITERAL_RE.test(v)) return;
      const expanded = expandMacros(v, macros);

      if (lang) {
        hasLocalized = true;
        (rowLocalized[name] ??= {})[lang.toLowerCase()] = expanded;
      }
      if (row[name] === undefined || (lang && lang.toLowerCase() === primaryLang)) {
        row[name] = expanded;
      }
    });
    block.rows.push(row);
    if (hasLocalized) block.localizedValues.set(row, rowLocalized);
  }
  return blocks;
}

/** The input path handed at migration time — a single .impex file OR an export folder. */
function resolveInputPath(file_path?: string, packagePath?: string): string {
  for (const p of [file_path, packagePath]) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(`Could not locate the export under file_path="${file_path}" or packagePath="${packagePath}"`);
}

/**
 * Locate a Media item's binary inside the export itself.
 *
 * SAP writes the binary pointer as a platform resource reference, not a URL:
 *   jar:de.hybris.platform.<ext>.constants.<X>Constants&/<ext>/import/.../images/foo.png
 * The part after `&` is a path relative to the extension's `resources/` directory, so
 * it maps directly onto the extracted export on disk. Tried in order: the path as-is
 * under the export root, then any file whose path ends with it (handles the
 * `resources/` prefix), then the declared filename anywhere under the root (handles a
 * scoped export where the root is deeper than the recorded path).
 */
function resolveLocalMedia(source: string, exportRoot: string, realFilename?: string): string | null {
  const candidates: string[] = [];
  if (source) {
    const afterAmp = source.includes('&') ? source.slice(source.indexOf('&') + 1) : source;
    candidates.push(afterAmp.replace(/^\/+/, ''));
  }

  for (const rel of candidates) {
    const direct = path.join(exportRoot, rel);
    try {
      if (fs.statSync(direct).isFile()) return direct;
    } catch { /* not there — fall through to the search below */ }
  }

  const suffixes = candidates.map((c) => c.split('/').join(path.sep));
  const stack = [exportRoot];
  let basenameHit: string | null = null;
  while (stack.length) {
    const cur = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (suffixes.some((s) => s && full.endsWith(s))) return full;
      if (realFilename && !basenameHit && e.name === realFilename) basenameHit = full;
    }
  }
  return basenameHit;
}

/** Breadth-first collect every *.impex file under a directory (sorted). */
function findImpexFiles(dir: string): string[] {
  const found: string[] = [];
  const queue = [dir];
  while (queue.length) {
    const current = queue.shift() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) queue.push(full);
      else if (e.name.toLowerCase().endsWith('.impex')) found.push(full);
    }
  }
  return found.sort();
}

/**
 * Parse a single `.impex` file OR an export folder (merge every `.impex` under
 * it) into one set of per-type blocks.
 */
function parseImpexAll(inputPath: string): Map<string, ImpexBlock> {
  if (fs.statSync(inputPath).isFile()) return parseImpex(inputPath);

  const files = findImpexFiles(inputPath);
  if (!files.length) throw new Error(`No .impex files found under: ${inputPath}`);

  const merged = new Map<string, ImpexBlock>();
  for (const file of files) {
    const blocks = parseImpex(file);
    for (const [type, block] of blocks) {
      let t = merged.get(type);
      if (!t) {
        t = { type, columns: [], rows: [], uniqueColumns: [], localizedColumns: {}, localizedValues: new Map() };
        merged.set(type, t);
      }
      for (const c of block.columns) if (!t.columns.includes(c)) t.columns.push(c);
      for (const c of block.uniqueColumns) if (!t.uniqueColumns.includes(c)) t.uniqueColumns.push(c);
      for (const [name, langs] of Object.entries(block.localizedColumns)) {
        const arr = (t.localizedColumns[name] ??= []);
        for (const l of langs) if (!arr.includes(l)) arr.push(l);
      }
      for (const [row, localized] of block.localizedValues) t.localizedValues.set(row, localized);
      t.rows.push(...block.rows);
    }
  }
  return merged;
}

interface DocRef { type: string; uid: string }

/**
 * The source identifier for a row: `uid`/`code` when present, otherwise the values
 * of the columns the header marked `[unique=true]`, joined.
 *
 * Only some ImpEx types key on uid/code. Requiring one silently dropped every row of
 * types keyed on anything else — 848 rows across 22 types in real SAP sample data,
 * including all 262 ContentSlotName rows (keyed on name + template), so those content
 * types were created and left completely empty.
 */
function rowSourceId(row: Record<string, string>, block: ImpexBlock): string | null {
  if (row.uid) return row.uid;
  if (row.code) return row.code;
  const parts = block.uniqueColumns
    .map((c) => row[c])
    .filter((v) => v !== undefined && v !== '');
  return parts.length ? parts.join('-') : null;
}
interface Counters { assetsSkipped: number; refsSkipped: number }

/** Transform one ImpEx cell value to its Contentstack field value, by target type. */
function transformField(
  value: string,
  field: any,
  docIndex: Record<string, DocRef>,
  ctUidByType: Record<string, string>,
  assetLookup: Record<string, any>,
  counters: Counters,
): any {
  switch (field?.contentstackFieldType) {
    case 'single_line_text':
    case 'multi_line_text':
    case 'text':
    case 'markdown':
    case 'url':
      return String(value ?? '');

    case 'html':
      // Contentstack HTML-RTE stores an HTML string directly.
      return String(value ?? '');

    case 'json':
      // Minimal JSON-RTE doc wrapping the text (SAP ImpEx rarely uses this path).
      return { type: 'doc', uid: newUid(), attrs: {}, children: [
        { type: 'p', uid: newUid(), attrs: {}, children: [{ text: String(value ?? '') }] },
      ] };

    case 'isodate': {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'boolean':
      return String(value).toLowerCase() === 'true';
    case 'number': {
      const n = Number(value);
      return isNaN(n) ? undefined : n;
    }

    case 'reference': {
      // ImpEx references are uid strings; lists are comma-separated.
      const ids = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      const out: any[] = [];
      for (const id of ids) {
        const target = docIndex[id];
        if (!target) { counters.refsSkipped += 1; continue; }
        const ctUid = ctUidByType[target.type];
        if (ctUid) out.push({ uid: target.uid, _content_type_uid: ctUid });
        else counters.refsSkipped += 1;
      }
      return out.length ? out : undefined;
    }

    case 'file': {
      // media code(s) -> full asset record(s) written by getAllAssets.
      const codes = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      const recs = codes.map((c) => {
        const rec = assetLookup[assetKey(c)];
        if (!rec) counters.assetsSkipped += 1;
        return rec;
      }).filter(Boolean);
      if (field?.advanced?.multiple) return recs.length ? recs : undefined;
      return recs[0] ?? undefined;
    }

    default:
      return String(value ?? '');
  }
}

/**
 * Every Contentstack destination locale genuinely present in the export: the master
 * locale first, then one per additional SAP language found on a real `[lang=xx]`
 * column, mapped to its own destination locale.
 *
 * createEntry and createLocale MUST derive locales from THIS one function. They
 * previously disagreed — createEntry wrote entry files for de-de/fr-fr/es-es while
 * createLocale hardcoded an empty locales.json, so the stack only ever had its
 * master locale. Contentstack cannot import an entry into a locale that does not
 * exist, so every translation was silently dropped: the entries were on disk, the
 * locale dropdown showed English only.
 */
function discoverLocales(
  blocks: Map<string, ImpexBlock>,
  primaryLocale: string,
): { sapLangByDestLocale: Record<string, string>; destLocales: string[] } {
  const sapLangByDestLocale: Record<string, string> = {};
  for (const block of blocks.values()) {
    for (const langs of Object.values(block.localizedColumns)) {
      for (const l of langs) {
        const dest = toContentstackLocale(l);
        if (dest !== primaryLocale) sapLangByDestLocale[dest] = l.toLowerCase();
      }
    }
  }
  return { sapLangByDestLocale, destLocales: [primaryLocale, ...Object.keys(sapLangByDestLocale)] };
}

async function createEntry(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string,
  contentTypes: any,
  mapperKeys: any,
  master_locale: string,
  _project: any,
): Promise<void> {
  try {
    const primaryLocale = master_locale || 'en-us';
    // The Contentstack PROJECT's configured master locale, not the ImpEx file's
    // own `$lang` macro — these are two independent things that usually agree
    // but are not guaranteed to (a SAP working-language of "de" with a project
    // master locale of "en-us" is a legitimate, real combination).
    const primaryLangCode = primaryLocale.split('-')[0];
    const blocks = parseImpexAll(resolveInputPath(file_path, packagePath));

    // Discover every SAP language actually used via [lang=xx] columns, across every
    // type, and map each to its OWN Contentstack destination locale — real per-field
    // localized content (title[lang=en] + title[lang=de] with genuinely different
    // values) gets migrated as real translations, not collapsed into one locale.
    const { sapLangByDestLocale, destLocales } = discoverLocales(blocks, primaryLocale);

    // asset lookup written by getAllAssets (re-read; {} if absent)
    let assetLookup: Record<string, any> = {};
    try {
      const idxPath = path.join(DATA, destinationStackId, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE);
      assetLookup = JSON.parse(await fs.promises.readFile(idxPath, 'utf8')) || {};
    } catch { /* no assets generated -> file fields skipped */ }

    // index every non-asset record by its uid: uid -> { type, entryUid }
    const docIndex: Record<string, DocRef> = {};
    for (const [type, block] of blocks) {
      if (type === ASSET_TYPE) continue;
      for (const row of block.rows) {
        // Reference targets are keyed on uid/code ONLY. Composite-key rows are still
        // turned into entries below, but are deliberately not indexed here: ImpEx
        // references point at a uid, and adding joined keys to this lookup could make
        // an unrelated cell value resolve to the wrong entry.
        const id = row.uid ?? row.code;
        if (id) docIndex[id] = { type, uid: toEntryUid(id) };
      }
    }

    // source type -> destination content-type uid
    const cts: any[] = (contentTypes ?? []).filter((ct: any) => ct?.type !== 'global_field');
    const ctUidByType: Record<string, string> = {};
    cts.forEach((ct) => {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (srcType && ctUid) ctUidByType[srcType] = ctUid;
    });

    const counters: Counters = { assetsSkipped: 0, refsSkipped: 0 };

    for (const ct of cts) {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      if (srcType === ASSET_TYPE) continue;
      const block = blocks.get(srcType);
      if (!block) continue;
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;

      // A `name`/`title` column is not necessarily the row's identity: relation types
      // repeat the same name across many rows (99 ContentSlotName entries share only a
      // handful of names). Map each candidate label to the distinct entries that claim
      // it, so an ambiguous label can fall back to the row's unique id. Counting
      // distinct uids — not rows — matters because the same item legitimately appears in
      // several blocks (INSERT_UPDATE then UPDATE) that merge into one row list.
      const labelOwners = new Map<string, Set<string>>();
      for (const row of block.rows) {
        const label = row.title ?? row.name;
        const rid = rowSourceId(row, block);
        if (!label || !rid) continue;
        if (!labelOwners.has(label)) labelOwners.set(label, new Set());
        labelOwners.get(label)!.add(toEntryUid(rid));
      }

      for (const destLocale of destLocales) {
        // undefined for the primary locale — every field just uses its default value.
        const sapLang = sapLangByDestLocale[destLocale];

        const entryData: Record<string, any> = {};
        for (const row of block.rows) {
          const id = rowSourceId(row, block);
          if (!id) continue;
          const rowLocalized = block.localizedValues.get(row);
          // A secondary locale only gets an entry for rows SAP actually translated.
          // Writing one anyway (repeating the default-language value) is redundant —
          // Contentstack's own locale fallback already shows the master-locale content
          // when no localized version exists, so a duplicate copy adds nothing and
          // makes untranslated content look translated. The primary locale (sapLang
          // undefined) is unaffected — every row always gets its default-language entry.
          if (sapLang) {
            const hasTranslation = !!rowLocalized
              && Object.values(rowLocalized).some((byLang) => byLang[sapLang] !== undefined);
            if (!hasTranslation) continue;
          }
          const uid = toEntryUid(id);
          const defaultLabel = row.title ?? row.name;
          const unambiguousDefault = defaultLabel && labelOwners.get(defaultLabel)?.size === 1;
          // A field's per-locale value when this row/attribute genuinely has one for
          // the CURRENT destination locale, else its ordinary default value.
          //
          // For the PRIMARY locale specifically (sapLang undefined), the row's
          // parsed default (row[field]) is NOT reliably in the project's actual
          // master language — parseImpex prefers whichever [lang=xx] column
          // matches the FILE's OWN `$lang` macro, which is a property of the
          // source export, not of the destination project. When the two differ,
          // row[field] silently holds the wrong language's text. Checking the
          // row's genuine per-language value for the project's real primary
          // language FIRST avoids that — it only changes anything when SAP's
          // working language and the project's master locale actually disagree;
          // when they agree (the common case) this resolves to the exact same
          // value row[field] already had.
          const localizedValueOf = (field: string): string | undefined =>
            sapLang ? rowLocalized?.[field]?.[sapLang] : rowLocalized?.[field]?.[primaryLangCode];
          const localizedLabel = localizedValueOf('title') ?? localizedValueOf('name');

          const entry: any = {
            uid,
            // Many real SAP types carry no `name`/`title` column at all (e.g.
            // ContentSlotForTemplate is uid/position/pageTemplate/contentSlot only), so
            // the fallback title matters. Use the SOURCE id verbatim: it is the row's
            // [unique=true] key, so it cannot collide, and it is the identifier authors
            // actually recognise. The previous `${srcType}-${uid.slice(0, 8)}` truncated
            // to 8 sanitized chars and collapsed distinct entries into identical titles
            // on real data (17 of 18 apparel-de rows became one title; 15 powertools
            // ContentSlots all became "ContentSlot-BodyCont"). The content type is shown
            // next to the title in Contentstack, so a type prefix adds nothing.
            // Ambiguity is judged on the DEFAULT label (a structural property, not a
            // locale one) — an unambiguous row's title still shows its own locale's text.
            title: unambiguousDefault ? (localizedLabel ?? defaultLabel) : id,
            locale: destLocale,
            publish_details: [],
          };
          for (const field of ct?.fieldMapping ?? []) {
            if (field?.isDeleted) continue;
            if (field?.contentstackFieldUid?.includes('.')) continue; // group children (n/a for ImpEx)
            const otherCmsField = field?.otherCmsField;
            // This row genuinely localizes THIS field (it has a [lang=xx]
            // variant recorded for it, for at least one language) — as
            // opposed to a purely structural/reference field this row never
            // localizes at all (e.g. masterTemplate), which must keep using
            // its default value in every locale (already-tested convention).
            const isLocalizableField = otherCmsField !== undefined && rowLocalized?.[otherCmsField] !== undefined;
            const raw =
              sapLang && isLocalizableField
                // Secondary locale, and this field IS one this row translates —
                // use only the genuine translation. Falling back to the default
                // value here (row has a title[lang=de] but no content[lang=de])
                // used to write the primary-language content verbatim into an
                // otherwise-real secondary-locale entry, making an untranslated
                // field look translated and defeating Contentstack's own
                // locale-fallback display for it.
                ? localizedValueOf(otherCmsField)
                : localizedValueOf(otherCmsField) ?? row[otherCmsField];
            if (raw === undefined) continue;
            const val = transformField(raw, field, docIndex, ctUidByType, assetLookup, counters);
            if (val !== undefined) entry[field.contentstackFieldUid] = val;
          }
          // The field-mapping loop above can overwrite the title computed earlier,
          // because the mapper RE-POINTS a source `name`/`title` column onto uid
          // `title` (ensureMandatoryFields). Two cases must be re-asserted here:
          //   - empty: a mapped title whose source cell was blank.
          //   - AMBIGUOUS: the mapped value is the shared label, which put the SAME
          //     title on every row sharing it — 8 real components all named
          //     "Section" became 8 entries titled "Section", indistinguishable in
          //     Contentstack. The earlier `title:` assignment already handled this,
          //     but the mapped value silently won.
          if (!entry.title || !unambiguousDefault) entry.title = id;
          entryData[uid] = entry;
        }

        const folderPath = path.join(DATA, destinationStackId, ENTRIES_DIR_NAME, folderName, destLocale);
        await fs.promises.mkdir(folderPath, { recursive: true });
        await fs.promises.writeFile(path.join(folderPath, `${destLocale}.json`), JSON.stringify(entryData, null, 4), 'utf-8');
        await fs.promises.writeFile(path.join(folderPath, 'index.json'), JSON.stringify({ '1': `${destLocale}.json` }, null, 4), 'utf-8');
        console.info(`[sap-smartedit] ${ct?.contentstackUid} [${destLocale}]: wrote ${Object.keys(entryData).length} entries`);
      }
    }

    if (counters.assetsSkipped || counters.refsSkipped) {
      console.info(`[sap-smartedit] unresolved — assets: ${counters.assetsSkipped}, references: ${counters.refsSkipped}`);
    }
  } catch (err: any) {
    console.error(`[sap-smartedit] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
}

/**
 * Register SAP Media items as Contentstack assets. Runs BEFORE createEntry so the
 * asset records exist on disk when entries are built.
 *
 * SAP Media carries a `URL` (the DAM/media url), so we DOWNLOAD the binary from it
 * (the WordPress/Contentful pattern) and write it to files/<uid>/<filename>; the
 * import then uploads that file. An asset whose download fails is recorded in
 * logs/assets/cs_failed.json and left out of index.json (so the import doesn't
 * ENOENT and dependent `file` fields simply resolve to nothing).
 */
async function getAllAssets(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  _projectId: string,
): Promise<void> {
  try {
    const assetsSave = path.join(DATA, destinationStackId, ASSETS_DIR_NAME);
    await fs.promises.mkdir(path.join(assetsSave, 'files'), { recursive: true });
    await fs.promises.mkdir(path.join(assetsSave, 'logs', 'assets'), { recursive: true });
    await fs.promises.writeFile(path.join(assetsSave, ASSETS_FILE_NAME), JSON.stringify({ '1': ASSETS_SCHEMA_FILE }, null, 4));
    await fs.promises.writeFile(path.join(assetsSave, ASSETS_FOLDER_FILE_NAME), '{}');

    const inputPath = resolveInputPath(file_path, packagePath);
    // Media binaries live beside the .impex files, so a single-file input still needs a
    // directory to search from.
    const exportRoot = fs.statSync(inputPath).isFile() ? path.dirname(inputPath) : inputPath;

    const blocks = parseImpexAll(inputPath);
    const media = blocks.get(ASSET_TYPE);
    const index: Record<string, any> = {};
    const failed: Record<string, string> = {};

    // Local file registered per asset key. Several Media rows can share one `code` (each
    // catalog declares `homepagePreview-spa` pointing at its OWN Homepage.png) and the
    // last write wins, so only the file that actually ends up in the index may be
    // treated as claimed — otherwise the other catalogs' files are neither registered
    // here nor picked up by the sweep below, and vanish.
    const keyToLocalPath = new Map<string, string>();

    for (const row of media?.rows ?? []) {
      const code = row.code;
      if (!code) continue;
      const key = assetKey(code);
      const filename = row.realfilename || path.basename(code);
      const ext = (filename.split('.').pop() || '').toLowerCase();
      const url = row.URL || row.url || '';

      try {
        let buf: Buffer;
        let headerType: string | undefined;
        let sourceForRecord = url;

        if (url) {
          const timeoutMs = assetFetchTimeoutMs();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          let res: Response;
          try {
            res = await fetch(url, { signal: controller.signal });
          } catch (fetchErr: any) {
            if (fetchErr?.name === 'AbortError') {
              throw new Error(`asset fetch timed out after ${timeoutMs / 1000}s`);
            }
            throw fetchErr;
          } finally {
            clearTimeout(timeoutId);
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buf = Buffer.from(await res.arrayBuffer());
          headerType = res.headers.get('content-type')?.split(';')[0]?.trim();
        } else {
          // No URL: SAP references the binary as a platform resource path, which points
          // at a file inside the export itself. Read it from disk instead.
          const localPath = resolveLocalMedia(row[MEDIA_SOURCE_KEY] ?? '', exportRoot, filename);
          if (!localPath) {
            failed[key] = `binary not found in export (source="${row[MEDIA_SOURCE_KEY] ?? ''}", filename="${filename}")`;
            continue;
          }
          buf = await fs.promises.readFile(localPath);
          sourceForRecord = `file://${localPath}`;
          keyToLocalPath.set(key, path.resolve(localPath));
        }

        const destDir = path.join(assetsSave, 'files', key);
        await fs.promises.mkdir(destDir, { recursive: true });
        await fs.promises.writeFile(path.join(destDir, filename), buf);

        index[key] = {
          uid: key,
          urlPath: `/assets/${key}`,
          status: true,
          content_type: headerType || row.mime || getMimeTypeFromExtension(ext) || 'application/octet-stream',
          file_size: `${buf.length}`,
          tag: [],
          filename,
          url: sourceForRecord,
          is_dir: false,
          parent_uid: null,
          _version: 1,
          title: row.altText || filename,
          publish_details: [],
          description: row.description || '',
        };
      } catch (e: any) {
        failed[key] = String(e?.message ?? e);
        console.error(`[sap-smartedit] asset resolution failed for ${code}:`, e?.message ?? e);
      }
    }

    const declaredCount = Object.keys(index).length;

    // ---------------------------------------------------------------------------
    // Sweep the export for asset files that no Media row declares.
    //
    // SAP only registers a fraction of the binaries it ships as `Media` items — the
    // Spartacus sample data carries 17 images and declares 1 — because the rest are
    // referenced by the storefront or by a base extension rather than by the CMS. They
    // are still the customer's files, and honouring Media rows alone silently leaves
    // them behind, so they are migrated as assets too.
    //
    // Keyed on the path RELATIVE TO THE EXPORT, not the filename: real exports repeat
    // filenames across catalogs with different content (three distinct Homepage.png,
    // four SAP_scrn_R.png), which a filename key would collapse into one asset.
    // ---------------------------------------------------------------------------
    const claimedPaths = new Set(
      [...keyToLocalPath.entries()].filter(([k]) => index[k]).map(([, p]) => p),
    );
    const discovered = findAssetFiles(exportRoot).filter((f) => !claimedPaths.has(path.resolve(f)));

    // Title = the shortest trailing path segments that identify the file uniquely, so a
    // one-off keeps a clean `users.svg` while repeats grow only as far as needed
    // (`electronicsContentCatalog/images/theme/SAP_scrn_R.png`). Mirrors how ambiguous
    // entry titles are handled: disambiguate only where it is actually ambiguous.
    // Titles already taken by Media-declared assets must be avoided too: a declared
    // asset titled `undeclared.svg` and a swept file of the same name would otherwise be
    // indistinguishable in Contentstack.
    const usedTitles = new Set(Object.values(index).map((a: any) => a.title));
    const relOf = (f: string) => path.relative(exportRoot, f).split(path.sep);
    const titleFor = (file: string): string => {
      const segs = relOf(file);
      for (let take = 1; take <= segs.length; take++) {
        const candidate = segs.slice(-take).join('/');
        const clashes = discovered.filter((o) => relOf(o).slice(-take).join('/') === candidate);
        if (clashes.length === 1 && !usedTitles.has(candidate)) return candidate;
      }
      return segs.join('/');
    };

    for (const file of discovered) {
      const rel = path.relative(exportRoot, file);
      const key = assetKey(rel);
      const filename = path.basename(file);
      const ext = (filename.split('.').pop() ?? '').toLowerCase();
      // Reserve the chosen title so two swept files cannot land on the same one.
      const assignedTitle = titleFor(file);
      usedTitles.add(assignedTitle);
      try {
        const buf = await fs.promises.readFile(file);
        const destDir = path.join(assetsSave, 'files', key);
        await fs.promises.mkdir(destDir, { recursive: true });
        await fs.promises.writeFile(path.join(destDir, filename), buf);

        index[key] = {
          uid: key,
          urlPath: `/assets/${key}`,
          status: true,
          content_type: getMimeTypeFromExtension(ext) || 'application/octet-stream',
          file_size: `${buf.length}`,
          tag: [],
          filename,
          url: `file://${file}`,
          is_dir: false,
          parent_uid: null,
          _version: 1,
          title: assignedTitle,
          publish_details: [],
          description: rel,
        };
      } catch (e: any) {
        failed[key] = String(e?.message ?? e);
        console.error(`[sap-smartedit] asset read failed for ${rel}:`, e?.message ?? e);
      }
    }

    await fs.promises.writeFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), JSON.stringify(index, null, 4));
    await fs.promises.writeFile(path.join(assetsSave, 'logs', 'assets', 'cs_failed.json'), JSON.stringify(failed, null, 4));
    console.info(
      `[sap-smartedit] assets: ${Object.keys(index).length} total ` +
      `(${declaredCount} from Media declarations, ${Object.keys(index).length - declaredCount} found in the export), ` +
      `${Object.keys(failed).length} failed`,
    );
  } catch (err: any) {
    console.error(`[sap-smartedit] getAllAssets failed:`, err?.message ?? err);
  }
}

async function createLocale(file_path: string, destinationStackId: string, _projectId: string, project: any): Promise<void> {
  const masterCode: string = project?.stackDetails?.master_locale || 'en-us';
  const localeDir = path.join(DATA, destinationStackId, LOCALE_DIR_NAME);
  await fs.promises.mkdir(localeDir, { recursive: true });

  // A locale's `name` must be its HUMAN-READABLE Contentstack name ("English -
  // United States"), not its code. The importer compares the destination stack's
  // master-locale name against the one written here and, when they differ, blocks
  // on an interactive "update name of master language? (Y/n)" prompt that `--yes`
  // does NOT suppress (cli-cm-import/lib/import/modules/locales.js). Run from the
  // UI there is no terminal to answer it, so the migration hangs forever. Writing
  // `name: masterCode` was exactly that mismatch.
  const [localeErr, localeNames] = await getAllLocales();
  if (localeErr) {
    console.error(`[sap-smartedit] could not fetch Contentstack locale names (${localeErr?.message ?? localeErr}); falling back to built-in names.`);
  }
  // getAllLocales() genuinely resolves a code-keyed map ({"de-de": "German -
  // Germany", ...}), confirmed by calling it directly against the real
  // Contentstack /locales endpoint — NOT an array, despite that being a
  // plausible-looking claim (an automated review raised it, reasoning from
  // the Locale TS interface and how other connectors use the return value).
  // Trusted that reasoning without checking the real response first; the
  // direct call proved it wrong before any of it shipped.
  // A genuinely unrecognized/custom code (in neither Contentstack's own locale
  // list nor the fallback table above) must NOT fall back to the code itself —
  // that reproduces the exact "name equals code" shape this function exists to
  // avoid. The locale is still created (custom locales are supported and
  // expected), just under a name that can't collide with its own code.
  const nameFor = (code: string): string =>
    localeNames[code] || FALLBACK_LOCALE_NAMES[code] || `Custom Locale (${code})`;

  const uid = newUid();
  await fs.promises.writeFile(
    path.join(localeDir, LOCALE_MASTER_LOCALE),
    JSON.stringify({ [uid]: { code: masterCode, fallback_locale: null, uid, name: nameFor(masterCode) } }, null, 4),
    'utf-8',
  );

  // Create a real destination locale for every additional language the export
  // genuinely localizes into, so createEntry's per-locale entry files can actually
  // be imported. Each falls back to the master locale, matching how the other
  // connectors write this file (cf. contentful.service.ts).
  const locales: Record<string, any> = {};
  try {
    const blocks = parseImpexAll(resolveInputPath(file_path, project?.extract_path));
    const { destLocales } = discoverLocales(blocks, masterCode);
    for (const code of destLocales) {
      if (code === masterCode) continue;
      const lUid = newUid();
      locales[lUid] = { code, name: nameFor(code), fallback_locale: masterCode, uid: lUid };
    }
    if (Object.keys(locales).length) {
      console.info(`[sap-smartedit] locales: master ${masterCode} + ${Object.keys(locales).map((k) => locales[k].code).join(', ')}`);
    }
  } catch (err: any) {
    // A locale file with only the master is the old behavior — degrade to it rather
    // than failing the whole migration, but say so loudly, because silently landing
    // here is what made the missing translations so hard to spot.
    console.error(`[sap-smartedit] createLocale could not read the export (${err?.message ?? err}); only the master locale ${masterCode} will be created.`);
  }
  await fs.promises.writeFile(path.join(localeDir, LOCALE_FILE_NAME), JSON.stringify(locales, null, 4), 'utf-8');
}

async function createVersionFile(destinationStackId: string, _projectId: string): Promise<void> {
  await fs.promises.writeFile(
    path.join(DATA, destinationStackId, EXPORT_INFO_FILE),
    JSON.stringify({ contentVersion: 2, logsPath: '' }, null, 4),
    'utf-8',
  );
}

export const sapSmarteditService = {
  getAllAssets,
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };

/**
 * Internals exposed for the reconciliation harness
 * (sap-smartedit-reconcile.service.ts), which must read the SOURCE export exactly
 * the way the migration did — reimplementing the parser there would let the two
 * drift and quietly agree on the same wrong answer, which is the failure mode the
 * harness exists to catch.
 */
export { parseImpexAll, rowSourceId, resolveInputPath, toEntryUid, assetKey, ASSET_TYPE };
export type { ImpexBlock };
