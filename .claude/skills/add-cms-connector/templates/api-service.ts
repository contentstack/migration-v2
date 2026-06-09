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

const {
  DATA,
  ENTRIES_DIR_NAME,
  LOCALE_DIR_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_FILE_NAME,
  EXPORT_INFO_FILE,
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
    global_field: 'global_field', group: 'group', url: 'text',
  };
  return fieldTypeMap[fieldType] || 'text';
}

const newUid = (): string => randomBytes(16).toString('hex');

// Contentstack entry uids are hyphen-free; derive a STABLE one from the source id
// so references resolve. ADAPT to your source's id field.
const toEntryUid = (id: string): string => String(id).replace(/[^a-z0-9]/gi, '');

interface DocRef { type: string; uid: string }

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
  counters: { assetsSkipped: number; groupsSkipped: number },
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

    case 'file':
      // Deferred: requires an asset pass (register source assets as Contentstack
      // assets, map id/url -> asset uid). Implement getAllAssets, then resolve here.
      counters.assetsSkipped += 1;
      return undefined;

    case 'group':
      // Deferred unless your parser expands the group's child schema.
      counters.groupsSkipped += 1;
      return field?.advanced?.multiple ? [] : undefined;

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
    //    For folder/archive connectors, file_path is the extracted directory.
    const records: any[] = []; // = readNdjson(findDataFile(file_path)) etc.

    // 2) INDEX docs for reference resolution: sourceId -> { type, entryUid }.
    const docIndex: Record<string, DocRef> = {};
    records.forEach((d: any) => {
      if (d?._id) docIndex[d._id] = { type: d._type, uid: toEntryUid(d._id) };
    });

    // 3) source type -> destination content-type uid (cs_<type> / mapperKeys).
    const cts: any[] = (contentTypes ?? []).filter((ct: any) => ct?.type !== 'global_field');
    const ctUidByType: Record<string, string> = {};
    cts.forEach((ct) => {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (srcType && ctUid) ctUidByType[srcType] = ctUid;
    });

    const counters = { assetsSkipped: 0, groupsSkipped: 0 };

    // 4) Build + WRITE entries per content type.
    for (const ct of cts) {
      const srcType = ct?.otherCmsTitle ?? ct?.contentstackTitle;
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      const docs = records.filter((d: any) => d?._type === srcType);

      const entryData: Record<string, any> = {};
      for (const doc of docs) {
        const uid = toEntryUid(doc._id);
        const entry: any = { uid, title: doc?.title ?? doc?.name ?? `${srcType}-${uid.slice(0, 6)}`, locale, publish_details: [] };
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
      await fs.promises.writeFile(path.join(folderPath, `${locale}.json`), JSON.stringify(entryData, null, 4), 'utf-8');
      await fs.promises.writeFile(path.join(folderPath, 'index.json'), JSON.stringify({ '1': `${locale}.json` }, null, 4), 'utf-8');
      console.info(`[<cms>] ${ct?.contentstackUid}: wrote ${Object.keys(entryData).length} entries`);
    }

    if (counters.assetsSkipped || counters.groupsSkipped) {
      console.info(`[<cms>] deferred — file/assets: ${counters.assetsSkipped}, groups: ${counters.groupsSkipped}`);
    }
  } catch (err: any) {
    console.error(`[<cms>] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
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
// async function getAllAssets(...) {}       // register source assets -> asset uids
// async function createTaxonomy(...) {}
// async function createRefrence(...) {}      // <- intentional spelling to match repo

export const <cms>Service = {
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
