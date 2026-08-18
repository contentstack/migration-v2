import fs from 'fs';
import path from 'path';

/** Ensure a directory exists. */
export const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/** Write a JS object as pretty JSON. */
export const writeJson = (filePath: string, data: unknown): void => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

/** Read and parse a JSON file. */
export const readJson = <T = any>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

/**
 * ---------------------------------------------------------------------------
 * ImpEx parser
 * ---------------------------------------------------------------------------
 * SAP Commerce exports content as ImpEx — a header-defined, semicolon-delimited
 * text format (NOT JSON/NDJSON). Structure:
 *
 *   # comment lines start with '#'
 *   $macro = value                         (e.g. $picture = media(code,$contentCV))
 *   INSERT_UPDATE <Type>; col1[unique=true]; $contentCV[unique=true]; col2 ; ...
 *                       ; value1          ;                        ; value2; ...
 *
 * A header line begins with a mode keyword (INSERT_UPDATE / INSERT / UPDATE /
 * REMOVE) followed by the item type. Subsequent non-blank, non-header lines are
 * data rows whose cells align positionally to the header's columns. token[0] of
 * every line is the mode/type cell (blank on data rows) and is ignored — real
 * attributes/values start at index 1.
 *
 * Pragmatic v1: one row per line (no multi-line continuations); catalog-version
 * and document-alias columns are treated as system columns and dropped, but
 * their value slots are preserved so remaining cells stay aligned.
 */

export interface ImpexColumnDef {
  name: string; // resolved attribute name (e.g. 'uid', 'media', 'template')
  raw: string; // original header token
  isReference: boolean; // header carried a (qualifier) foreign-key lookup
  isMedia: boolean; // resolves to a media(...) reference (an asset)
  isUnique: boolean; // [unique=true] modifier
  defaultValue: string; // [default=...] modifier, used when the cell is empty
  lang: string; // this OCCURRENCE's own [lang=xx] modifier — '' when not localized
  locales: string[]; // every distinct [lang=xx] seen for this attribute across the block
}

export interface ImpexTypeBlock {
  type: string;
  columns: Map<string, ImpexColumnDef>;
  rows: Array<Record<string, string>>;
  /**
   * Per-row, per-attribute, per-lang values for attributes with more than one
   * [lang=xx] variant (`title[lang=en]` AND `title[lang=de]`). `rows[]` still holds
   * ONE (primary) value per attribute for every locale-unaware consumer; this is
   * ADDITIONAL data for genuine multi-locale entry creation, keyed by row object
   * identity so no existing row shape has to change.
   */
  localizedValues: Map<Record<string, string>, Record<string, Record<string, string>>>;
}

export interface ImpexParseResult {
  macros: Record<string, string>;
  blocks: Map<string, ImpexTypeBlock>;
}

const MODE_RE = /^(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+(.+)$/i;
const MACRO_RE = /^\$(\w+)\s*=\s*(.+)$/;
/**
 * SAP Backoffice's own CSV/report exports render an empty reference as the
 * literal text "Null" (e.g. AbstractPage.originalPage), not a blank cell —
 * confirmed against a real Electronics Store export. Treat it exactly like
 * an empty cell so it doesn't become a bogus reference target named "Null".
 */
const NULL_LITERAL_RE = /^null$/i;
/**
 * ImpEx scripting directives (`#% beforeEach:`, `#% afterEach: ...`) may be
 * wrapped in quotes, in which case they do NOT start with '#' and so escape the
 * comment check — real SAP sample data contains these, and their body lines were
 * being consumed as data rows of whichever type preceded them.
 */
const DIRECTIVE_RE = /^"?\s*#%/;

/**
 * The value a header token supplies when its cell is left empty, e.g.
 * `approvalStatus(code)[default='approved']`. SAP applies these, so an empty cell is
 * not an empty value. Takes the LAST occurrence, because a lookup path can carry its
 * own nested defaults and the column's own modifier is the trailing one.
 */
const defaultOf = (token: string): string => {
  const found = [...token.matchAll(/\[default\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\]]*))\]/g)];
  if (!found.length) return '';
  const m = found[found.length - 1];
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
};

/** Expand `$macro` references inside a value, resolving nested definitions. */
const expandMacros = (value: string, macros: Record<string, string>): string => {
  let out = value;
  for (let pass = 0; pass < 5; pass++) {
    const next = out.replace(/\$(\w+)/g, (whole, key) => (macros[key] !== undefined ? macros[key] : whole));
    if (next === out) break;
    out = next;
  }
  return out;
};

/** Strip ImpEx [modifiers] from a header token, noting a unique key. */
const stripModifiers = (token: string): { base: string; isUnique: boolean } => {
  const isUnique = /\[[^\]]*unique\s*=\s*true[^\]]*\]/i.test(token);
  const base = token.replace(/\[[^\]]*\]/g, '').trim();
  return { base, isUnique };
};

