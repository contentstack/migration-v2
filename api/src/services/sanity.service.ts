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
// Covered now: single_line_text / multi_line_text / text (incl. slug.current and
// portable-text→plaintext), isodate, boolean, number, json (portable text →
// JSON-RTE), reference (resolved via a document index).
// Deferred (logged, not silently dropped): `file` assets (needs an asset upload
// pass that registers Sanity images as Contentstack assets) and nested `group`
// expansion (the parser emits groups with an empty child schema).
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';

const {
  DATA,
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
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

/** Convert Sanity portable text (block[]) to a Contentstack JSON-RTE document. */
function portableTextToJsonRte(blocks: any): any {
  const arr = Array.isArray(blocks) ? blocks : [];
  const children = arr
    .filter((b: any) => b && b._type === 'block')
    .map((block: any) => {
      const type = PT_STYLE_TO_TYPE[block?.style] || 'p';
      const kids = (block?.children ?? []).map(spanToTextNode);
      return { type, uid: newUid(), attrs: {}, children: kids.length ? kids : [{ text: '' }] };
    });
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
  counters: { assetsSkipped: number; groupsSkipped: number },
): any {
  switch (field?.contentstackFieldType) {
    case 'single_line_text':
    case 'multi_line_text':
    case 'text':
    case 'markdown':
      return toPlainText(value);

    case 'html':
    case 'json':
      // Sanity rich text is portable text (block[]).
      return portableTextToJsonRte(value);

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

    case 'file':
      // Deferred: needs an asset pass that registers Sanity images/assets as
      // Contentstack assets and maps _sanityAsset/asset._ref -> asset uid.
      counters.assetsSkipped += 1;
      return undefined;

    case 'group':
      // Deferred: the parser emits groups with an empty child schema, so there
      // are no inner field uids to map onto. Emit an empty repeatable group.
      counters.groupsSkipped += 1;
      return field?.advanced?.multiple ? [] : undefined;

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
          const raw = doc[field?.otherCmsField];
          if (raw === undefined) continue;
          const val = transformField(raw, field, docIndex, ctUidByType, counters);
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
        `[sanity] deferred field values — assets(file): ${counters.assetsSkipped}, nested groups: ${counters.groupsSkipped}. ` +
          `These need an asset-upload pass and nested-group schema expansion (not yet implemented).`,
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
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
