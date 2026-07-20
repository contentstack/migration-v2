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

interface DastCtx {
  counters: Counters;
  docIndex: Record<string, DocRef>;
  ctUidByApiKey: Record<string, string>;
  locale: string;
}

function dastNodeToCs(node: any, ctx: DastCtx): any | null {
  const type = node?.type;

  if (type === 'paragraph' || type === 'heading') {
    const tag = type === 'heading' ? `h${node?.level ?? 1}` : 'p';
    const children = (node?.children ?? [])
      .map((c: any) => c?.type === 'span' ? dastSpanToCsText(c) : dastNodeToCs(c, ctx))
      .filter(Boolean);
    if (!children.length) return null;
    return { type: tag, uid: newUid(), attrs: {}, children };
  }

  if (type === 'list') {
    const tag = node?.style === 'numbered' ? 'ol' : 'ul';
    const children = (node?.children ?? [])
      .map((li: any) => {
        const liChildren = (li?.children ?? []).map((c: any) => dastNodeToCs(c, ctx)).filter(Boolean);
        return liChildren.length ? { type: 'li', uid: newUid(), attrs: {}, children: liChildren } : null;
      })
      .filter(Boolean);
    if (!children.length) return null;
    return { type: tag, uid: newUid(), attrs: {}, children };
  }

  if (type === 'block' || type === 'inlineItem') {
    const itemId = node?.item;
    const ref = itemId ? ctx.docIndex[itemId] : undefined;
    const ctUid = ref ? ctx.ctUidByApiKey[ref.apiKey] : undefined;
    if (!ref || !ctUid) {
      ctx.counters.structuredTextNodesSkipped += 1;
      return null;
    }
    const isInline = type === 'inlineItem';
    return {
      type: 'reference',
      uid: newUid(),
      attrs: {
        'display-type': isInline ? 'inline' : 'block',
        'entry-uid': ref.uid,
        'content-type-uid': ctUid,
        locale: ctx.locale,
        type: 'entry',
        'class-name': isInline ? 'embedded-entry-inline' : 'embedded-entry-block',
      },
      children: [{ text: '' }],
    };
  }

  // itemLink / thematicBreak / unknown
  ctx.counters.structuredTextNodesSkipped += 1;
  return null;
}

