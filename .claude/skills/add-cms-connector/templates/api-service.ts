// api/src/services/<cms>.service.ts
//
// Transforms the upload-api output / source export into Contentstack import
// files under `cmsMigrationData/<stackId>/`. The method set must match what
// migration.service.ts calls (createEntry / createLocale / createVersionFile;
// optionally getAllAssets / createTaxonomy / createRefrence — note the repo's
// intentional `createRefrence` spelling).
//
// Content-type SCHEMAS are created generically (the mapper UI -> contenTypeMaker
// writes content_types/<cs_uid>.json). This service creates ENTRIES.
//
// Field VALUE transform: there is a shared `entriesFieldCreator`
// (utils/entries-field-creator.utils.ts) but it is tuned for HTML/string content
// (AEM/Sitecore). For a CMS with structured JSON values, hand-roll a small
// `contentstackFieldType` switch like Drupal's `processFieldByType` (and like the
// shipped sanity.service.ts). See reference/entry-creation.md.
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

/**
 * Contentstack `contentstackFieldType` -> API data type. Copied from
 * drupal/content-types.service.ts; extend if this connector adds a new type.
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

// Contentstack entry uids are hyphen-free; derive a STABLE one from the source id
// so references resolve. ADAPT to your source's id field.
const toEntryUid = (id: string): string => String(id).replace(/[^a-z0-9]/gi, '');

/** Last segment of a dotted field uid — group children are stored under it. */
const getLastUid = (uid: string): string => {
  const parts = String(uid).split('.');
  return parts[parts.length - 1];
};

/** Max nested-group recursion. Keep in sync with the parser's MAX_GROUP_DEPTH. */
const MAX_GROUP_DEPTH = 5;

interface DocRef { type: string; uid: string }

interface Counters { assetsSkipped: number; groupsSkipped: number; blocksSkipped: number }

/**
 * Direct children of a (group / modular-blocks) row from the flat fieldMapping:
 * prefix + exactly-one-level match on contentstackFieldUid, with backupFieldUid
 * fallback for UI-remapped parents. Optionally filtered by contentstackFieldType.
 */
function directChildren(field: any, allFields: any[], csType?: string): any[] {
  const parentUid = field?.contentstackFieldUid || '';
  const oldUid = field?.backupFieldUid || '';
  return (allFields ?? []).filter((f: any) => {
    const fUid = f?.contentstackFieldUid || '';
    if (!fUid || f?.isDeleted) return false;
    if (csType && f?.contentstackFieldType !== csType) return false;
    for (const p of [parentUid, oldUid]) {
      if (p && fUid.startsWith(p + '.')) {
        const rest = fUid.substring(p.length + 1);
        if (rest && !rest.includes('.')) return true; // exactly one level deeper
      }
    }
    return false;
  });
}

/**
 * Transform one source value to its Contentstack field value, by target type.
 * ADAPT the readers to your source data shape (this skeleton assumes plain
 * values; e.g. Sanity reads slug.current, portable text, {_ref} references).
 */
