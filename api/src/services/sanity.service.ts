// api/src/services/sanity.service.ts
//
// Transforms the Sanity dataset export (the extracted folder's `data.ndjson`)
// into Contentstack import files under `cmsMigrationData/<stackId>/`. The method
// set mirrors what migration.service.ts calls (createEntry / createLocale /
// createVersionFile).
//
// Design: generic in STRUCTURE (a `contentstackFieldType` switch + the standard
// entries/<ct>/<locale>/<locale>.json layout, like the other connectors) but the
// value readers understand Sanity's data shape (NDJSON, `_type`-tagged objects,
// portable text, references-by-_id).
//
// Covered: single_line_text / multi_line_text / text (incl. slug.current and
// portable-text→plaintext), isodate, boolean, number, json (portable text →
// JSON-RTE incl. inline embedded assets), reference (resolved via a document
// index), file/assets (getAllAssets copies the export's images/ + files/
// binaries; file fields resolve to the full asset record), and nested groups
// (the parser emits dotted child rows `parent.child`; case 'group' builds the
// object / array-of-objects keyed by the last uid segment, recursing children
// through this same switch up to MAX_GROUP_DEPTH).
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
  ASSETS_FAILED_FILE,
} = MIGRATION_DATA_CONFIG;

/**
 * Maps upload-api field types (Contentstack `contentstackFieldType`) to the
 * Contentstack API data types. Copied from drupal/content-types.service.ts.
 */
function mapFieldTypeToDataType(fieldType: string | null | undefined): string {
  if (!fieldType) return 'text';
  const fieldTypeMap: { [key: string]: string } = {
    single_line_text: 'text',
    multi_line_text: 'text',
    text: 'text',
    html: 'html',
    json: 'json',
    markdown: 'text',
    number: 'number',
    boolean: 'boolean',
    isodate: 'isodate',
    file: 'file',
    reference: 'reference',
    taxonomy: 'taxonomy',
    link: 'link',
    dropdown: 'text',
    radio: 'text',
    checkbox: 'boolean',
    global_field: 'global_field',
    group: 'group',
    url: 'text',
  };
  return fieldTypeMap[fieldType] || 'text';
}

// --- source readers (Sanity export = a folder containing data.ndjson) ---

/** BFS-locate the export's primary data file under a directory (or return a file path). */
function findDataFile(inputPath: string, targetName = 'data.ndjson', targetExt = '.ndjson'): string {
  if (!inputPath) throw new Error('No Sanity export path provided.');
  const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
  if (stat?.isFile()) return inputPath;
  if (stat?.isDirectory()) {
    const queue: string[] = [inputPath];
    let firstByExt = '';
    while (queue.length) {
      const dir = queue.shift() as string;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) queue.push(full);
        else if (entry.name === targetName) return full;
        else if (targetExt && entry.name.endsWith(targetExt) && !firstByExt) firstByExt = full;
      }
    }
    if (firstByExt) return firstByExt;
  }
  throw new Error(`Could not find "${targetName}" under: ${inputPath}`);
}

