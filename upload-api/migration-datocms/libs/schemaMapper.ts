import { DatoField, Field } from '../interface/interface';

/**
 * Map DatoCMS fields (declarative schema from fields.json — NOT inferred from
 * record samples, unlike the generic schema-less template this package started
 * from) to Contentstack `Field` rows.
 *
 * Source-type -> Contentstack-type table (docs ∪ sample union — confirmed in
 * docs/features/datocms-connector/trd.md):
 *   string/slug -> single_line_text | text(markdown) -> markdown | text(wysiwyg) -> html
 *   text(textarea) -> multi_line_text | boolean -> boolean | integer/float -> number
 *   date/date_time -> isodate | color -> single_line_text (hex) | video -> link (url+title) | json -> json | lat_lon -> group(lat,lon)
 *   seo -> group(title,description,image) | file -> file | gallery -> file+multiple
 *   link -> reference | links -> reference+multiple | single_block -> global_field
 *   rich_text -> modular_blocks | structured_text -> json (DAST extraction deferred)
 */

export interface BlockInfo {
  apiKey: string;
  contentstackUid: string;
  isBlock: boolean;
}

export interface ParentCtx {
  uid: string;
  label: string;
  inBlocks?: boolean; // Contentstack forbids blocks inside blocks
}

export interface MapperCtx {
  affix: string;
  blocksById: Map<string, BlockInfo>;
  parent?: ParentCtx;
}

export const toUid = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const baseField = (
  name: string,
  sourceType: string,
  csType: string,
  parent?: ParentCtx,
  localized?: boolean,
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
    // `localized` (NOT set on synthetic dotted-child rows — group children never
    // read directly off a record; the whole group's value is unwrapped ONCE at
    // the top level before recursing) tells createEntry whether this field's raw
    // value on a DatoCMS record is wrapped `{ <locale>: value }` or a plain value.
    advanced: localized === undefined ? {} : { localized },
    isDeleted: false, // api's buildFieldSchema filters on isDeleted === false strictly
  };
};

/** Fixed-shape group: lat_lon (lat, lon) / seo (title, description, image) — not inferred. */
const groupField = (
  name: string,
  sourceType: string,
  children: Array<{ name: string; csType: string }>,
  parent: ParentCtx | undefined,
  localized?: boolean,
): Field[] => {
  const parentRow = baseField(name, sourceType, 'group', parent, localized);
  const childCtx: ParentCtx = {
    uid: parentRow.contentstackFieldUid,
    label: parentRow.contentstackField,
    inBlocks: parent?.inBlocks,
  };
  const rows: Field[] = [parentRow];
  children.forEach((c) => rows.push(baseField(c.name, sourceType, c.csType, childCtx)));
  return rows;
};

/**
 * rich_text (DatoCMS "Modular Content", multiple blocks) -> `modular_blocks`
 * parent + one `modular_blocks_child` row per allowed `rich_text_blocks.item_types`
 * entry, with that block's OWN fields (looked up by item_type id) recursed in.
 * Unlike the generic template, the block list comes straight from the field's
 * validators — DatoCMS's schema is declarative, so there's no need to infer
 * heterogeneity from sample data.
 */
const richTextField = (
  field: DatoField,
  ctx: MapperCtx,
  blockFieldsById: Map<string, DatoField[]>,
): Field[] => {
  const itemTypes = field.validators?.rich_text_blocks?.item_types ?? [];
  const parentRow = baseField(field.api_key, 'rich_text', 'modular_blocks', ctx.parent, field.localized);
  const rows: Field[] = [parentRow];
  let emitted = 0;

  itemTypes.forEach((blockId) => {
    const info = ctx.blocksById.get(blockId);
    const blockFields = blockFieldsById.get(blockId) ?? [];
    if (!info || !blockFields.length) {
      console.warn(
        `rich_text "${field.api_key}": block item_type ${blockId} not found or has no fields; skipped`,
      );
      return;
    }
    const blockRow = baseField(info.apiKey, 'block', 'modular_blocks_child', {
      uid: parentRow.contentstackFieldUid,
      label: parentRow.contentstackField,
    });
    rows.push(blockRow);
    emitted += 1;

    const blockCtx: MapperCtx = {
      ...ctx,
      parent: { uid: blockRow.contentstackFieldUid, label: blockRow.contentstackField, inBlocks: true },
    };
    blockFields.forEach((bf) => rows.push(...mapField(bf, blockCtx, blockFieldsById)));
  });

  if (!emitted) {
    console.warn(`rich_text "${field.api_key}": no resolvable blocks; falling back to json`);
    return [baseField(field.api_key, 'rich_text', 'json', ctx.parent, field.localized)];
  }
  return rows;
};

/**
 * single_block (DatoCMS "Modular Content — Single Block", exactly one block or
 * null) -> a Contentstack `global_field` reference. Modeled on the real
 * precedent in this repo: `upload-api/src/controllers/sitecore/index.ts` tags
 * shared/reusable content `type: 'global_field'`, and the shared CT/entry
 * builders (`api/src/utils/content-type-creator.utils.ts`,
 * `entries-field-creator.utils.ts`) already know how to create and resolve
 * real Global Fields generically — this is a proven mechanism, not a novel one.
 *
 * `refrenceTo` carries the target block's `contentstackUid`; datocms.service.ts's
 * hand-rolled `createEntry` resolves the value via that array (see its own
 * global_field case), independent of the shared utility's uid-matching quirk.
 */
