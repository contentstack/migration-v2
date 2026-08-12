import { CT, Field } from '../interface/interface';
import seoGlobalFieldModel from '../config/seo-global-field.json';

/**
 * Handling for reusable Contentstack global fields produced during WordPress migration.
 *
 * Yoast SEO (`_yoast_wpseo_title` / `_yoast_wpseo_metadesc`) is consolidated into a single reusable
 * "SEO" global field referenced by the content type, instead of two flat top-level fields. The
 * field-mapper only carries the *reference* (built here); the global-field *definition* is ensured
 * on the destination side during migration (see api globalField.service.createGlobalField). Entry
 * values nest as `seo: { <sub-field>: value }`.
 *
 * The SEO field set is NOT hardcoded here — it is authored in `config/seo-global-field.json` (a
 * standard Contentstack global-field schema, same shape as the hand-authored content models) and
 * converted at build time into the field-mapper envelope the rest of the pipeline consumes. To add
 * or retype an SEO sub-field, edit that JSON — no code change. This mirrors the acf-type-mapping.json
 * pattern (bundled default config, imported not inlined).
 */

/** uid of the reusable SEO global field referenced by migrated content types. */
export const SEO_GLOBAL_FIELD_UID = 'seo';

/**
 * Prefix that identifies Yoast SEO postmeta keys. Any postmeta key under this prefix is mapped
 * into the SEO global field generically — no per-field enumeration in code. To include a Yoast
 * field, no code change is needed: if it exists on the post it flows through automatically.
 */
const YOAST_SEO_KEY_PREFIX = '_yoast_wpseo_';

/** Yoast keys occasionally appear without the leading underscore; normalize to the canonical form. */
function normalizeMetaKey(metaKey: string): string {
  return metaKey.startsWith('_') ? metaKey : `_${metaKey}`;
}

/** True when a WordPress postmeta key carries Yoast SEO data we map into the SEO global field. */
export function isYoastSeoMetaKey(metaKey: string | undefined): boolean {
  return !!metaKey && normalizeMetaKey(metaKey).startsWith(YOAST_SEO_KEY_PREFIX);
}

/**
 * Derive the SEO sub-field uid from a Yoast meta key, generically.
 * `_yoast_wpseo_opengraph-image-id` → `opengraph_image_id`
 * Returns '' for keys that are not Yoast SEO keys.
 */