/** Read NDJSON into an array of documents. */
function readNdjson(filePath: string): any[] {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// --- helpers ---

/** Contentstack entry uids are hyphen-free; derive a stable one from the Sanity _id. */
const toEntryUid = (id: string): string => String(id).replace(/^drafts\./, '').replace(/-/g, '');

/** Last segment of a dotted field uid — group children are stored under it. */
const getLastUid = (uid: string): string => {
  const parts = String(uid).split('.');
  return parts[parts.length - 1];
};

/**
 * Max nested-group levels the entry transform recurses into. Keep in sync with
 * the parser (migration-sanity/libs/contentTypes.ts MAX_GROUP_DEPTH) — the
 * parser already falls back to json leaves beyond this, so the api guard is
 * purely defensive against hand-edited mappings.
 */
const MAX_GROUP_DEPTH = 5;

/**
 * The asset IDENTITY hash — the 40-hex hash that appears in the images/ filename,
 * the assets.json key (`image-<hash>`), and the in-document `_sanityAsset` path.
 * (NOTE: this is the document/asset id hash, NOT the record's `sha1hash` field,
 * which is a different content hash.) Both getAllAssets and createEntry key on this.
 */
const ASSET_HASH = /([a-f0-9]{40})/i;

/** Stable Contentstack asset uid derived from the Sanity asset identity hash. */
const toAssetUid = (hash: string): string => `assets_${hash.toLowerCase()}`;

/** Pull the asset identity hash out of an in-document image/file field value. */
function parseAssetHash(value: any): string | null {
  if (!value || typeof value !== 'object') return null;
  // Form A — portable `_sanityAsset`: "image@file://./images/<hash>-<dims>.<ext>"
  // Form B — normalized ref: { asset: { _ref: "image-<hash>-<dims>-<ext>" } }
  const src: string | undefined =
    (typeof value._sanityAsset === 'string' && value._sanityAsset) ||
    (typeof value?.asset?._ref === 'string' && value.asset._ref) ||
    (typeof value?._ref === 'string' && value._ref) ||
    undefined;
  if (!src) return null;
  const m = src.match(ASSET_HASH);
  return m ? m[1].toLowerCase() : null;
}

/** Locate the export root (the dir containing data.ndjson, with sibling images/ files/). */
function findExportRoot(file_path: string, packagePath: string): string {
  for (const candidate of [file_path, packagePath]) {
    if (!candidate) continue;
    try {
      return path.dirname(findDataFile(candidate));
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not locate Sanity export root (no data.ndjson found).');
}

const newUid = (): string => randomBytes(16).toString('hex');

/** Skip Sanity system docs and drafts. */
function isSystemDoc(doc: any): boolean {
  const type: string | undefined = doc?._type;
  if (!type) return true;
  if (type.startsWith('sanity.')) return true;
  if (typeof doc?._id === 'string' && doc._id.startsWith('drafts.')) return true;
  return false;
}

/** Flatten any Sanity value (string / slug / portable text / number) to plain text. */
function toPlainText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    // portable text: concatenate span text per block
    return value
      .map((b: any) => (b?.children ?? []).map((s: any) => s?.text ?? '').join(''))
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') {
    if (value._type === 'slug' || typeof value.current === 'string') return value.current ?? '';
  }
  return '';
}

/** Portable-text span → a JSON-RTE text node, carrying simple marks. */
function spanToTextNode(span: any): any {
  const node: any = { text: span?.text ?? '' };
  const marks: string[] = Array.isArray(span?.marks) ? span.marks : [];
  if (marks.includes('strong')) node.bold = true;
  if (marks.includes('em')) node.italic = true;
  if (marks.includes('underline')) node.underline = true;
  return node;
}

const PT_STYLE_TO_TYPE: { [k: string]: string } = {
  normal: 'p',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  blockquote: 'blockquote',
};

/** A Contentstack JSON-RTE embedded-asset node (shape from entries-field-creator.utils.ts). */
function embeddedAssetNode(rec: any): any {
  return {
    uid: newUid(),
    type: 'reference',
    attrs: {
      'display-type': 'display',
      'asset-uid': rec?.uid,
      'content-type-uid': 'sys_assets',
      'asset-link': rec?.urlPath,
      'asset-name': rec?.title,
      'asset-type': rec?.content_type,
      type: 'asset',
      'class-name': 'embedded-asset',
      inline: false,
    },
    children: [{ text: '' }],
  };
}

/**
 * Convert Sanity portable text to a Contentstack JSON-RTE document. Text blocks
 * become paragraph/heading nodes; inline image/file objects embedded in the
 * portable-text array become embedded-asset reference nodes (resolved against the
 * asset package) rather than being dropped.
 */
function portableTextToJsonRte(
  blocks: any,
  assetLookup: Record<string, any>,
  counters: { assetsSkipped: number; groupsSkipped: number },
): any {
  const arr = Array.isArray(blocks) ? blocks : [];
  const children: any[] = [];
  for (const el of arr) {
    if (!el || typeof el !== 'object') continue;
    if (el._type === 'block') {
      const type = PT_STYLE_TO_TYPE[el?.style] || 'p';
      const kids = (el?.children ?? []).map(spanToTextNode);
      children.push({ type, uid: newUid(), attrs: {}, children: kids.length ? kids : [{ text: '' }] });
      continue;
    }
    // Inline asset (image/file) embedded in portable text -> embedded-asset node.
    const hash = parseAssetHash(el);
    if (hash) {
      const rec = assetLookup[toAssetUid(hash)];
      if (rec) children.push(embeddedAssetNode(rec));
      else counters.assetsSkipped += 1;
    }
    // Other custom inline objects have no schema target here and are skipped.
  }
  return {
    type: 'doc',
    uid: newUid(),
    attrs: {},
    children: children.length
      ? children
      : [{ type: 'p', uid: newUid(), attrs: {}, children: [{ text: '' }] }],
  };
}

interface DocRef {
  type: string;
  uid: string;
}

/** Resolve a Sanity reference value to Contentstack reference array. */
function resolveReference(
  value: any,
  docIndex: Record<string, DocRef>,
  ctUidByType: Record<string, string>,
): any[] {
  const refs = Array.isArray(value) ? value : [value];
  const out: any[] = [];
  for (const r of refs) {
    const ref = r?._ref;
    if (!ref) continue;
    const target = docIndex[ref];
    if (!target) continue; // dangling reference (e.g. asset/system doc)
    const ctUid = ctUidByType[target.type];
    if (!ctUid) continue;
    out.push({ uid: target.uid, _content_type_uid: ctUid });
  }
  return out;
}

/** Transform one source value to its Contentstack field value, by target type. */
function transformField(
  value: any,
  field: any,
  docIndex: Record<string, DocRef>,
  ctUidByType: Record<string, string>,
  assetLookup: Record<string, any>,
  counters: { assetsSkipped: number; groupsSkipped: number },
  allFields: any[],
  depth = 0,
): any {
  switch (field?.contentstackFieldType) {
    case 'single_line_text':
    case 'multi_line_text':
    case 'text':
    case 'markdown':
      return toPlainText(value);

    case 'html':
    case 'json':
      // Sanity rich text is portable text (block[]); inline images become
      // embedded-asset nodes resolved against the asset package.
      return portableTextToJsonRte(value, assetLookup, counters);

    case 'isodate': {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    case 'boolean':
      return Boolean(value);

    case 'number':
      return typeof value === 'string' ? Number(value) : value;

    case 'reference':
      return resolveReference(value, docIndex, ctUidByType);

    case 'file': {
      // Resolve Sanity image/file ref(s) to the Contentstack asset record(s)
      // written by getAllAssets (the entry stores the FULL asset object).
      const resolveOne = (v: any): any => {
        const hash = parseAssetHash(v);
        if (!hash) return undefined;
        const rec = assetLookup[toAssetUid(hash)];
        if (!rec) counters.assetsSkipped += 1;
        return rec;
      };
      if (field?.advanced?.multiple && Array.isArray(value)) {
        const recs = value.map(resolveOne).filter(Boolean);
        return recs.length ? recs : undefined;
      }
      return resolveOne(value) ?? undefined;
    }

    case 'group': {
      // Build the group value from the dotted child rows the parser emitted
      // (child uid = `<groupUid>.<childUid>`; the entry stores the LAST segment).
      if (depth >= MAX_GROUP_DEPTH) {
        counters.groupsSkipped += 1;
        return undefined;
      }
      const parentUid = field?.contentstackFieldUid || '';
      const oldUid = field?.backupFieldUid || '';
      const directChild = (f: any): boolean => {
        const fUid = f?.contentstackFieldUid || '';
        if (!fUid || f?.isDeleted) return false;
        for (const p of [parentUid, oldUid]) {
          if (p && fUid.startsWith(p + '.')) {
            const rest = fUid.substring(p.length + 1);
            if (rest && !rest.includes('.')) return true; // exactly one level deeper
          }
        }
        return false;
      };
      const children = (allFields ?? []).filter(directChild);
      if (!children.length) {
        // no mapped children (legacy mapping / user deleted them) — keep old behavior
        counters.groupsSkipped += 1;
        return field?.advanced?.multiple ? [] : undefined;
      }
      const buildOne = (el: any): any => {
        if (!el || typeof el !== 'object' || Array.isArray(el)) return undefined;
        const out: Record<string, any> = {};
        for (const child of children) {
          const raw = el[child?.otherCmsField];
          if (raw === undefined) continue; // heterogeneous _type union: absent keys stay unset
          const v = transformField(raw, child, docIndex, ctUidByType, assetLookup, counters, allFields, depth + 1);
          if (v !== undefined) out[getLastUid(child.contentstackFieldUid)] = v;
        }
        return Object.keys(out).length ? out : undefined;
      };
      if (field?.advanced?.multiple) {
        const arr = (Array.isArray(value) ? value : [value]).map(buildOne).filter(Boolean);
        return arr.length ? arr : undefined;
      }
      return buildOne(Array.isArray(value) ? value[0] : value);
    }

    default:
      return typeof value === 'object' ? undefined : value;
  }
}

/** Pick a human title for an entry. */
function pickTitle(doc: any, sourceType: string): string {
  for (const key of ['title', 'name', 'heading']) {
    if (typeof doc?.[key] === 'string' && doc[key].trim()) return doc[key];
  }
  if (doc?.firstName || doc?.lastName) return `${doc.firstName ?? ''} ${doc.lastName ?? ''}`.trim();
  return `${sourceType}-${toEntryUid(doc?._id ?? '').slice(0, 6)}`;
}

// --- assets ---

/** Create the Contentstack assets package skeleton (mirrors wordpress startingDirAssests). */
async function startingDirAssets(destinationStackId: string): Promise<{ assetsSave: string; failedPath: string }> {
  const assetsSave = path.join(DATA, destinationStackId, ASSETS_DIR_NAME);
  const logsDir = path.join(DATA, destinationStackId, 'logs', ASSETS_DIR_NAME);
  const failedPath = path.join(logsDir, ASSETS_FAILED_FILE);
  await fs.promises.mkdir(path.join(assetsSave, 'files'), { recursive: true });
  await fs.promises.mkdir(logsDir, { recursive: true });
  await fs.promises.writeFile(path.join(assetsSave, ASSETS_FILE_NAME), JSON.stringify({ '1': ASSETS_SCHEMA_FILE }, null, 4));
  await fs.promises.writeFile(path.join(assetsSave, ASSETS_FOLDER_FILE_NAME), '{}');
  await fs.promises.writeFile(failedPath, '{}');
  return { assetsSave, failedPath };
}

/** Build sha1(identity) -> originalFilename from the export's assets.json (for nicer titles). */
function readOriginalNames(exportRoot: string): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(path.join(exportRoot, 'assets.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([k, v]: any) => ({ _id: k, ...v }));
    records.forEach((rec: any) => {
      const m = String(rec?._id ?? '').match(ASSET_HASH);
      if (m && rec?.originalFilename) map[m[1].toLowerCase()] = rec.originalFilename;
    });
  } catch {
    /* assets.json optional — fall back to hash-based titles */
  }
  return map;
}

/**
 * Register every binary in the export's images/ (and files/) folders as a
 * Contentstack asset: copy the bytes into assets/files/<uid>/ and write the
 * asset-record map to assets/index.json (keyed by `assets_<identityHash>`).
 * Sanity ships the bytes locally, so we COPY (no CDN download).
 */
async function getAllAssets(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string,
): Promise<void> {
  try {
    const { assetsSave, failedPath } = await startingDirAssets(destinationStackId);
    const exportRoot = findExportRoot(file_path, packagePath);
    const nameByHash = readOriginalNames(exportRoot);

    const index: Record<string, any> = {};
    const failed: Record<string, any> = {};

    for (const sub of ['images', 'files']) {
      const dir = path.join(exportRoot, sub);
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue; // folder not present in this export
      }
      for (const name of entries) {
        const hashMatch = name.match(ASSET_HASH);
        if (!hashMatch) continue;
        const hash = hashMatch[1].toLowerCase();
        const ext = path.extname(name).replace(/^\./, '').toLowerCase();
        const assetUid = toAssetUid(hash);
        const filename = `${assetUid}${ext ? `.${ext}` : ''}`;

        const srcPath = path.join(dir, name);
        const destDir = path.join(assetsSave, 'files', assetUid);
        const destPath = path.join(destDir, filename);
        try {
          await fs.promises.mkdir(destDir, { recursive: true });
          if (!fs.existsSync(destPath)) await fs.promises.copyFile(srcPath, destPath);
          const size = fs.lstatSync(destPath).size;
          const original = nameByHash[hash];
          const title = original ? original.replace(/\.[^.]+$/, '') : hash;
          index[assetUid] = {
            uid: assetUid,
            urlPath: `/assets/${assetUid}`,
            status: true,
            content_type: getMimeTypeFromExtension(ext) || 'application/octet-stream',
            file_size: `${size}`,
            tag: [],
            filename,
            url: '',
            is_dir: false,
            parent_uid: null,
            _version: 1,
            title,
            publish_details: [],
            description: '',
          };
        } catch (e: any) {
          failed[assetUid] = { source: srcPath, error: e?.message ?? String(e) };
        }
      }
    }

    await fs.promises.writeFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), JSON.stringify(index, null, 4));
    if (Object.keys(failed).length) await fs.promises.writeFile(failedPath, JSON.stringify(failed, null, 4));
    console.info(`[sanity] getAllAssets: ${Object.keys(index).length} assets registered, ${Object.keys(failed).length} failed`);
  } catch (err: any) {
    console.error(`[sanity] getAllAssets failed for project ${projectId}:`, err?.message ?? err);
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

    // Locate + read the Sanity records (file_path is the extracted export folder).
    let dataFile: string;
    try {
      dataFile = findDataFile(file_path);
    } catch {
      dataFile = findDataFile(packagePath);
    }
    const docs = readNdjson(dataFile).filter((d) => !isSystemDoc(d));

    // Asset lookup written by getAllAssets (re-read from disk; {} if it didn't run).
    let assetLookup: Record<string, any> = {};
    try {
      const idxPath = path.join(DATA, destinationStackId, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE);
      assetLookup = JSON.parse(await fs.promises.readFile(idxPath, 'utf8')) || {};
    } catch {
      /* assets not generated — file fields will be skipped */
    }

    // Index every doc for reference resolution: _id -> { type, entryUid }.
    const docIndex: Record<string, DocRef> = {};
    docs.forEach((d) => {
      if (d?._id) docIndex[d._id] = { type: d._type, uid: toEntryUid(d._id) };
    });

    // Map a Sanity _type -> its destination content-type uid (cs_<type> folder).
    const cts: any[] = (contentTypes ?? []).filter((ct: any) => ct?.type !== 'global_field');
    const ctUidByType: Record<string, string> = {};
    cts.forEach((ct) => {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (srcType && ctUid) ctUidByType[srcType] = ctUid;
    });

    const counters = { assetsSkipped: 0, groupsSkipped: 0 };

    for (const ct of cts) {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      const records = docs.filter((d) => d?._type === srcType);

      const entryData: Record<string, any> = {};
      for (const doc of records) {
        const uid = toEntryUid(doc._id);
        const entry: any = { uid, title: pickTitle(doc, srcType), locale, publish_details: [] };

        for (const field of ct?.fieldMapping ?? []) {
          if (field?.isDeleted) continue;
          // dotted rows are GROUP CHILDREN — handled inside their parent's
          // case 'group'; processing them here would write literal dotted keys
          if (field?.contentstackFieldUid?.includes('.')) continue;
          const raw = doc[field?.otherCmsField];
          if (raw === undefined) continue;
          const val = transformField(raw, field, docIndex, ctUidByType, assetLookup, counters, ct?.fieldMapping ?? []);
          if (val !== undefined) entry[field.contentstackFieldUid] = val;
        }
        entryData[uid] = entry;
      }

      const folderPath = path.join(DATA, destinationStackId, ENTRIES_DIR_NAME, folderName, locale);
      await fs.promises.mkdir(folderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(folderPath, `${locale}.json`),
        JSON.stringify(entryData, null, 4),
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(folderPath, 'index.json'),
        JSON.stringify({ '1': `${locale}.json` }, null, 4),
        'utf-8',
      );
      console.info(`[sanity] ${ct?.contentstackUid}: wrote ${Object.keys(entryData).length} entries`);
    }

    if (counters.assetsSkipped || counters.groupsSkipped) {
      console.info(
        `[sanity] unresolved file refs (no matching asset record): ${counters.assetsSkipped}; ` +
          `groups skipped (no mapped children or depth limit): ${counters.groupsSkipped}.`,
      );
    }
  } catch (err: any) {
    console.error(`[sanity] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
}

async function createLocale(
  _req: any,
  destinationStackId: string,
  projectId: string,
  project: any,
): Promise<void> {
  try {
    const masterCode: string = project?.stackDetails?.master_locale || 'en-us';
    const localeDir = path.join(DATA, destinationStackId, LOCALE_DIR_NAME);
    await fs.promises.mkdir(localeDir, { recursive: true });

    const uid = newUid();
    const masterLocale = {
      [uid]: { code: masterCode, fallback_locale: null, uid, name: masterCode },
    };
    await fs.promises.writeFile(
      path.join(localeDir, LOCALE_MASTER_LOCALE),
      JSON.stringify(masterLocale, null, 4),
      'utf-8',
    );
    // Sanity exports in this pipeline are single-locale; no secondary locales.
    await fs.promises.writeFile(
      path.join(localeDir, LOCALE_FILE_NAME),
      JSON.stringify({}, null, 4),
      'utf-8',
    );
  } catch (err: any) {
    console.error(`[sanity] createLocale failed for project ${projectId}:`, err?.message ?? err);
  }
}

async function createVersionFile(destinationStackId: string, projectId: string): Promise<void> {
  try {
    await fs.promises.writeFile(
      path.join(DATA, destinationStackId, EXPORT_INFO_FILE),
      JSON.stringify({ contentVersion: 2, logsPath: '' }, null, 4),
      'utf-8',
    );
  } catch (err: any) {
    console.error(`[sanity] createVersionFile failed for project ${projectId}:`, err?.message ?? err);
  }
}

export const sanityService = {
  getAllAssets,
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
