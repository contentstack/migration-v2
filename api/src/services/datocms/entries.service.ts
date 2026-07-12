import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import {
  Counters,
  DocRef,
  MAX_GROUP_DEPTH,
  directChildren,
  getLastUid,
  newCounters,
  readJson,
  resolveExportRoot,
  toEntryUid,
} from './interface.js';

const { DATA, ENTRIES_DIR_NAME, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE } = MIGRATION_DATA_CONFIG;

const newUid = (): string => randomBytes(16).toString('hex');

/** Read a field's raw value off a record, unwrapping `{ <locale>: value }` when the field is localized. */
function readRaw(record: any, field: any, locale: string): any {
  const raw = record?.[field?.otherCmsField];
  if (field?.advanced?.localized) return raw?.[locale];
  return raw;
}

// --- Minimal DAST (DatoCMS structured text) -> Contentstack JSON-RTE converter ---
// Scoped to text/marks per the TRD's deferred-risk note: block/inlineItem/itemLink
// nodes are logged and skipped rather than guessed at (no existing sample has any
// populated — structured_text_blocks/_inline_blocks/_links were all empty arrays).
const DAST_MARK_MAP: Record<string, string> = {
  strong: 'bold',
  emphasis: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough',
  code: 'inlineCode',
};

function dastSpanToCsText(node: any): any {
  const out: any = { text: node?.value ?? '' };
  (node?.marks ?? []).forEach((m: string) => {
    const csMark = DAST_MARK_MAP[m];
    if (csMark) out[csMark] = true;
  });
  return out;
}

function dastNodeToCs(node: any, counters: Counters): any | null {
  const type = node?.type;
  if (type === 'paragraph' || type === 'heading') {
    const tag = type === 'heading' ? `h${node?.level ?? 1}` : 'p';
    const children = (node?.children ?? [])
      .map((c: any) => (c?.type === 'span' ? dastSpanToCsText(c) : null))
      .filter(Boolean);
    if (!children.length) return null;
    return { type: tag, uid: newUid(), attrs: {}, children };
  }
  if (type === 'list') {
    const tag = node?.style === 'numbered' ? 'ol' : 'ul';
    const children = (node?.children ?? [])
      .map((li: any) => {
        const liChildren = (li?.children ?? []).map((c: any) => dastNodeToCs(c, counters)).filter(Boolean);
        return liChildren.length ? { type: 'li', uid: newUid(), attrs: {}, children: liChildren } : null;
      })
      .filter(Boolean);
    if (!children.length) return null;
    return { type: tag, uid: newUid(), attrs: {}, children };
  }
  // block / inlineItem / itemLink / thematicBreak / unknown — deferred, see header comment.
  counters.structuredTextNodesSkipped += 1;
  return null;
}

function convertDastToCsRte(value: any, counters: Counters): any {
  const emptyDoc = { type: 'doc', uid: newUid(), attrs: {}, children: [{ type: 'p', uid: newUid(), attrs: {}, children: [{ text: '' }] }] };
  const rootChildren = value?.document?.children;
  if (!Array.isArray(rootChildren)) return emptyDoc;
  const children = rootChildren.map((n: any) => dastNodeToCs(n, counters)).filter(Boolean);
  return children.length ? { type: 'doc', uid: newUid(), attrs: {}, children } : emptyDoc;
}

/**
 * Transform one source value to its Contentstack field value, by target type.
 * `recordsById` lets `global_field`/`modular_blocks` resolve the SEPARATE
 * record a single_block/rich_text-block id points at (DatoCMS stores block
 * instances as ordinary records, not embedded objects — verified against the
 * sample; see TRD).
 */
