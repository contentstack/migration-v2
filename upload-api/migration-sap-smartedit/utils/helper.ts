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
}

export interface ImpexTypeBlock {
  type: string;
  columns: Map<string, ImpexColumnDef>;
  rows: Array<Record<string, string>>;
}

export interface ImpexParseResult {
  macros: Record<string, string>;
  blocks: Map<string, ImpexTypeBlock>;
}

const MODE_RE = /^(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+(.+)$/i;
const MACRO_RE = /^\$(\w+)\s*=\s*(.+)$/;

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

  return {
    name,
    raw: token,
    isReference: hasLookup && !isMedia,
    isMedia,
    isUnique,
  };
};

/** Split an ImpEx line into trimmed cells. */
const splitCells = (line: string): string[] => line.split(';').map((c) => c.trim());

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

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // blank / comment
    if (trimmed.startsWith('$')) continue; // macro definition (already captured)

    const cells = splitCells(line);
    const modeMatch = cells[0].match(MODE_RE);

    if (modeMatch) {
      // Header line — token[0] is "MODE Type"; columns start at index 1.
      currentType = modeMatch[2].trim();
      positional = cells.slice(1).map((tok) => parseColumn(tok, macros));

      let block = blocks.get(currentType);
      if (!block) {
        block = { type: currentType, columns: new Map(), rows: [] };
        blocks.set(currentType, block);
      }
      positional.forEach((c) => {
        if (c && !block!.columns.has(c.name)) block!.columns.set(c.name, c);
      });
      continue;
    }

    if (!currentType) continue; // data before any header — skip

    // Data row — cells[1..] align to positional[0..].
    const values = cells.slice(1);
    const row: Record<string, string> = {};
    positional.forEach((col, i) => {
      if (col && values[i] !== undefined && values[i] !== '') row[col.name] = values[i];
    });
    blocks.get(currentType)!.rows.push(row);
  }

  return { macros, blocks };
};
