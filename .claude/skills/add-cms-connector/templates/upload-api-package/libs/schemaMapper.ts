import { Field } from '../interface/interface';

/**
 * Map a single source-CMS field to a Contentstack `Field`.
 *
 * SEED the switch below from the confirmed source-type → Contentstack-type table
 * produced in Step 1b of the skill (the docs ∪ sample union — seed cases for the
 * CMS's DOCUMENTED types too, not only those observed in the sample, so fields
 * absent from the sample don't fall through to the default case).
 * `sourceType` is the source CMS's field/widget
 * type id; `name` is the field name in the source document.
 *
 * Returned `contentstackFieldType` must be one of the values consumed by the api
 * side (see reference/touchpoints.md):
 *   single_line_text | multi_line_text | text | html | json | markdown |
 *   number | boolean | isodate | file | reference | taxonomy | link | group |
 *   global_field | url
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
    // --- EXAMPLE seeds: replace with the new CMS's real types ---
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

    case 'fileMultiple': {   // array of media objects -> multiple file (gallery)
      const f = baseField(name, sourceType, 'file');
      f.advanced = { multiple: true };
      return f;
    }

    case 'reference':
      return baseField(name, sourceType, 'reference');

    case 'array': {       // repeatable -> group with multiple
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
            return baseField(name, sourceType, 'link');

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      return baseField(name, sourceType, 'json');
  }
};

export default mapField;
