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
import { randomBytes } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';
import { getMimeTypeFromExtension } from '../utils/mimeTypes.js';

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

/** Contentstack uids are hyphen-free; derive a STABLE one from the source uid. */
const toEntryUid = (id: string): string => String(id).replace(/[^a-z0-9]/gi, '');

/** Stable asset key shared by getAllAssets (index key) and createEntry (lookup). */
const assetKey = (code: string): string => `assets_${String(code).replace(/[^a-z0-9]/gi, '')}`;

// ---------------------------------------------------------------------------
// Minimal ImpEx parser (self-contained; mirrors migration-sap-smartedit's
// upload-api parser so the api side has no cross-package dependency).
// ---------------------------------------------------------------------------
interface ImpexBlock { type: string; columns: string[]; rows: Array<Record<string, string>> }

const MODE_RE = /^(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+(.+)$/i;
const MACRO_RE = /^\$(\w+)\s*=\s*(.+)$/;

/** Resolve a header token to its attribute name, or '' for a system/alias column. */
function columnName(rawToken: string, macros: Record<string, string>): string {
  const token = rawToken.trim();
  if (!token || token.startsWith('&')) return '';
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
  let positional: string[] = []; // '' entries = system columns whose value slot is skipped

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('$')) continue;
    const cells = line.split(';').map((c) => c.trim());
    const modeMatch = cells[0].match(MODE_RE);

    if (modeMatch) {
      currentType = modeMatch[2].trim();
      positional = cells.slice(1).map((tok) => columnName(tok, macros));
      let block = blocks.get(currentType);
      if (!block) {
        block = { type: currentType, columns: [], rows: [] };
        blocks.set(currentType, block);
      }
      positional.forEach((n) => { if (n && !block!.columns.includes(n)) block!.columns.push(n); });
      continue;
    }
    if (!currentType) continue;

    const values = cells.slice(1);
    const row: Record<string, string> = {};
    positional.forEach((name, i) => { if (name && values[i] !== undefined && values[i] !== '') row[name] = values[i]; });
    blocks.get(currentType)!.rows.push(row);
  }
  return blocks;
}

/** Resolve the .impex source file from file_path (single-file) or packagePath. */
function resolveImpexFile(file_path?: string, packagePath?: string): string {
  const tryPath = (p?: string): string | null => {
    if (!p || !fs.existsSync(p)) return null;
    const stat = fs.statSync(p);
    if (stat.isFile()) return p;
    if (stat.isDirectory()) {
      const queue = [p];
      while (queue.length) {
        const dir = queue.shift() as string;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) queue.push(full);
          else if (e.name.toLowerCase().endsWith('.impex')) return full;
        }
      }
    }
    return null;
  };
  const found = tryPath(file_path) ?? tryPath(packagePath);
  if (!found) {
    throw new Error(`Could not locate a .impex export under file_path="${file_path}" or packagePath="${packagePath}"`);
  }
  return found;
}

interface DocRef { type: string; uid: string }
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
    const locale = master_locale || 'en-us';
    const blocks = parseImpex(resolveImpexFile(file_path, packagePath));

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

      const entryData: Record<string, any> = {};
      for (const row of block.rows) {
        const id = row.uid ?? row.code;
        if (!id) continue;
        const uid = toEntryUid(id);
        const entry: any = {
          uid,
          title: row.title ?? row.name ?? `${srcType}-${uid.slice(0, 8)}`,
          locale,
          publish_details: [],
        };
        for (const field of ct?.fieldMapping ?? []) {
          if (field?.isDeleted) continue;
          if (field?.contentstackFieldUid?.includes('.')) continue; // group children (n/a for ImpEx)
          const raw = row[field?.otherCmsField];
          if (raw === undefined) continue;
          const val = transformField(raw, field, docIndex, ctUidByType, assetLookup, counters);
          if (val !== undefined) entry[field.contentstackFieldUid] = val;
        }
        if (!entry.title) entry.title = `${srcType}-${uid.slice(0, 8)}`;
        entryData[uid] = entry;
      }

      const folderPath = path.join(DATA, destinationStackId, ENTRIES_DIR_NAME, folderName, locale);
      await fs.promises.mkdir(folderPath, { recursive: true });
      await fs.promises.writeFile(path.join(folderPath, `${locale}.json`), JSON.stringify(entryData, null, 4), 'utf-8');
      await fs.promises.writeFile(path.join(folderPath, 'index.json'), JSON.stringify({ '1': `${locale}.json` }, null, 4), 'utf-8');
      console.info(`[sap-smartedit] ${ct?.contentstackUid}: wrote ${Object.keys(entryData).length} entries`);
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

    const blocks = parseImpex(resolveImpexFile(file_path, packagePath));
    const media = blocks.get(ASSET_TYPE);
    const index: Record<string, any> = {};
    const failed: Record<string, string> = {};

    for (const row of media?.rows ?? []) {
      const code = row.code;
      if (!code) continue;
      const key = assetKey(code);
      const filename = row.realfilename || path.basename(code);
      const ext = (filename.split('.').pop() || '').toLowerCase();
      const url = row.URL || row.url || '';

      if (!url) { failed[key] = 'no url'; continue; }

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());

        const destDir = path.join(assetsSave, 'files', key);
        await fs.promises.mkdir(destDir, { recursive: true });
        await fs.promises.writeFile(path.join(destDir, filename), buf);

        const headerType = res.headers.get('content-type')?.split(';')[0]?.trim();
        index[key] = {
          uid: key,
          urlPath: `/assets/${key}`,
          status: true,
          content_type: headerType || row.mime || getMimeTypeFromExtension(ext) || 'application/octet-stream',
          file_size: `${buf.length}`,
          tag: [],
          filename,
          url,
          is_dir: false,
          parent_uid: null,
          _version: 1,
          title: row.altText || filename,
          publish_details: [],
          description: row.description || '',
        };
      } catch (e: any) {
        failed[key] = String(e?.message ?? e);
        console.error(`[sap-smartedit] asset download failed for ${code} (${url}):`, e?.message ?? e);
      }
    }

    await fs.promises.writeFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), JSON.stringify(index, null, 4));
    await fs.promises.writeFile(path.join(assetsSave, 'logs', 'assets', 'cs_failed.json'), JSON.stringify(failed, null, 4));
    console.info(`[sap-smartedit] downloaded ${Object.keys(index).length} assets, ${Object.keys(failed).length} failed`);
  } catch (err: any) {
    console.error(`[sap-smartedit] getAllAssets failed:`, err?.message ?? err);
  }
}

async function createLocale(_file_path: string, destinationStackId: string, _projectId: string, project: any): Promise<void> {
  const masterCode: string = project?.stackDetails?.master_locale || 'en-us';
  const localeDir = path.join(DATA, destinationStackId, LOCALE_DIR_NAME);
  await fs.promises.mkdir(localeDir, { recursive: true });
  const uid = newUid();
  await fs.promises.writeFile(
    path.join(localeDir, LOCALE_MASTER_LOCALE),
    JSON.stringify({ [uid]: { code: masterCode, fallback_locale: null, uid, name: masterCode } }, null, 4),
    'utf-8',
  );
  await fs.promises.writeFile(path.join(localeDir, LOCALE_FILE_NAME), JSON.stringify({}, null, 4), 'utf-8');
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