export function yoastSubFieldUid(metaKey: string | undefined): string {
  if (!isYoastSeoMetaKey(metaKey)) return '';
  return normalizeMetaKey(metaKey as string)
    .slice(YOAST_SEO_KEY_PREFIX.length)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/** `opengraph_image_id` → `Opengraph Image Id` (display name for the generated sub-field). */
function humanizeUid(uid: string): string {
  return uid
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Content-type field that references the reusable "SEO" global field (schema: title + description). */
export function buildSeoGlobalFieldReference(): Field {
  return {
    uid: SEO_GLOBAL_FIELD_UID,
    contentstackFieldUid: SEO_GLOBAL_FIELD_UID,
    contentstackField: 'SEO',
    contentstackFieldType: 'global_field',
    backupFieldType: 'global_field',
    otherCmsField: 'seo',
    otherCmsType: 'global_field',
    backupFieldUid: SEO_GLOBAL_FIELD_UID,
    refrenceTo: [SEO_GLOBAL_FIELD_UID],
    advanced: { mandatory: false }
  };
}

/**
 * Add the SEO global-field reference to a content type when an item carries Yoast SEO postmeta.
 * Mutates `CT` in place and is idempotent (only added once per content type).
 */
export function attachSeoGlobalField(CT: CT, metaKey: string | undefined): void {
  if (isYoastSeoMetaKey(metaKey) && !CT?.find((f: Field) => f?.uid === SEO_GLOBAL_FIELD_UID)) {
    CT?.push(buildSeoGlobalFieldReference());
  }
}

/** True when a content type references the SEO global field. */
export function contentTypeReferencesSeo(CT: CT): boolean {
  return !!CT?.some?.(
    (f: Field) => f?.contentstackFieldType === 'global_field' && f?.uid === SEO_GLOBAL_FIELD_UID
  );
}

/**
 * Map a Contentstack schema `data_type` (+ field_metadata hints) from the authored model onto the
 * field-mapper `contentstackFieldType` the content-type creator understands (see
 * api/src/utils/content-type-creator.utils.ts convertToSchemaFormate). Kept deliberately small and
 * mechanical — it translates types, it does not define fields.
 */
function csDataTypeToFieldType(schemaField: Record<string, any>): string {
  const dataType = schemaField?.data_type;
  switch (dataType) {
    case 'text':
      if (schemaField?.display_type === 'dropdown' || schemaField?.enum) return 'dropdown';
      if (schemaField?.field_metadata?.multiline) return 'multi_line_text';
      return 'single_line_text';
    case 'file':
      return 'file';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'isodate':
      return 'isodate';
    case 'link':
      return 'link';
    case 'json':
      return 'json';
    default:
      return 'single_line_text';
  }
}

/**
 * Convert one authored Contentstack schema field (from config/seo-global-field.json) into a
 * field-mapper `Field` — the exact shape content-type field mappings use (see
 * cmsMigrationData/content_types/*.json `fieldMapping[]`). Display name, cardinality, dropdown
 * choices and mandatory/unique flags are carried through so the downstream creator rebuilds an
 * equivalent Contentstack schema.
 */
function csSchemaFieldToMapperField(schemaField: Record<string, any>): Field {
  const uid: string = schemaField?.uid;
  const fieldType = csDataTypeToFieldType(schemaField);
  const advanced: Record<string, any> = {
    mandatory: schemaField?.mandatory ?? false,
    multiple: schemaField?.multiple ?? false,
    unique: schemaField?.unique ?? false,
    nonLocalizable: schemaField?.non_localizable ?? false,
    default_value: schemaField?.field_metadata?.default_value
  };
  // Dropdown choices live under enum.choices in the CS schema; the creator reads them from
  // advanced.options ([{ value }] or [{ key, value }]).
  if (fieldType === 'dropdown' && Array.isArray(schemaField?.enum?.choices)) {
    advanced.options = schemaField.enum.choices;
  }
  return {
    isDeleted: false,
    uid,
    // Source (WordPress) side. otherCmsField carries the authored uid so the mapping is traceable;
    // otherCmsType stays a neutral scalar so the creator does not coerce dropdowns to numbers.
    otherCmsField: uid,
    otherCmsType: schemaField?.data_type ?? 'text',
    contentstackField: schemaField?.display_name ?? humanizeUid(uid),
    contentstackFieldUid: uid,
    contentstackFieldType: fieldType,
    backupFieldType: fieldType,
    backupFieldUid: uid,
    advanced
  };
}

/**
 * Full field-mapper definition for the reusable "SEO" global field.
 *
 * Returns the SAME envelope as a content type (see cmsMigrationData/content_types/*.json):
 * `{ status, type: 'global_field', otherCmsUid, contentstackUid, fieldMapping: Field[] }`. The
 * field set comes entirely from the authored model (config/seo-global-field.json) — nothing here is
 * static. `contenTypeMaker` / `entriesFieldCreator` consume this shape directly.
 */
export function buildSeoGlobalFieldDefinition(): Record<string, any> {
  const model: Record<string, any> = seoGlobalFieldModel as Record<string, any>;
  const schema: Record<string, any>[] = Array.isArray(model?.schema) ? model.schema : [];
  const uid: string = model?.uid ?? SEO_GLOBAL_FIELD_UID;
  const title: string = model?.title ?? 'SEO';
  return {
    status: 1,
    isUpdated: false,
    updateAt: '',
    otherCmsTitle: title,
    otherCmsUid: uid,
    contentstackTitle: title,
    contentstackUid: uid,
    type: 'global_field',
    fieldMapping: schema.map(csSchemaFieldToMapperField)
  };
}

/**
 * Merge an already-written SEO definition with the authored model, returning the field-mapper
 * envelope. The authored model is the source of truth; any field-mapping entry that a previous
 * write added but the model no longer lists is preserved (union by contentstackFieldUid) so nothing
 * is lost across content types that write the aggregate in turn.
 *
 * `subFieldUids` (Yoast keys discovered on the content type) is retained for call-site
 * compatibility; field generation is now model-driven, so it no longer selects the schema.
 */
export function mergeSeoGlobalFieldDefinition(
  existing: Record<string, any> | undefined,
  _subFieldUids: string[]
): Record<string, any> {
  const base = buildSeoGlobalFieldDefinition();
  const existingMapping: Field[] = Array.isArray(existing?.fieldMapping) ? existing!.fieldMapping : [];
  const modelUids = new Set(base.fieldMapping.map((f: Field) => f?.contentstackFieldUid));
  const preserved = existingMapping.filter(
    (f: Field) => f?.contentstackFieldUid && !modelUids.has(f.contentstackFieldUid)
  );
  return { ...base, fieldMapping: [...base.fieldMapping, ...preserved] };
}
