import { CT, Field } from '../interface/interface';

/**
 * Handling for reusable Contentstack global fields produced during WordPress migration.
 *
 * Yoast SEO (`_yoast_wpseo_title` / `_yoast_wpseo_metadesc`) is consolidated into a single reusable
 * "SEO" global field referenced by the content type, instead of two flat top-level fields. The
 * field-mapper only carries the *reference* (built here); the global-field *definition* is ensured
 * on the destination side during migration (see api globalField.service.createGlobalField). Entry
 * values nest as `seo: { title, description }`.
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

/** A single text sub-field within the SEO global field, generated from a Yoast sub-field uid. */
function buildSeoSubField(uid: string): Record<string, any> {
  return {
    data_type: 'text',
    display_name: humanizeUid(uid),
    uid,
    field_metadata: { description: '', default_value: '', version: 3 },
    format: '',
    error_messages: { format: '' },
    multiple: false,
    mandatory: false,
    unique: false,
    non_localizable: false
  };
}

/**
 * Full Contentstack definition for the reusable "SEO" global field.
 *
 * The schema is built dynamically from the set of Yoast sub-field uids discovered in the export
 * (see yoastSubFieldUid). No field is hardcoded — passing more Yoast keys yields more sub-fields.
 * Written to the global_fields export so the CLI can create it before content types reference it.
 */
export function buildSeoGlobalFieldDefinition(subFieldUids: string[] = []): Record<string, any> {
  const uniqueUids = Array.from(new Set(subFieldUids.filter(Boolean)));
  return {
    title: 'SEO',
    uid: SEO_GLOBAL_FIELD_UID,
    description: 'Reusable SEO metadata (mapped from Yoast SEO during migration).',
    schema: uniqueUids.map(buildSeoSubField)
  };
}

/**
 * Merge newly-discovered Yoast sub-field uids into an existing SEO global field definition,
 * returning the union of sub-fields. Lets the schema accumulate across content types that each
 * surface a different subset of Yoast keys, so no field is lost by write order.
 */
export function mergeSeoGlobalFieldDefinition(
  existing: Record<string, any> | undefined,
  subFieldUids: string[]
): Record<string, any> {
  const existingUids: string[] = Array.isArray(existing?.schema)
    ? existing!.schema.map((f: any) => f?.uid).filter(Boolean)
    : [];
  return buildSeoGlobalFieldDefinition([...existingUids, ...subFieldUids]);
}