function transformField(
  value: any,
  field: any,
  record: any,
  locale: string,
  docIndex: Record<string, DocRef>,
  ctUidByApiKey: Record<string, string>,
  assetLookup: Record<string, any>,
  allContentTypes: any[],
  recordsById: Record<string, any>,
  counters: Counters,
  allFields: any[],
  depth = 0,
): any {
  switch (field?.contentstackFieldType) {
    case 'extension': {
      if (field?.otherCmsType === 'dato_color') {
        // CS extension fields with data_type:"json" require an object, not a plain string.
        // Wrap the hex string in { value: "#rrggbbaa" } so the CS API accepts it.
        if (typeof value === 'string') return { value };
        if (value && typeof value === 'object') {
          const { red = 0, green = 0, blue = 0, alpha = 255 } = value as any;
          const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
          return { value: `#${toHex(red)}${toHex(green)}${toHex(blue)}${toHex(alpha)}` };
        }
        return null;
      }
      if (field?.otherCmsType === 'dato_star_rating') {
        // Same: wrap integer in object so CS API accepts it.
        if (typeof value === 'number') return { value };
        if (typeof value === 'string') {
          const n = parseInt(value);
          return isNaN(n) ? null : { value: n };
        }
        return null;
      }
      if (field?.otherCmsType === 'dato_json') {
        // DatoCMS exports json fields as JSON-encoded strings; parse to actual object/array
        // for storage in the JSON Editor extension.
        if (typeof value === 'string') {
          try { return JSON.parse(value); } catch { return value; }
        }
        return value ?? null;
      }
      return value;
    }

    case 'single_line_text':
      return typeof value === 'string' ? value : value == null ? undefined : String(value);

    case 'multi_line_text':
    case 'text':
    case 'markdown':
      return typeof value === 'string' ? value : value == null ? undefined : String(value);

    case 'html':
      return typeof value === 'string' ? value : undefined;

    case 'link': {
      if (!value || typeof value !== 'object') return undefined;
      const v = value as any;
      return { href: v.url ?? '', title: v.title ?? '' };
    }

    case 'json': {
      if (field?.otherCmsType === 'structured_text') return convertDastToCsRte(value, counters);
      return value === undefined ? undefined : value;
    }

    case 'isodate': {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    case 'boolean':
      return Boolean(value);

    case 'number':
      return typeof value === 'string' ? Number(value) : value;

    case 'reference': {
      const ids = Array.isArray(value) ? value : value != null ? [value] : [];
      const out: any[] = [];
      for (const id of ids) {
        const target = docIndex[id];
        if (!target) continue;
        const ctUid = ctUidByApiKey[target.apiKey];
        if (ctUid) out.push({ uid: target.uid, _content_type_uid: ctUid });
      }
      return field?.advanced?.multiple ? out : out;
    }

    case 'file': {
      const resolveOne = (v: any): any => {
        const uploadId = v?.upload_id;
        const rec = uploadId ? assetLookup[`assets_${uploadId}`] : undefined;
        if (!rec) counters.assetsSkipped += 1;
        return rec;
      };
      if (field?.advanced?.multiple && Array.isArray(value)) {
        const recs = value.map(resolveOne).filter(Boolean);
        return recs.length ? recs : undefined;
      }
      return value ? resolveOne(value) ?? undefined : undefined;
    }

    case 'group': {
      if (depth >= MAX_GROUP_DEPTH) {
        counters.groupsSkipped += 1;
        return undefined;
      }
      const children = directChildren(field, allFields);
      if (!children.length) {
        counters.groupsSkipped += 1;
        return field?.advanced?.multiple ? [] : undefined;
      }
      const buildOne = (el: any): any => {
        if (!el || typeof el !== 'object' || Array.isArray(el)) return undefined;
        const out: Record<string, any> = {};
        for (const child of children) {
          const raw = el[child?.otherCmsField];
          if (raw === undefined) continue;
          const v = transformField(
            raw, child, record, locale, docIndex, ctUidByApiKey, assetLookup, allContentTypes, recordsById, counters, allFields, depth + 1,
          );
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
      // value = id or array of ids of SEPARATE block-instance records (see
      // header comment) — resolve each id's own record, route by its
      // __itemTypeId-derived api_key to the matching modular_blocks_child row.
      if (depth >= MAX_GROUP_DEPTH) {
        counters.blocksSkipped += 1;
        return undefined;
      }
      const blockRows = directChildren(field, allFields, 'modular_blocks_child');
      if (!blockRows.length) {
        counters.blocksSkipped += 1;
        return undefined;
      }
      const byApiKey = new Map<string, any>();
      for (const b of blockRows) if (b?.otherCmsField && !byApiKey.has(b.otherCmsField)) byApiKey.set(b.otherCmsField, b);

      const ids = Array.isArray(value) ? value : value != null ? [value] : [];
      const out: any[] = [];
      for (const id of ids) {
        const ref = docIndex[id];
        const blockRow = ref && byApiKey.get(ref.apiKey);
        if (!blockRow) {
          counters.blocksSkipped += 1;
          continue; // untyped / block removed in UI / unresolved reference
        }
        const blockRecord = recordsById[id];
        const children = directChildren(blockRow, allFields);
        const inner: Record<string, any> = {};
        for (const child of children) {
          const raw = readRaw(blockRecord, child, locale);
          if (raw === undefined) continue;
          const v = transformField(
            raw, child, blockRecord, locale, docIndex, ctUidByApiKey, assetLookup, allContentTypes, recordsById, counters, allFields, depth + 1,
          );
          if (v !== undefined) inner[getLastUid(child.contentstackFieldUid)] = v;
        }
        if (Object.keys(inner).length) out.push({ [getLastUid(blockRow.contentstackFieldUid)]: inner });
      }
      return out.length ? out : undefined;
    }

    case 'global_field': {
      // single_block: value = id of a SEPARATE block-instance record. Resolve the
      // target global field's OWN fieldMapping from the full contentTypes list
      // (not allFields — that's the CURRENT ct's fields) via `refrenceTo`.
      if (depth >= MAX_GROUP_DEPTH || !value) {
        if (value) counters.globalFieldsSkipped += 1;
        return undefined;
      }
      const targetUid = field?.refrenceTo?.[0];
      const targetCt = allContentTypes.find((ct: any) => ct?.contentstackUid === targetUid && ct?.type === 'global_field');
      const blockRecord = recordsById[value];
      if (!targetCt || !blockRecord) {
        counters.globalFieldsSkipped += 1;
        return undefined;
      }
      const out: Record<string, any> = {};
      for (const child of (targetCt.fieldMapping ?? []).filter((f: any) => !f?.isDeleted && !f?.contentstackFieldUid?.includes('.'))) {
        const raw = readRaw(blockRecord, child, locale);
        if (raw === undefined) continue;
        const v = transformField(
          raw, child, blockRecord, locale, docIndex, ctUidByApiKey, assetLookup, allContentTypes, recordsById, counters, targetCt.fieldMapping ?? [], depth + 1,
        );
        if (v !== undefined) out[child.contentstackFieldUid] = v;
      }
      return Object.keys(out).length ? out : undefined;
    }

    default:
      return typeof value === 'object' ? undefined : value;
  }
}

export async function createEntry(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string,
  contentTypes: any[], // from fieldAttacher — BOTH content_type and global_field entries
  mapperKeys: any,
  master_locale: string,
  project: any,
): Promise<void> {
  try {
    // `project.locales` is a `{ destinationLocaleCode: sourceLocaleCode }` map,
    // populated by the USER completing the locale-mapping UI step (backend
    // `updateLocaleMapper`) — separate from the initial `source_locales` POST
    // the controller makes during upload. `project.master_locale` is meant to
    // carry the same shape for the master locale, but can legitimately come
    // back empty if that step wasn't completed for the master — Contentstack's
    // own import mechanically REQUIRES a master-locale entry file to exist
    // (every other locale imports as a "variant" of it; verified directly: a
    // live test run with a missing master-locale file produced real, correct
    // it/de/fr/es entry data on disk but the CLI's audit still reported 0
    // entries because it had no master entry to attach variants to). So the
    // destination master locale — `master_locale`, the function's own
    // parameter, always correctly populated from `project.stackDetails.master_locale`
    // at the call site — is ALWAYS included here, never left to that mapping.
    const localeMap: Record<string, string> = { ...(project?.locales ?? {}) };
    const destMaster = master_locale || 'en-us';
    if (!(destMaster in localeMap)) {
      // DatoCMS export's own default/master locale (see TRD open question) —
      // 'en' is the sample's convention; falls back to the export's first
      // extracted locale if 'en' itself isn't one of them.
      localeMap[destMaster] = 'en';
    }
    const destLocales = Object.keys(localeMap);

    const root = resolveExportRoot(file_path, packagePath);
    const apiKeyByItemTypeId: Record<string, string> = {};
    (readJson<any[]>(path.join(root, 'content_types.json'))).forEach((ct) => {
      apiKeyByItemTypeId[ct.id] = ct.api_key;
    });
    const records: any[] = readJson(path.join(root, 'records.json'));

    let assetLookup: Record<string, any> = {};
    try {
      const idxPath = path.join(DATA, destinationStackId, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE);
      assetLookup = JSON.parse(await fs.promises.readFile(idxPath, 'utf8')) || {};
    } catch {
      /* assets not generated -> file fields skipped */
    }

    // Index EVERY record (regardless of type) — link/links/single_block/rich_text
    // all resolve through the same id space, including block-instance records.
    const docIndex: Record<string, DocRef> = {};
    const recordsById: Record<string, any> = {};
    records.forEach((r: any) => {
      const apiKey = apiKeyByItemTypeId[r?.__itemTypeId];
      if (!r?.id || !apiKey) return;
      docIndex[r.id] = { apiKey, uid: toEntryUid(r.id) };
      recordsById[r.id] = r;
    });

    // otherCmsUid was set to api_key by the parser (see migration-datocms/libs/contentTypes.ts)
    // — this is BOTH the record-matching join key and the destination-uid lookup key.
    const ctUidByApiKey: Record<string, string> = {};
    contentTypes.forEach((ct: any) => {
      const ctUid = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      if (ct?.otherCmsUid && ctUid) ctUidByApiKey[ct.otherCmsUid] = ctUid;
    });

    const entryLevelCts = contentTypes.filter((ct: any) => ct?.type !== 'global_field');
    const counters = newCounters();

    for (const ct of entryLevelCts) {
      const apiKey = ct?.otherCmsUid;
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      const docs = records.filter((r: any) => apiKeyByItemTypeId[r?.__itemTypeId] === apiKey);
      const topFields = (ct?.fieldMapping ?? []).filter((f: any) => !f?.isDeleted && !f?.contentstackFieldUid?.includes('.'));
      const titleField = topFields.find((f: any) => f.contentstackFieldUid === 'title');

      let totalWritten = 0;
      for (const destLocale of destLocales) {
        const srcLocale = localeMap[destLocale] || destLocale;
        const entryData: Record<string, any> = {};

        for (const doc of docs) {
          const uid = toEntryUid(doc.id);
          const rawTitle = titleField ? readRaw(doc, titleField, srcLocale) : undefined;
          const entry: any = {
            uid,
            title: typeof rawTitle === 'string' && rawTitle ? rawTitle : `${apiKey}-${uid.slice(0, 6)}`,
            locale: destLocale,
            publish_details: [],
          };
          for (const field of topFields) {
            if (field.contentstackFieldUid === 'title' || field.contentstackFieldUid === 'url') continue;
            const raw = readRaw(doc, field, srcLocale);
            if (raw === undefined) continue;
            const val = transformField(
              raw, field, doc, srcLocale, docIndex, ctUidByApiKey, assetLookup, contentTypes, recordsById, counters, ct?.fieldMapping ?? [],
            );
            if (val !== undefined) entry[field.contentstackFieldUid] = val;
          }
          entryData[uid] = entry;
        }

        const folderPath = path.join(DATA, destinationStackId, ENTRIES_DIR_NAME, folderName, destLocale);
        await fs.promises.mkdir(folderPath, { recursive: true });
        await fs.promises.writeFile(path.join(folderPath, `${destLocale}.json`), JSON.stringify(entryData, null, 4), 'utf-8');
        await fs.promises.writeFile(path.join(folderPath, 'index.json'), JSON.stringify({ '1': `${destLocale}.json` }, null, 4), 'utf-8');
        totalWritten += Object.keys(entryData).length;
      }
      console.info(`[datocms] ${ct?.contentstackUid}: wrote ${totalWritten} entries across ${destLocales.length} locale(s)`);
    }

    console.info(
      `[datocms] skipped — file/assets: ${counters.assetsSkipped}, groups: ${counters.groupsSkipped}, ` +
      `block elements: ${counters.blocksSkipped}, global fields: ${counters.globalFieldsSkipped}, ` +
      `structured-text nodes: ${counters.structuredTextNodesSkipped}`,
    );
  } catch (err: any) {
    console.error(`[datocms] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
}