const singleBlockField = (field: DatoField, ctx: MapperCtx): Field => {
  const itemTypes = field.validators?.single_block_blocks?.item_types ?? [];
  const targetId = itemTypes[0];
  const info = targetId ? ctx.blocksById.get(targetId) : undefined;
  const row = baseField(field.api_key, 'single_block', 'global_field', ctx.parent, field.localized);
  if (info) {
    row.refrenceTo = [info.contentstackUid];
  } else {
    console.warn(`single_block "${field.api_key}": no resolvable single_block_blocks item_type`);
  }
  return row;
};

export const mapField = (
  field: DatoField,
  ctx: MapperCtx,
  blockFieldsById: Map<string, DatoField[]>,
): Field[] => {
  const editor = field.appearance?.editor;

  // Contentstack forbids blocks inside blocks — anything under a modular_blocks
  // ancestor that would itself need a block/global-field container falls back
  // to a raw json leaf instead (no data dropped, just not resolved as blocks).
  if (ctx.parent?.inBlocks && (field.field_type === 'rich_text' || field.field_type === 'single_block')) {
    console.warn(`"${field.api_key}" (${field.field_type}) is nested inside a block — Contentstack forbids blocks inside blocks; falling back to json`);
    return [baseField(field.api_key, field.field_type, 'json', ctx.parent, field.localized)];
  }

  switch (field.field_type) {
    case 'string':
    case 'slug':
      return [baseField(field.api_key, field.field_type, 'single_line_text', ctx.parent, field.localized)];

    case 'text':
      if (editor === 'markdown') return [baseField(field.api_key, field.field_type, 'markdown', ctx.parent, field.localized)];
      if (editor === 'wysiwyg') return [baseField(field.api_key, field.field_type, 'html', ctx.parent, field.localized)];
      return [baseField(field.api_key, field.field_type, 'multi_line_text', ctx.parent, field.localized)];

    case 'boolean':
      return [baseField(field.api_key, field.field_type, 'boolean', ctx.parent, field.localized)];

    case 'integer':
    case 'float':
      if (editor === 'star_rating') {
        return [baseField(field.api_key, 'dato_star_rating', 'extension', ctx.parent, field.localized)];
      }
      return [baseField(field.api_key, field.field_type, 'number', ctx.parent, field.localized)];

    case 'date':
    case 'date_time': // docs-only in the sample — no populated instances, see TRD
      return [baseField(field.api_key, field.field_type, 'isodate', ctx.parent, field.localized)];

    case 'color':
      return [baseField(field.api_key, 'dato_color', 'extension', ctx.parent, field.localized)];

    case 'video': // external-provider metadata; mapped to link using url + title
      return [baseField(field.api_key, field.field_type, 'link', ctx.parent, field.localized)];

    case 'json':
      return [baseField(field.api_key, 'dato_json', 'extension', ctx.parent, field.localized)];

    case 'lat_lon':
      return groupField(field.api_key, field.field_type, [
        { name: 'lat', csType: 'number' },
        { name: 'lon', csType: 'number' },
      ], ctx.parent, field.localized);

    case 'seo':
      return groupField(field.api_key, field.field_type, [
        { name: 'title', csType: 'single_line_text' },
        { name: 'description', csType: 'multi_line_text' },
        { name: 'image', csType: 'file' },
      ], ctx.parent, field.localized);

    case 'file':
      return [baseField(field.api_key, field.field_type, 'file', ctx.parent, field.localized)];

    case 'gallery': {
      const row = baseField(field.api_key, field.field_type, 'file', ctx.parent, field.localized);
      row.advanced = { ...row.advanced, multiple: true };
      return [row];
    }

    case 'link': {
      const targetIds = field.validators?.item_item_type?.item_types ?? [];
      const row = baseField(field.api_key, field.field_type, 'reference', ctx.parent, field.localized);
      row.refrenceTo = targetIds
        .map((id) => ctx.blocksById.get(id)?.contentstackUid)
        .filter(Boolean) as string[];
      return [row];
    }

    case 'links': {
      const targetIds = field.validators?.items_item_type?.item_types ?? [];
      const row = baseField(field.api_key, field.field_type, 'reference', ctx.parent, field.localized);
      row.advanced = { ...row.advanced, multiple: true };
      row.refrenceTo = targetIds
        .map((id) => ctx.blocksById.get(id)?.contentstackUid)
        .filter(Boolean) as string[];
      return [row];
    }

    case 'single_block':
      return [singleBlockField(field, ctx)];

    case 'rich_text':
      return richTextField(field, ctx, blockFieldsById);

    case 'structured_text':
      // DAST-tree block/inline-item/link extraction deferred — see TRD open
      // questions. Preserve the raw structured-text value losslessly as JSON
      // rather than guessing at the conversion.
      return [baseField(field.api_key, field.field_type, 'json', ctx.parent, field.localized)];

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      console.warn(`Unrecognized DatoCMS field_type "${field.field_type}" on "${field.api_key}" — falling back to json`);
      return [baseField(field.api_key, field.field_type, 'json', ctx.parent, field.localized)];
  }
};

export default mapField;
