import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, DatoContentType, DatoField, DatoFieldsEntry, Field } from '../interface/interface';
import mapField, { baseField, BlockInfo, MapperCtx } from './schemaMapper';
import { ensureDir, writeJson, readJson, resolveExportRoot } from '../utils/helper';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

function readJsonFilesFromFolder(folderPath: string): CT[] {
  const result: CT[] = [];
  if (!fs.existsSync(folderPath)) return result;
  for (const file of fs.readdirSync(folderPath)) {
    if (file.endsWith('.json')) {
      try {
        result.push(JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8')));
      } catch (err) {
        console.error(`❌ Failed to parse ${file}:`, err);
      }
    }
  }
  return result;
}

/**
 * Contentstack REQUIRES every content type to have a `title` field, so one is
 * injected when the source has no suitable candidate:
 *   "content_type: should have a 'title' field."
 *
 * `url` is NOT injected. It is only present when DatoCMS actually defines one,
 * and it is never mandatory. A `url` field is only *required* by the CMA when
 * the content type is page-type — and for DatoCMS `mergeTwoCts`
 * (api/src/utils/content-type-creator.utils.ts) no longer sets `is_page: true`,
 * so content types without a source `url` field are valid without one.
 */
const TITLE_CANDIDATES = ['title', 'name', 'label', 'heading'];
const TITLE_TEXT_TYPES = ['single_line_text', 'multi_line_text', 'text'];

/**
 * Choose the source field whose VALUE populates an injected `title`. Only the
 * value is copied — the chosen field keeps its own uid, label and value.
 *
 * Ordered; first match wins:
 *   1. a conventional display name — `title` / `name` / `label` / `heading`
 *   2. a field named after the model itself (`topic.topic`, `pain_point.pain_point`)
 *      — a common DatoCMS habit, and it beats source order when a model has
 *      several text fields
 *   3. the first plain text field in source order
 *
 * Skipped throughout: fields carrying a `format` validator. A value constrained
 * to a pattern is machine-readable, not a label — `partner_required_software.key`
 * is `^[-0-9a-z]*$` ("fleet") while its sibling `required_software` holds the real
 * name ("Verizon Connect Fleet"). Slug/url fields are skipped for the same reason.
 *
 * Returns undefined when nothing suitable exists (a model of pure references and
 * booleans), leaving createEntry's `<model>-<id>` fallback in place.
 */
function pickTitleSource(
  fieldMapping: Field[],
  modelApiKey: string,
  sourceFields: DatoField[],
): Field | undefined {
  const sourceByKey = new Map(sourceFields.map((f) => [f.api_key, f]));
  const isDisplayText = (f: Field): boolean => {
    if (f.uid.includes('.')) return false;
    if (!TITLE_TEXT_TYPES.includes(f.contentstackFieldType)) return false;
    const key = f.otherCmsField.toLowerCase();
    if (key === 'url' || key === 'slug') return false;
    if (sourceByKey.get(f.otherCmsField)?.validators?.format) return false;
    return true;
  };

  return (
    fieldMapping.find((f) => isDisplayText(f) && TITLE_CANDIDATES.includes(f.otherCmsField.toLowerCase())) ??
    fieldMapping.find((f) => isDisplayText(f) && f.otherCmsField.toLowerCase() === modelApiKey.toLowerCase()) ??
    fieldMapping.find(isDisplayText)
  );
}

/**
 * `title` then `url` first in the schema, every other field left in its original
 * source order. `url` is only moved when the source actually defines one — it is
 * never injected. Both are top-level and childless, so moving them can't separate
 * a group parent from its dotted children (the api's `buildSchemaTree` joins those
 * by uid prefix anyway, not by adjacency).
 */
function orderMandatoryFirst(fieldMapping: Field[]): void {
  const take = (uid: string): Field | undefined => {
    const i = fieldMapping.findIndex((f) => !f.uid.includes('.') && f.contentstackFieldUid === uid);
    return i === -1 ? undefined : fieldMapping.splice(i, 1)[0];
  };
  const url = take('url');
  const title = take('title');
  if (url) fieldMapping.unshift(url);
  if (title) fieldMapping.unshift(title);
}

function ensureMandatoryFields(
  fieldMapping: Field[],
  modelApiKey: string,
  sourceFields: DatoField[],
): void {
  const topLevel = (f: Field) => !f.uid.includes('.');

  const existingTitle = fieldMapping.find((f) => topLevel(f) && f.contentstackFieldUid === 'title');
  if (existingTitle) {
    // DatoCMS already defines a `title` field — use it as-is, but it still has to
    // be mandatory: `title` is the one required field on every content type.
    existingTitle.advanced = { ...existingTitle.advanced, mandatory: true };
  } else {
    // No source `title`. Contentstack still requires one, so ADD a field —
    // never repurpose a client field. Rewriting a source field's uid to `title`
    // would delete it from the destination schema (a DatoCMS `label` field would
    // simply cease to exist), which is a change to the client's own data model.
    //
    // Instead: inject `title`, and nominate the best source field to COPY its
    // value from via `advanced.titleValueFrom`. The api's createEntry reads that
    // hint; the nominated field keeps its own uid, label and value untouched.
    const candidate = pickTitleSource(fieldMapping, modelApiKey, sourceFields);
    const row = baseField('title', 'text', 'single_line_text', undefined, undefined, 'Title');
    row.advanced = { mandatory: true };
    if (candidate) row.advanced.titleValueFrom = candidate.otherCmsField;
    fieldMapping.unshift(row);
  }

  // A source `url` field is left exactly as DatoCMS declared it — its `required`
  // and `unique` validators come through `applySourceMeta` like any other field's.
  //
  // It is still never INVENTED: a content type whose source has no `url` gets
  // none, and `buildCtOptions` marks it non-page so the CMA never demands one.
  // That, not a forced `mandatory: false`, is what keeps those content types
  // valid — an earlier version overrode the source here and silently discarded 12
  // required+unique constraints to solve a problem the page-type split had
  // already solved.

  orderMandatoryFirst(fieldMapping);
}

/**
 * DatoCMS records sometimes contain enum values not listed in the field's
 * appearance.parameters (e.g. a radio option removed after data was entered).
 * Scan the actual record values and merge any extra strings into the field's
 * advanced.options so the CS schema accepts them at import time.
 */
function enrichDropdownChoices(fieldMapping: Field[], records: any[]): void {
  for (const field of fieldMapping) {
    if (field.contentstackFieldType !== 'dropdown') continue;
    const options: Array<{ key: string; value: string }> = field.advanced?.options ?? [];
    const known = new Set(options.map((o: any) => String(o.value)));

    for (const record of records) {
      const raw = record[field.otherCmsField];
      if (raw == null) continue;
      const values: string[] = [];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) values.push(...parsed.filter((v: any) => typeof v === 'string'));
          else values.push(raw);
        } catch { values.push(raw); }
      } else if (Array.isArray(raw)) {
        values.push(...raw.filter((v: any) => typeof v === 'string'));
      }
      for (const v of values) {
        if (v && !known.has(v)) {
          known.add(v);
          options.push({ key: v, value: v });
        }
      }
    }

    if (options.length) field.advanced = { ...field.advanced, options };
  }
}

