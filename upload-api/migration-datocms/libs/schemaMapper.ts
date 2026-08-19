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

/**
 * DatoCMS slug prefixes are absolute (`https://host/resources/article/`).
 * Contentstack's `url_prefix` is a path, so strip scheme + host and keep
 * path + query — the query form is deliberate: `/resources/?category=` is carried
 * across as-is rather than being "cleaned up" into something that isn't what the
 * source said. A prefix that is already relative is returned unchanged.
 */
export const toUrlPrefixPath = (prefix?: string): string | undefined => {
  const raw = String(prefix ?? '').trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
};

/** `body_copy` -> `Body Copy`. Fallback display name when the source carries no label. */
export const humanize = (name: string): string =>
  String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * `displayName` is the DatoCMS field's `label` — what an editor sees in Contentstack.
 * It NEVER feeds the uid: uids stay derived from `api_key` via `toUid`, because
 * entries and references are keyed on them and renaming a uid would orphan data.
 * Synthetic rows (group children, block rows, injected title/url) pass no label
 * and fall back to a humanized name.
 */
export const baseField = (
  name: string,
  sourceType: string,
  csType: string,
  parent?: ParentCtx,
  localized?: boolean,
  displayName?: string,
): Field => {
  const uid = parent ? `${parent.uid}.${toUid(name)}` : toUid(name);
  const own = displayName?.trim() || humanize(name);
  const label = parent ? `${parent.label} > ${own}` : own;
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
  displayName?: string,
): Field[] => {
  const parentRow = baseField(name, sourceType, 'group', parent, localized, displayName);
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
  const parentRow = baseField(field.api_key, 'rich_text', 'modular_blocks', ctx.parent, field.localized, field.label);
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
    return [baseField(field.api_key, 'rich_text', 'json', ctx.parent, field.localized, field.label)];
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
  const row = baseField(field.api_key, 'single_block', 'reference', ctx.parent, field.localized, field.label);
  const ctUids = itemTypes.map((id) => ctx.blocksById.get(id)?.contentstackUid).filter(Boolean) as string[];
  if (ctUids.length) {
    row.refrenceTo = ctUids;
  } else {
    console.warn(`single_block "${field.api_key}": no resolvable single_block_blocks item_types`);
  }
  return row;
};

