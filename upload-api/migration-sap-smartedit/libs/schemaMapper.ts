import { Field } from '../interface/interface';

/**
 * Map a single SAP SmartEdit (ImpEx) column to a Contentstack `Field`.
 *
 * ImpEx is a flat, header-defined format — there is no nesting, so (unlike the
 * JSON-oriented connectors) we do not expand groups/modular-blocks here. Column
 * "types" are derived in contentTypes.ts from the header syntax + observed
 * values (see `classifyColumn`), producing one of the source types below.
 *
 * Returned `contentstackFieldType` must be one of the values consumed by the api
 * side (see reference/touchpoints.md):
 *   single_line_text | multi_line_text | text | html | json | markdown |
 *   number | boolean | isodate | file | reference | taxonomy | link | group |
 *   global_field | url
 */
export interface ParentCtx {
  uid: string;
  label: string;
  inBlocks?: boolean;
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
    // short identifiers / names / labels / free text cells
    case 'string':
      return baseField(name, sourceType, 'single_line_text', parent);

    // HTML body content (e.g. CMSParagraphComponent.content)
    case 'html':
      return baseField(name, sourceType, 'html', parent);

    // long plain text without markup (descriptions/blurbs)
    case 'multiline':
      return baseField(name, sourceType, 'multi_line_text', parent);

    // ISO-8601 date/datetime values (e.g. activeFrom/activeUntil)
    case 'date':
      return baseField(name, sourceType, 'isodate', parent);

    // media(...) lookups + the $picture macro -> Contentstack asset field
    case 'file':
      return baseField(name, sourceType, 'file', parent);

    // single foreign-key lookup, e.g. template(uid), page(uid), contentSlot(uid)
    case 'reference':
      return baseField(name, sourceType, 'reference', parent);

    // comma / &ref lists, e.g. cmsComponents(&componentRef)
    case 'referenceMultiple': {
      const f = baseField(name, sourceType, 'reference', parent);
      f.advanced = { multiple: true };
      return f;
    }

    case 'boolean':
      return baseField(name, sourceType, 'boolean', parent);

    case 'number':
      return baseField(name, sourceType, 'number', parent);

    // url / urlLink columns
    case 'url':
      return baseField(name, sourceType, 'url', parent);

    // ImpEx cells are text by nature — default to single line rather than json
    default:
      return baseField(name, sourceType, 'single_line_text', parent);
  }
};

export default mapField;
