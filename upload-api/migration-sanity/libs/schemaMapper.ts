import { Field } from '../interface/interface';

/**
 * Map a single Sanity field to a Contentstack `Field`.
 *
 * `sourceType` is the inferred Sanity field/widget type (see inferSanityType in
 * contentTypes.ts); `name` is the field name in the source document.
 *
 * GROUP CHILDREN: pass `parent` to emit a child row of a group. All three uid
 * fields then carry the dotted path (`parent.uid` + '.' + child uid) — that is
 * the join key the api's buildSchemaTree uses to nest the child under its group
 * (and the dots are stripped from the final Contentstack schema). The display
 * name becomes `Parent > child`.
 *
 * Seeded from the confirmed Sanity → Contentstack mapping:
 *   string  -> single_line_text        slug    -> single_line_text
 *   text    -> multi_line_text          datetime-> isodate
 *   block[] -> json (JSON-RTE)          image   -> file
 *   reference -> reference              array   -> group (multiple)
 *   object  -> group                    boolean -> boolean
 *   number  -> number                   url     -> url
 *   array w/ >=2 distinct element _types -> modular_blocks (one block per _type;
 *   rows built directly with baseField in contentTypes.ts emitFieldRows)
 */
export interface ParentCtx {
  uid: string;       // the parent group's (possibly already dotted) contentstackFieldUid
  label: string;     // the parent group's display name
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
    isDeleted: false, // buildFieldSchema filters on isDeleted === false strictly
  };
};

export const mapField = (name: string, sourceType: string, parent?: ParentCtx): Field => {
  switch (sourceType) {
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

    case 'fileMultiple': {   // array of image/file objects -> multiple file
      const f = baseField(name, sourceType, 'file', parent);
      f.advanced = { multiple: true };
      return f;
    }

    case 'reference':
      return baseField(name, sourceType, 'reference', parent);

    case 'array': {       // array of objects -> group with multiple
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
      return baseField(name, sourceType, 'url', parent);

    case 'geopoint':
      return baseField(name, sourceType, 'json', parent);

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      return baseField(name, sourceType, 'json', parent);
  }
};

export default mapField;