export const mapField = (
  field: DatoField,
  ctx: MapperCtx,
  blockFieldsById: Map<string, DatoField[]>,
): Field[] => {
  const editor = field.appearance?.editor;

  switch (field.field_type) {
    /**
     * DatoCMS `slug` is a URL path, so it maps to Contentstack's `url` type
     * rather than a plain text box.
     *
     * Guard: Contentstack's page-URL field must have uid `url`. A slug named
     * anything else (`permalink`, `path`, …) cannot take that role, so it falls
     * back to `single_line_text` — the value is identical either way, only the
     * field's role differs. Nested slugs (inside a group or block) can't be the
     * content type's URL either, so they fall back too.
     *
     * A `url`-typed field only behaves as a URL on a page-type content type, so
     * the api's `buildCtOptions` sets `is_page: true` for exactly the content
     * types that end up with a `url` field.
     */
    case 'slug': {
      const isCtUrl = !ctx.parent && toUid(field.api_key) === 'url';
      const row = baseField(
        field.api_key,
        field.field_type,
        isCtUrl ? 'url' : 'single_line_text',
        ctx.parent,
        field.localized,
        field.label,
      );
      if (isCtUrl) {
        // DatoCMS stores the site prefix on the FIELD (appearance.parameters.url_prefix)
        // and the bare slug on the record — the same split Contentstack uses
        // (options.url_prefix + entry value). Carry it across, stripped to a path
        // so the stack never hardcodes a hostname. Read back by the api's
        // buildCtOptions off `advanced.urlPrefix`.
        const prefix = toUrlPrefixPath(field.appearance?.parameters?.url_prefix);
        if (prefix) row.advanced = { ...row.advanced, urlPrefix: prefix };
      }
      return [row];
    }

    case 'string': {
      if (editor === 'string_radio_group' || editor === 'string_select') {
        const row = baseField(field.api_key, field.field_type, 'dropdown', ctx.parent, field.localized, field.label);
        const paramKey = editor === 'string_radio_group' ? 'radios' : 'options';
        const items: any[] = field.appearance?.parameters?.[paramKey] ?? [];
        row.advanced = { ...row.advanced, options: items.map((o: any) => ({ key: o.label, value: o.value })) };
        return [row];
      }
      return [baseField(field.api_key, field.field_type, 'single_line_text', ctx.parent, field.localized, field.label)];
    }

    case 'text':
      if (editor === 'markdown') return [baseField(field.api_key, field.field_type, 'markdown', ctx.parent, field.localized, field.label)];
      if (editor === 'wysiwyg') return [baseField(field.api_key, field.field_type, 'html', ctx.parent, field.localized, field.label)];
      return [baseField(field.api_key, field.field_type, 'multi_line_text', ctx.parent, field.localized, field.label)];

    case 'boolean':
      return [baseField(field.api_key, field.field_type, 'boolean', ctx.parent, field.localized, field.label)];

    case 'integer':
    case 'float':
      if (editor === 'star_rating' || field.appearance?.field_extension === 'starRating') {
        return [baseField(field.api_key, 'dato_star_rating', 'extension', ctx.parent, field.localized, field.label)];
      }
      return [baseField(field.api_key, field.field_type, 'number', ctx.parent, field.localized, field.label)];

    case 'date':
    case 'date_time': // docs-only in the sample — no populated instances, see TRD
      return [baseField(field.api_key, field.field_type, 'isodate', ctx.parent, field.localized, field.label)];

    case 'color':
      return [baseField(field.api_key, 'dato_color', 'extension', ctx.parent, field.localized, field.label)];

    case 'video': // external-provider metadata; mapped to link using url + title
      return [baseField(field.api_key, field.field_type, 'link', ctx.parent, field.localized, field.label)];

    case 'json': {
      if (editor === 'string_checkbox_group' || editor === 'string_multi_select') {
        const row = baseField(field.api_key, field.field_type, 'dropdown', ctx.parent, field.localized, field.label);
        const items: any[] = field.appearance?.parameters?.options ?? [];
        row.advanced = { ...row.advanced, options: items.map((o: any) => ({ key: o.label, value: o.value })), multiple: true };
        return [row];
      }
      return [baseField(field.api_key, 'dato_json', 'extension', ctx.parent, field.localized, field.label)];
    }

    case 'lat_lon':
      return groupField(field.api_key, field.field_type, [
        { name: 'latitude', csType: 'number' },
        { name: 'longitude', csType: 'number' },
      ], ctx.parent, field.localized, field.label);

    case 'seo':
      return groupField(field.api_key, field.field_type, [
        { name: 'title', csType: 'single_line_text' },
        { name: 'description', csType: 'multi_line_text' },
        { name: 'image', csType: 'file' },
      ], ctx.parent, field.localized, field.label);

    case 'file':
      return [baseField(field.api_key, field.field_type, 'file', ctx.parent, field.localized, field.label)];

    case 'gallery': {
      const row = baseField(field.api_key, field.field_type, 'file', ctx.parent, field.localized, field.label);
      row.advanced = { ...row.advanced, multiple: true };
      return [row];
    }

    case 'link': {
      const targetIds = field.validators?.item_item_type?.item_types ?? [];
      const row = baseField(field.api_key, field.field_type, 'reference', ctx.parent, field.localized, field.label);
      row.refrenceTo = targetIds
        .map((id) => ctx.blocksById.get(id)?.contentstackUid)
        .filter(Boolean) as string[];
      return [row];
    }

    case 'links': {
      const targetIds = field.validators?.items_item_type?.item_types ?? [];
      const row = baseField(field.api_key, field.field_type, 'reference', ctx.parent, field.localized, field.label);
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

    case 'structured_text': {
      const row = baseField(field.api_key, field.field_type, 'json', ctx.parent, field.localized, field.label);
      // Collect all item_type IDs that can appear inside this structured text field
      // (embedded blocks, inline records, and linked records) and map them to their
      // CS content type UIDs so the CT builder sets embed_entry: true + reference_to.
      const allowedIds = [
        ...(field.validators?.structured_text_blocks?.item_types ?? []),
        ...(field.validators?.structured_text_inline_blocks?.item_types ?? []),
        ...(field.validators?.structured_text_links?.item_types ?? []),
      ];
      const embedObjects = [...new Set(allowedIds)]
        .map((id) => ctx.blocksById.get(id)?.contentstackUid)
        .filter(Boolean) as string[];
      if (embedObjects.length) {
        row.advanced = { ...row.advanced, embedObjects };
      }
      return [row];
    }

    // --- fallback: keep raw structure as JSON rather than dropping data ---
    default:
      console.warn(`Unrecognized DatoCMS field_type "${field.field_type}" on "${field.api_key}" — falling back to json`);
      return [baseField(field.api_key, field.field_type, 'json', ctx.parent, field.localized, field.label)];
  }
};

export default mapField;
