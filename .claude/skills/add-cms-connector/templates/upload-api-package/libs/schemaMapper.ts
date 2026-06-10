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
 *
 * GROUP CHILDREN: pass `parent` to emit a child row of a group. All three uid
 * fields then carry the DOTTED path (`<parentUid>.<childUid>`) — the join key
 * the api's buildSchemaTree uses to nest the child under its group in the CT
 * schema (dots are stripped from the final Contentstack uids), and the key the
 * entry transform uses to find a group's children. Display name = `Parent > child`.
 */
export interface ParentCtx {
  uid: string;        // parent group's (possibly already dotted) contentstackFieldUid
  label: string;      // parent group's display name
  inBlocks?: boolean; // true anywhere under a modular-blocks ancestor — Contentstack
                      // forbids blocks inside blocks, so heterogeneous arrays there
                      // fall back to group+multiple
}

export const toUid = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const baseField = (
  name: string,
  sourceType: string,
  csType: string,
  parent?: ParentCtx,
): Field => {
  const uid = parent ? `${parent.uid}.${toUid(name)}` : toUid(name);
  const label = parent ? `${parent.label} > ${name}` : name;
  return {
    uid,
    otherCmsField: name,
    otherCmsType: sourceType,
    contentstackField: label,
    contentstackFieldUid: uid,
    contentstackFieldType: csType,
    backupFieldType: csType,
    backupFieldUid: uid,
    advanced: {},
    isDeleted: false, // api's buildFieldSchema filters on isDeleted === false strictly
  };
};

export const mapField = (name: string, sourceType: string, parent?: ParentCtx): Field => {
  switch (sourceType) {
    // --- EXAMPLE seeds: replace with the new CMS's real types ---
    case 'string':
    case 'slug':
      return baseField(name, sourceType, 'single_line_text', parent);

    case 'text':
      return baseField(name, sourceType, 'multi_line_text', parent);

    case 'block':        // portable text / rich text
    case 'richText':
      return baseField(name, sourceType, 'json', parent);

    case 'image':
    case 'file':
      return baseField(name, sourceType, 'file', parent);

    case 'fileMultiple': {   // array of media objects -> multiple file (gallery)
      const f = baseField(name, sourceType, 'file', parent);
      f.advanced = { multiple: true };
      return f;
    }

    case 'reference':
      return baseField(name, sourceType, 'reference', parent);

    case 'array': {       // repeatable -> group with multiple
      const f = baseField(name, sourceType, 'group', parent);
      f.advanced = { multiple: true };
      return f;
    }

    case 'object':
      return baseField(name, sourceType, 'group', parent);

    case 'boolean':
      return baseField(name, sourceType, 'boolean', parent);

    case 'number':
      return baseField(name, sourceType, 'number', parent);

    case 'datetime':
    case 'date':
      return baseField(name, sourceType, 'isodate', parent);

    case 'url':
      return baseField(name, sourceType, 'link', parent);

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      return baseField(name, sourceType, 'json', parent);
  }
};

export default mapField;
