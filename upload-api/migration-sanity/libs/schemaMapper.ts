import { Field } from '../interface/interface';

/**
 * Map a single Sanity field to a Contentstack `Field`.
 *
 * `sourceType` is the inferred Sanity field/widget type (see inferSanityType in
 * contentTypes.ts); `name` is the field name in the source document.
 *
 * Seeded from the confirmed Sanity → Contentstack mapping:
 *   string  -> single_line_text        slug    -> single_line_text
 *   text    -> multi_line_text          datetime-> isodate
 *   block[] -> json (JSON-RTE)          image   -> file
 *   reference -> reference              array   -> group (multiple)
 *   object  -> group                    boolean -> boolean
 *   number  -> number                   url     -> url
 */
const toUid = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const baseField = (name: string, sourceType: string, csType: string): Field => {
  const uid = toUid(name);
  return {
    uid,
    otherCmsField: name,
    otherCmsType: sourceType,
    contentstackField: name,
    contentstackFieldUid: uid,
    contentstackFieldType: csType,
    backupFieldType: csType,
    backupFieldUid: uid,
    advanced: {},
  };
};

export const mapField = (name: string, sourceType: string): Field => {
  switch (sourceType) {
    case 'string':
    case 'slug':
      return baseField(name, sourceType, 'single_line_text');

    case 'text':
      return baseField(name, sourceType, 'multi_line_text');

    case 'block':        // portable text / rich text
    case 'richText':
      return baseField(name, sourceType, 'json');

    case 'image':
    case 'file':
      return baseField(name, sourceType, 'file');

    case 'fileMultiple': {   // array of image/file objects -> multiple file
      const f = baseField(name, sourceType, 'file');
      f.advanced = { multiple: true };
      return f;
    }

    case 'reference':
      return baseField(name, sourceType, 'reference');

    case 'array': {       // array of objects -> group with multiple
      const f = baseField(name, sourceType, 'group');
      f.advanced = { multiple: true };
      return f;
    }

    case 'object':
      return baseField(name, sourceType, 'group');

    case 'boolean':
      return baseField(name, sourceType, 'boolean');

    case 'number':
      return baseField(name, sourceType, 'number');

    case 'datetime':
    case 'date':
      return baseField(name, sourceType, 'isodate');

    case 'url':
      return baseField(name, sourceType, 'url');

    case 'geopoint':
      return baseField(name, sourceType, 'json');

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      return baseField(name, sourceType, 'json');
  }
};

export default mapField;
