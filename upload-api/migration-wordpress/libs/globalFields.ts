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

/** Yoast postmeta keys mapped into the SEO global field. */
const YOAST_SEO_META_KEYS = ['_yoast_wpseo_title', '_yoast_wpseo_metadesc'];

/** True when a WordPress postmeta key carries Yoast SEO data we map into the SEO global field. */
export function isYoastSeoMetaKey(metaKey: string | undefined): boolean {
  return !!metaKey && YOAST_SEO_META_KEYS.includes(metaKey);
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
 * Full Contentstack definition for the reusable "SEO" global field (schema: Title + Description).
 * Written to the global_fields export so the CLI can create it before content types reference it.
 */
export function buildSeoGlobalFieldDefinition(): Record<string, any> {
  return {
    title: 'SEO',
    uid: SEO_GLOBAL_FIELD_UID,
    description: 'Reusable SEO metadata (mapped from Yoast SEO during migration).',
    schema: [
      {
        data_type: 'text',
        display_name: 'Title',
        uid: 'title',
        field_metadata: { description: '', default_value: '', version: 3 },
        format: '',
        error_messages: { format: '' },
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false
      },
      {
        data_type: 'text',
        display_name: 'Description',
        uid: 'description',
        field_metadata: { description: '', default_value: '', multiline: true, version: 3 },
        format: '',
        error_messages: { format: '' },
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false
      }
    ]
  };
}