/**
 * Parse the DatoCMS export into Contentstack content-type / global-field
 * schemas. Unlike the generic schema-less template, DatoCMS ships an EXPLICIT
 * schema (`content_types.json` + `fields.json`) separate from the data
 * (`records.json`) — so the field map is built deterministically from the
 * schema, not inferred from record samples.
 *
 * The emitted CT object shape (`otherCmsTitle` / `otherCmsUid` /
 * `contentstackTitle` / `contentstackUid` / `type` / `fieldMapping`) is the
 * contract the api side consumes.
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const root = resolveExportRoot(filePath);
    const contentTypes: DatoContentType[] = readJson(path.join(root, 'content_types.json'));
    const fieldsByTypeId: Record<string, DatoFieldsEntry> = readJson(path.join(root, 'fields.json'));

    // Build type-id → records[] index for dropdown choice enrichment. Missing
    // records.json is non-fatal (schema-only runs have no records file).
    const recordsByTypeId = new Map<string, any[]>();
    const recordsPath = path.join(root, 'records.json');
    if (fs.existsSync(recordsPath)) {
      const allRecords: any[] = readJson(recordsPath);
      allRecords.forEach((r) => {
        const tid = r.__itemTypeId;
        if (!tid) return;
        if (!recordsByTypeId.has(tid)) recordsByTypeId.set(tid, []);
        recordsByTypeId.get(tid)!.push(r);
      });
    }

    // Build the global id -> {apiKey, contentstackUid, isBlock} lookup ONCE,
    // covering both entry-level types and block types — link/links/single_block/
    // rich_text fields on ANY content type may point at either.
    const blocksById = new Map<string, BlockInfo>();
    contentTypes.forEach((ct) => {
      const contentstackUid = `${affix ? affix + '_' : ''}${ct.api_key}`;
      blocksById.set(ct.id, { apiKey: ct.api_key, contentstackUid, isBlock: ct.modular_block });
    });

    // id -> that type's own DatoField[] (needed when a rich_text field recurses
    // into a block's fields).
    const blockFieldsById = new Map<string, DatoField[]>();
    Object.entries(fieldsByTypeId).forEach(([id, entry]) => {
      blockFieldsById.set(id, entry.fields ?? []);
    });

    for (const ct of contentTypes) {
      const fieldsEntry = fieldsByTypeId[ct.id];
      const sourceFields = fieldsEntry?.fields ?? [];

      const ctx: MapperCtx = { affix, blocksById, parent: undefined };
      const fieldMapping: Field[] = [];
      sourceFields.forEach((field) => {
        fieldMapping.push(...mapField(field, ctx, blockFieldsById));
      });

      enrichDropdownChoices(fieldMapping, recordsByTypeId.get(ct.id) ?? []);
      ensureMandatoryFields(fieldMapping, ct.api_key, sourceFields);

      // Content-type-level settings have to ride on a field row: the mapper DB
      // (contentTypesMapper) stores a fixed set of CT keys and would drop an extra
      // one, whereas `advanced` on a field survives the createDummyData ->
      // fieldAttacher round trip. Same channel `urlPrefix` already uses. `title`
      // is the carrier because every content type is guaranteed to have one.
      if (ct.singleton) {
        const titleRow = fieldMapping.find(
          (f) => !f.uid.includes('.') && f.contentstackFieldUid === 'title',
        );
        if (titleRow) titleRow.advanced = { ...titleRow.advanced, ctSingleton: true };
      }

      const contentstackUid = blocksById.get(ct.id)!.contentstackUid;
      const contentType = {
        // otherCmsTitle/otherCmsUid double as BOTH the UI display label (rendered
        // e.g. in SaveChangesModal) AND createEntry's join key against
        // records.json (via api_key, resolved from each record's __itemTypeId) —
        // mirrors migration-wordpress setting both to its post-type slug.
        otherCmsTitle: ct.api_key,
        otherCmsUid: ct.api_key,
        contentstackTitle: ct.name,
        contentstackUid,
        type: 'content_type',
        fieldMapping,
      };

      writeJson(path.join(contentTypeFolderPath, `${ct.api_key}.json`), contentType);
    }

    return readJsonFilesFromFolder(contentTypeFolderPath);
  } catch (error: any) {
    console.error('Error while creating DatoCMS content types:', error?.message);
    return [];
  }
}

export default extractContentTypes;