function transformField(
  value: any,
  field: any,
  docIndex: Record<string, DocRef>,
  ctUidByType: Record<string, string>,
  assetLookup: Record<string, any>,
  counters: Counters,
  allFields: any[],   // the flat ct.fieldMapping — group/blocks cases find children here
  depth = 0,
): any {
  switch (field?.contentstackFieldType) {
    case 'single_line_text':
    case 'multi_line_text':
    case 'text':
    case 'markdown':
      return typeof value === 'string' ? value : String(value ?? '');

    case 'html':
    case 'json':
      // RTE: convert your source rich text into a Contentstack JSON-RTE doc
      // ({ type:'doc', uid, attrs:{}, children:[{type:'p',uid,attrs:{},children:[{text}]}] }).
      // Don't drop media embedded IN the rich text — emit embedded-asset nodes
      // (resolve via assetLookup; shape in reference/entry-creation.md).
      return value;

    case 'isodate': {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'boolean': return Boolean(value);
    case 'number': return typeof value === 'string' ? Number(value) : value;

    case 'reference': {
      // Resolve source reference(s) -> [{ uid, _content_type_uid }] via docIndex.
      const refs = Array.isArray(value) ? value : [value];
      const out: any[] = [];
      for (const r of refs) {
        const id = r?._ref ?? r?.id ?? r; // ADAPT: how your source points at a target
        const target = docIndex[id];
        if (!target) continue;
        const ctUid = ctUidByType[target.type];
        if (ctUid) out.push({ uid: target.uid, _content_type_uid: ctUid });
      }
      return out;
    }

    case 'file': {
      // Resolve source asset ref(s) to the full asset record written by getAllAssets.
      // ADAPT: extract your source's asset identity (e.g. a hash/id) from `value`.
      // Galleries (arrays of media) reach here as file + advanced.multiple (the
      // parser must map them so — else they'd become a group and drop the assets).
      const resolveOne = (v: any): any => {
        const id = v?.assetId ?? v?.asset?._ref ?? v?._ref; // ADAPT to your source
        const rec = id ? assetLookup[`assets_${id}`] : undefined;
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
      // Build the group from the DOTTED child rows the parser emitted
      // (`<groupUid>.<childUid>`; the entry stores the LAST segment as key).
      if (depth >= MAX_GROUP_DEPTH) { counters.groupsSkipped += 1; return undefined; }
      const children = directChildren(field, allFields);
      if (!children.length) { counters.groupsSkipped += 1; return field?.advanced?.multiple ? [] : undefined; }
      const buildOne = (el: any): any => {
        if (!el || typeof el !== 'object' || Array.isArray(el)) return undefined;
        const out: Record<string, any> = {};
        for (const child of children) {
          const raw = el[child?.otherCmsField];
          if (raw === undefined) continue; // heterogeneous element shapes: absent keys stay unset
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

    case 'modular_blocks': {
      // Heterogeneous source arrays: each element routes to its type's block
      // (block rows = modular_blocks_child children of this field; their
      // otherCmsField holds the RAW source element type). Entry value = array of
      // single-key objects { <blockUid>: { <childUid>: value } } in source order.
      if (depth >= MAX_GROUP_DEPTH) { counters.blocksSkipped += 1; return undefined; }
      const blockRows = directChildren(field, allFields, 'modular_blocks_child');
      if (!blockRows.length) { counters.blocksSkipped += 1; return undefined; }
      const byType = new Map<string, any>();
      for (const b of blockRows) if (b?.otherCmsField && !byType.has(b.otherCmsField)) byType.set(b.otherCmsField, b);
      const out: any[] = [];
      for (const el of Array.isArray(value) ? value : [value]) {
        const t = el?._type; // ADAPT: your source's per-element type discriminator
        const blockRow = t && byType.get(t);
        if (!blockRow) { counters.blocksSkipped += 1; continue; } // untyped / block removed in UI
        const children = directChildren(blockRow, allFields);
        const inner: Record<string, any> = {};
        for (const child of children) {
          const raw = el[child?.otherCmsField];
          if (raw === undefined) continue;
          const v = transformField(raw, child, docIndex, ctUidByType, assetLookup, counters, allFields, depth + 1);
          if (v !== undefined) inner[getLastUid(child.contentstackFieldUid)] = v;
        }
        if (Object.keys(inner).length) out.push({ [getLastUid(blockRow.contentstackFieldUid)]: inner });
      }
      return out.length ? out : undefined;
    }

    default:
      return typeof value === 'object' ? undefined : value;
  }
}

async function createEntry(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string,
  contentTypes: any,   // from fieldAttacher: [{ otherCmsTitle, contentstackUid, type, fieldMapping:[{otherCmsField, contentstackFieldUid, contentstackFieldType, advanced}] }]
  mapperKeys: any,     // { [contentstackUid]: folderName }
  master_locale: string,
  _project: any,
): Promise<void> {
  try {
    const locale = master_locale || 'en-us';

    // 1) READ source records. ADAPT: single file? folder? NDJSON? DB?
    //    CAUTION: for archive connectors file_path is the RAW archive
    //    (legacy_cms.file_path, e.g. backup-export.tar.gz); the extracted dir
    //    is packagePath (extract_path). Resolve against BOTH bases and accept
    //    only a real data file (see sanity.service.ts resolveDataFile) —
    //    trusting file_path alone yields content types but 0 entries/assets.
    const records: any[] = []; // = readNdjson(resolveDataFile(file_path, packagePath)) etc.

    // 1b) Asset lookup written by getAllAssets (re-read from disk; {} if absent).
    let assetLookup: Record<string, any> = {};
    try {
      const idxPath = path.join(DATA, destinationStackId, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE);
      assetLookup = JSON.parse(await fs.promises.readFile(idxPath, 'utf8')) || {};
    } catch { /* assets not generated -> file fields skipped */ }

    // 2) INDEX docs for reference resolution: sourceId -> { type, entryUid }.
    // ADAPT the discriminator fields: `_id` (record id) and `_type` (content-type)
    // are SANITY conventions. Use your source's equivalents — WordPress
    // `wp:post_id` / `wp:post_type`, Contentful `sys.id` / `sys.contentType`, etc.
    const SRC_ID = '_id';
    const SRC_TYPE = '_type';
    const docIndex: Record<string, DocRef> = {};
    records.forEach((d: any) => {
      if (d?.[SRC_ID]) docIndex[d[SRC_ID]] = { type: d[SRC_TYPE], uid: toEntryUid(d[SRC_ID]) };
    });

    // 3) source type -> destination content-type uid (cs_<type> / mapperKeys).
    const cts: any[] = (contentTypes ?? []).filter((ct: any) => ct?.type !== 'global_field');
    const ctUidByType: Record<string, string> = {};
    cts.forEach((ct) => {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (srcType && ctUid) ctUidByType[srcType] = ctUid;
    });

    const counters: Counters = { assetsSkipped: 0, groupsSkipped: 0, blocksSkipped: 0 };

    // 4) Build + WRITE entries per content type.
    for (const ct of cts) {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      const docs = records.filter((d: any) => d?.[SRC_TYPE] === srcType);

      const entryData: Record<string, any> = {};
      for (const doc of docs) {
        const uid = toEntryUid(doc[SRC_ID]);
        const entry: any = { uid, title: doc?.title ?? doc?.name ?? `${srcType}-${uid.slice(0, 6)}`, locale, publish_details: [] };
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
      await fs.promises.writeFile(path.join(folderPath, `${locale}.json`), JSON.stringify(entryData, null, 4), 'utf-8');
      await fs.promises.writeFile(path.join(folderPath, 'index.json'), JSON.stringify({ '1': `${locale}.json` }, null, 4), 'utf-8');
      console.info(`[<cms>] ${ct?.contentstackUid}: wrote ${Object.keys(entryData).length} entries`);
    }

    if (counters.assetsSkipped || counters.groupsSkipped || counters.blocksSkipped) {
      console.info(`[<cms>] skipped — file/assets: ${counters.assetsSkipped}, groups: ${counters.groupsSkipped}, block elements: ${counters.blocksSkipped}`);
    }
  } catch (err: any) {
    console.error(`[<cms>] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
}

/**
 * Register source assets as Contentstack assets. Runs BEFORE createEntry (assets
 * must be on disk when entries are built). Writes assets/{assets.json,index.json,
 * folders.json} + files/<uid>/<filename>; createEntry re-reads index.json.
 * BINARY: download from a CDN url if your export only has urls (wordpress/contentful),
 * or COPY local bytes if your export ships them (sanity images/). See entry-creation.md.
 * CAUTION: same file_path-vs-packagePath rule as createEntry — for archive
 * connectors the binaries live under packagePath's extracted dir, not next to
 * the .tar.gz; resolve the export root against both bases.
 */
async function getAllAssets(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  _projectId: string,
): Promise<void> {
  const assetsSave = path.join(DATA, destinationStackId, ASSETS_DIR_NAME);
  await fs.promises.mkdir(path.join(assetsSave, 'files'), { recursive: true });
  await fs.promises.writeFile(path.join(assetsSave, ASSETS_FILE_NAME), JSON.stringify({ '1': ASSETS_SCHEMA_FILE }, null, 4));
  await fs.promises.writeFile(path.join(assetsSave, ASSETS_FOLDER_FILE_NAME), '{}');

  const index: Record<string, any> = {};
  // For each source asset: derive a STABLE uid (`assets_<identityHash>`), put the
  // bytes at files/<uid>/<filename> (copy local OR download url), then:
  //   const ext = '...'; const size = fs.lstatSync(dest).size;
  //   index[uid] = { uid, urlPath:`/assets/${uid}`, status:true,
  //     content_type: getMimeTypeFromExtension(ext) || 'application/octet-stream',
  //     file_size:`${size}`, tag:[], filename, url:'', is_dir:false, parent_uid:null,
  //     _version:1, title, publish_details:[], description:'' };
  void file_path; void packagePath;

  await fs.promises.writeFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), JSON.stringify(index, null, 4));
}

async function createLocale(_req: any, destinationStackId: string, _projectId: string, project: any): Promise<void> {
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

// Optional, add only if this connector produces them:
// async function createTaxonomy(...) {}
// async function createRefrence(...) {}      // <- intentional spelling to match repo

export const <cms>Service = {
  getAllAssets,   // omit if this connector has no assets
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