function convertDastToCsRte(value: any, ctx: DastCtx): any {
  const emptyDoc = { type: 'doc', uid: newUid(), attrs: {}, children: [{ type: 'p', uid: newUid(), attrs: {}, children: [{ text: '' }] }] };
  const rootChildren = value?.document?.children;
  if (!Array.isArray(rootChildren)) return emptyDoc;
  const children = rootChildren.map((n: any) => dastNodeToCs(n, ctx)).filter(Boolean);
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
  destLocale: string,
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
      if (field?.otherCmsType === 'structured_text') return convertDastToCsRte(value, { counters, docIndex, ctUidByApiKey, locale: destLocale });
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
            raw, child, record, locale, destLocale, docIndex, ctUidByApiKey, assetLookup, allContentTypes, recordsById, counters, allFields, depth + 1,
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
            raw, child, blockRecord, locale, destLocale, docIndex, ctUidByApiKey, assetLookup, allContentTypes, recordsById, counters, allFields, depth + 1,
          );
          if (v !== undefined) inner[getLastUid(child.contentstackFieldUid)] = v;
        }
        if (Object.keys(inner).length) out.push({ [getLastUid(blockRow.contentstackFieldUid)]: inner });
      }
      return out.length ? out : undefined;
    }

    case 'dropdown': {
      // DatoCMS stores json field values (checkbox_group, multi_select) as
      // JSON-encoded strings in the export. Parse them to get the actual array.
      let dropdownVal = value;
      if (typeof dropdownVal === 'string') {
        try { dropdownVal = JSON.parse(dropdownVal); } catch {}
      }
      if (Array.isArray(dropdownVal)) return dropdownVal.length ? dropdownVal : undefined;
      return dropdownVal ?? undefined;
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

    // DatoCMS block models (modular_block: true) are imported as CS content types but their
    // records are locale-specific: each locale of a parent references DIFFERENT block record IDs.
    // We must only write a block record for the locale(s) that actually reference it — otherwise
    // German block records end up in en-us, etc.
    const datoCtMeta: any[] = readJson(path.join(root, 'content_types.json'));
    const blockCtApiKeys = new Set<string>(
      datoCtMeta.filter((ct: any) => ct.modular_block).map((ct: any) => ct.api_key),
    );
    // Reverse map: srcLocale → destLocale (e.g. 'en' → 'en-us')
    const srcToDestLocale: Record<string, string> = {};
    for (const [dest, src] of Object.entries(localeMap)) srcToDestLocale[src as string] = dest;
    // blockRecordLocales: block record id → set of destLocales that reference it
    const blockRecordLocales = new Map<string, Set<string>>();
    // blockRecordAlias: non-canonical id → canonical id
    // DatoCMS block fields store DIFFERENT record IDs per locale (e.g. mb_single_block:
    // {en: 'Hj2WXt', de: 'CBIuQ2', fr: 'U64k5C'}).  All three are the same logical
    // entry; they must share one CS UID so language-switching works in the CS UI.
    const blockRecordAlias = new Map<string, string>();
    const collectDastIds = (node: any, out: string[]): void => {
      if (!node) return;
      if ((node.type === 'block' || node.type === 'inlineItem') && node.item) out.push(node.item);
      if (Array.isArray(node.children)) node.children.forEach((c: any) => collectDastIds(c, out));
    };
    for (const r of records) {
      const rApiKey = apiKeyByItemTypeId[r?.__itemTypeId];
      if (!rApiKey || blockCtApiKeys.has(rApiKey)) continue;
      for (const [fieldKey, rawValue] of Object.entries(r as Record<string, any>)) {
        if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) continue;
        if (['__itemTypeId', 'id', 'type', 'item_type', 'meta', 'creator', 'fieldset'].includes(fieldKey)) continue;
        const srcLocaleKeys = Object.keys(rawValue);
        if (!srcLocaleKeys.length || !srcLocaleKeys.every((k) => k in srcToDestLocale)) continue;

        // Collect block IDs per destLocale for this field, preserving array position
        const localeBlockIds: Array<{ destLocale: string; ids: string[] }> = [];
        for (const srcLocale of srcLocaleKeys) {
          const destLocale = srcToDestLocale[srcLocale];
          if (!destLocale) continue;
          const localeValue = (rawValue as any)[srcLocale];
          const raw: string[] = Array.isArray(localeValue)
            ? localeValue.filter((v: any): v is string => typeof v === 'string')
            : typeof localeValue === 'string' ? [localeValue] : [];
          if (localeValue && typeof localeValue === 'object' && !Array.isArray(localeValue) && localeValue.schema === 'dast') {
            collectDastIds(localeValue.document, raw);
          }
          const blockIds = raw.filter((id) => { const ref = docIndex[id]; return ref && blockCtApiKeys.has(ref.apiKey); });
          if (blockIds.length) localeBlockIds.push({ destLocale, ids: blockIds });
        }

        for (const { destLocale, ids } of localeBlockIds) {
          for (const id of ids) {
            if (!blockRecordLocales.has(id)) blockRecordLocales.set(id, new Set());
            blockRecordLocales.get(id)!.add(destLocale);
          }
        }

        // Positional alias: primary locale's IDs are canonical; all other locales alias to them
        if (localeBlockIds.length > 1) {
          const primary = localeBlockIds.find(({ destLocale }) => destLocale === destLocales[0]) ?? localeBlockIds[0];
          for (const { ids } of localeBlockIds) {
            ids.forEach((id, i) => {
              const canonicalId = primary.ids[i];
              if (canonicalId && id !== canonicalId) blockRecordAlias.set(id, canonicalId);
            });
          }
        }
      }
    }
    // Patch docIndex so DAST embedded-entry lookups and reference fields on parent
    // entries both resolve non-canonical block IDs to the shared canonical UID.
    for (const [nonCanId, canId] of blockRecordAlias) {
      if (docIndex[nonCanId]) docIndex[nonCanId] = { ...docIndex[nonCanId], uid: toEntryUid(canId) };
    }

    for (const ct of entryLevelCts) {
      const apiKey = ct?.otherCmsUid;
      const isBlockCt = blockCtApiKeys.has(apiKey);
      const folderName = mapperKeys?.[ct?.contentstackUid] ?? ct?.contentstackUid;
      const docs = records.filter((r: any) => apiKeyByItemTypeId[r?.__itemTypeId] === apiKey);
      const topFields = (ct?.fieldMapping ?? []).filter((f: any) => !f?.isDeleted && !f?.contentstackFieldUid?.includes('.'));
      const titleField = topFields.find((f: any) => f.contentstackFieldUid === 'title');

      let totalWritten = 0;
      for (const destLocale of destLocales) {
        const srcLocale = localeMap[destLocale] || destLocale;
        const entryData: Record<string, any> = {};

        for (const doc of docs) {
          // Block CT records are locale-specific: skip records not referenced in this locale
          if (isBlockCt && !blockRecordLocales.get(doc.id)?.has(destLocale)) continue;
          const uid = toEntryUid(blockRecordAlias.get(doc.id) ?? doc.id);
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
              raw, field, doc, srcLocale, destLocale, docIndex, ctUidByApiKey, assetLookup, contentTypes, recordsById, counters, ct?.fieldMapping ?? [],
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
      `block elements: ${counters.blocksSkipped}, structured-text nodes: ${counters.structuredTextNodesSkipped}`,
    );
  } catch (err: any) {
    console.error(`[datocms] createEntry failed for project ${projectId}:`, err?.message ?? err);
  }
}