/**
 * Parse one header token into a column definition, or null if it is a system
 * column that should not become a field (catalog version, document-id alias).
 */
const parseColumn = (
  rawToken: string,
  macros: Record<string, string>,
): ImpexColumnDef | null => {
  const token = rawToken.trim();
  if (!token) return null;
  if (token.startsWith('&')) return null; // document-id alias (e.g. &componentRef)

  const { base, isUnique } = stripModifiers(token);
  if (!base) return null;

  // Resolve a leading macro one level ($picture -> "media(code, $contentCV)").
  let expr = base;
  const macroMatch = expr.match(/^\$(\w+)/);
  if (macroMatch) {
    const macroName = macroMatch[1].toLowerCase();
    if (macroName === 'contentcv' || macroName === 'catalogversion') return null; // system
    if (macros[macroMatch[1]]) expr = macros[macroMatch[1]];
  }

  // Attribute name = leading identifier, before any '(' lookup qualifier.
  const nameMatch = expr.match(/^([A-Za-z0-9_]+)/);
  const name = nameMatch ? nameMatch[1] : '';
  if (!name || name.startsWith('$')) return null;

  const hasLookup = expr.includes('(');
  const isMedia = /^media\b/i.test(expr) || name.toLowerCase() === 'picture';
  const lang = token.match(/\[[^\]]*\blang\s*=\s*([A-Za-z_-]+)/)?.[1] ?? '';

  return {
    name,
    raw: token,
    isReference: hasLookup && !isMedia,
    isMedia,
    isUnique,
    defaultValue: defaultOf(token),
    lang,
    locales: lang ? [lang] : [],
  };
};

/**
 * Strip ImpEx quoting from a single cell.
 *
 * ImpEx wraps a value in double quotes when it contains markup or separators, and
 * escapes an inner quote by doubling it (""). Without unquoting, real content
 * migrates with literal quote characters around it — e.g. the HTML body
 * `"<h2>Oops!</h2>"` became `"\"<h2>Oops!</h2>\""`.
 */
const unquoteCell = (cell: string): string => {
  const t = cell.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
};

/**
 * Split an ImpEx line into trimmed, unquoted cells.
 *
 * Known limitation: the split is not quote-aware, so a ';' *inside* a quoted value
 * would break the row. Verified against the full SAP Spartacus sample data — only
 * ImpEx `#%` script directives (skipped separately) do this, never content rows.
 */
const splitCells = (line: string): string[] => line.split(';').map(unquoteCell);

/** Extract all `$macro = value` definitions from a raw ImpEx file. */
export const parseMacros = (raw: string): Record<string, string> => {
  const macros: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.startsWith('$')) continue;
    const m = trimmed.match(MACRO_RE);
    if (m) macros[m[1]] = m[2].trim();
  }
  return macros;
};

/**
 * Parse an ImpEx file into macros + per-type blocks. Blocks of the same item
 * type appearing multiple times are merged (union of columns, concatenated rows).
 */
export const parseImpex = (filePath: string): ImpexParseResult => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`ImpEx file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const macros = parseMacros(raw);
  const blocks = new Map<string, ImpexTypeBlock>();

  // The current header's columns, positionally aligned to data cells (index 0 =
  // first attribute cell = line cell[1]). null = a system column whose value
  // slot must still be consumed so later cells stay aligned.
  let currentType: string | null = null;
  let positional: (ImpexColumnDef | null)[] = [];
  // REMOVE blocks are deletion instructions, not content. Their cells hold only
  // the unique keys identifying what to delete, so turning them into rows would
  // create stub entries for items that are meant NOT to exist (real Spartacus
  // sample data uses REMOVE heavily to strip default content).
  let skipBlock = false;
  // Inside a multi-line quoted ImpEx scripting directive (`"#% beforeEach:` ...
  // continuation lines ... closing `"`). These aren't comments — they don't start
  // with '#' — so without tracking them their body lines get read as data rows.
  let inDirective = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // blank / comment
    if (trimmed.startsWith('$')) continue; // macro definition (already captured)

    if (inDirective) {
      // An odd number of quotes closes the block.
      if ((trimmed.match(/"/g) ?? []).length % 2 === 1) inDirective = false;
      continue;
    }
    if (DIRECTIVE_RE.test(trimmed)) {
      // A quoted directive left open (odd quote count) continues on later lines.
      if ((trimmed.match(/"/g) ?? []).length % 2 === 1) inDirective = true;
      continue;
    }

    const cells = splitCells(line);
    const modeMatch = cells[0].match(MODE_RE);

    if (modeMatch) {
      // Header line — token[0] is "MODE Type"; columns start at index 1.
      skipBlock = /^REMOVE$/i.test(modeMatch[1]);
      if (skipBlock) {
        currentType = null;
        positional = [];
        continue;
      }
      // The type can carry its own [modifiers] (e.g.
      // `INSERT_UPDATE PromotionSourceRule[$ruleImportProcessor]`,
      // `UPDATE GenericItem[processor=...]`) — strip them so the item type is the
      // bare type name and not a bracketed string used as a content-type name.
      currentType = modeMatch[2].replace(/\[[^\]]*\]/g, '').trim();
      positional = cells.slice(1).map((tok) => parseColumn(tok, macros));

      let block = blocks.get(currentType);
      if (!block) {
        block = { type: currentType, columns: new Map(), rows: [], localizedValues: new Map() };
        blocks.set(currentType, block);
      }
      positional.forEach((c) => {
        if (!c) return;
        const existing = block!.columns.get(c.name);
        if (!existing) {
          block!.columns.set(c.name, c);
          return;
        }
        // Two localized columns of the same attribute (`title[lang=en]` and
        // `title[lang=de]`) are genuinely different per-locale values, captured per row
        // below — record every language seen so extractLocale can discover the full
        // locale set from the schema without re-scanning every row.
        for (const l of c.locales) if (!existing.locales.includes(l)) existing.locales.push(l);
      });
      continue;
    }

    if (!currentType) continue; // data before any header, or inside a REMOVE block

    // Data row — cells[1..] align to positional[0..].
    const block = blocks.get(currentType)!;
    const values = cells.slice(1);
    const row: Record<string, string> = {};
    const rowLocalized: Record<string, Record<string, string>> = {};
    let hasLocalized = false;
    // The file's own declared working language, if any — preferred as the DEFAULT
    // value for a localized column when this row has it, so `row[name]` matches the
    // catalog's stated primary language rather than whichever [lang=xx] column
    // happened to appear first in the header.
    const primaryLang = (macros['lang'] || '').toLowerCase();

    positional.forEach((col, i) => {
      if (!col) return;
      const cell = values[i];
      // An empty cell means "use the header's default" where one is declared — that is
      // how SAP reads it. An explicit "Null" stays empty.
      const v = cell === undefined || cell === '' ? col.defaultValue : cell;
      if (!v || NULL_LITERAL_RE.test(v)) return;
      const expanded = expandMacros(v, macros);

      if (col.lang) {
        hasLocalized = true;
        (rowLocalized[col.name] ??= {})[col.lang.toLowerCase()] = expanded;
      }
      if (row[col.name] === undefined || (col.lang && col.lang.toLowerCase() === primaryLang)) {
        row[col.name] = expanded;
      }
    });
    block.rows.push(row);
    if (hasLocalized) block.localizedValues.set(row, rowLocalized);
  }

  return { macros, blocks };
};

/** Breadth-first collect every *.impex file under a directory (sorted, deterministic). */
export const findImpexFiles = (dir: string): string[] => {
  const found: string[] = [];
  const queue: string[] = [dir];
  while (queue.length) {
    const current = queue.shift() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.name.toLowerCase().endsWith('.impex')) found.push(full);
    }
  }
  return found.sort();
};

/** Merge parsed blocks from one file into an accumulator (union columns, concat rows). */
const mergeBlocks = (target: Map<string, ImpexTypeBlock>, src: Map<string, ImpexTypeBlock>): void => {
  for (const [type, block] of src) {
    let t = target.get(type);
    if (!t) {
      t = { type, columns: new Map(), rows: [], localizedValues: new Map() };
      target.set(type, t);
    }
    for (const [name, col] of block.columns) {
      const existing = t.columns.get(name);
      if (!existing) { t.columns.set(name, col); continue; }
      for (const l of col.locales) if (!existing.locales.includes(l)) existing.locales.push(l);
    }
    for (const [row, localized] of block.localizedValues) t.localizedValues.set(row, localized);
    t.rows.push(...block.rows);
  }
};

/**
 * Parse an ImpEx source that may be a SINGLE `.impex` file OR an export FOLDER
 * (a real SAP export unzips to a directory whose `import/` holds several `.impex`
 * files). For a folder, every `.impex` under it is parsed and merged into one set
 * of per-type blocks.
 */
export const parseImpexPath = (inputPath: string): ImpexParseResult => {
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error(`ImpEx path not found: ${inputPath}`);
  }
  if (fs.statSync(inputPath).isFile()) return parseImpex(inputPath);

  const files = findImpexFiles(inputPath);
  if (!files.length) throw new Error(`No .impex files found under: ${inputPath}`);

  const macros: Record<string, string> = {};
  const blocks = new Map<string, ImpexTypeBlock>();
  for (const file of files) {
    const parsed = parseImpex(file);
    Object.assign(macros, parsed.macros);
    mergeBlocks(blocks, parsed.blocks);
  }
  return { macros, blocks };
};

/** Read `$macro` definitions from a file or the first `.impex` under a folder. */
export const readMacrosFromPath = (inputPath: string): Record<string, string> => {
  if (!inputPath || !fs.existsSync(inputPath)) return {};
  const file = fs.statSync(inputPath).isFile() ? inputPath : findImpexFiles(inputPath)[0];
  if (!file) return {};
  return parseMacros(fs.readFileSync(file, 'utf8'));
};
