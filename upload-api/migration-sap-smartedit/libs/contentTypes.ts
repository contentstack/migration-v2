import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField, { baseField } from './schemaMapper';
import { ensureDir, writeJson, parseImpexPath, ImpexColumnDef } from '../utils/helper';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

/**
 * ImpEx item types that are NOT modelled as content types.
 * `Media` is SAP's asset item — handled by the api asset pass (getAllAssets),
 * not as a content type.
 */
const ASSET_TYPES = new Set(['Media']);

/**
 * Best-effort reference targets by column name, so reference fields point at the
 * right content type(s). Unknown columns (parent/item/cmsComponents — the target
 * type is not knowable from the ImpEx header alone) are left unresolved for the
 * user to set in the field-mapping UI.
 */
const REF_TARGETS: Record<string, string[]> = {
  template: ['PageTemplate'],
  page: ['ContentPage', 'CategoryPage', 'ProductPage'],
  contentslot: ['ContentSlot'],
  navigationnode: ['NavigationNode'],
};

const TITLE_CANDIDATES = ['title', 'name', 'label', 'heading'];

/**
 * Source columns dropped entirely — not emitted as content-type fields.
 * `uid`/`uuid` are SAP's internal identifiers; the entry identity is derived
 * from the source `uid` at transform time (and Contentstack gives every entry
 * its own system `uid`), so they add no value as content fields.
 */
const DROP_COLUMNS = new Set(['uid', 'uuid']);

/**
 * Contentstack content-type UIDs MUST be lowercase — the CMA normalizes them to
 * lowercase on creation, so a mixed-case uid (e.g. `cs_ContentPage`) is stored as
 * `cs_contentpage` and every later update/entry lookup by the mixed-case uid then
 * fails with "Content Type not found". Keep all CT uids (and reference targets)
 * lowercase and sanitized.
 */
const toCtUid = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Field UIDs Contentstack reserves for system use — a custom field may NOT use
 * them (the CMA rejects the content type with
 * "schema.N.uid: has a restricted value '<uid>'"). `title` and `url` are the
 * standard built-ins we intentionally add, so they are NOT restricted here.
 * Any source column mapping to one of these is prefixed with `src_`.
 */
const RESERVED_FIELD_UIDS = new Set([
  'uid', 'locale', 'tags', 'created_at', 'updated_at', 'created_by', 'updated_by',
  '_version', '_metadata', 'acl', 'publish_details', '_in_progress', '_workflow',
]);

/** Rename a field whose uid collides with a Contentstack-reserved uid. */
function guardReservedUid(field: Field): void {
  if (RESERVED_FIELD_UIDS.has(field.contentstackFieldUid.toLowerCase())) {
    const renamed = `src_${field.contentstackFieldUid}`;
    field.uid = renamed;
    field.contentstackFieldUid = renamed;
    field.backupFieldUid = renamed;
  }
}

function readJsonFilesFromFolder(folderPath: string): CT[] {
  const result: CT[] = [];
  if (!fs.existsSync(folderPath)) return result;
  for (const file of fs.readdirSync(folderPath)) {
    if (file.endsWith('.json')) {
      try {
        result.push(JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8')));
      } catch (err) {
        console.error(`❌ Failed to parse ${file}:`, err);
      }
    }
  }
  return result;
}

/**
 * Matches real HTML tags only (a fixed whitelist), NOT any `<word>` token —
 * DSL/script values from extension modules (Promotions rule scripts, etc.)
 * commonly contain generic-type syntax like `List<String>` or
 * `Map<String,Integer>`, which a bare `<[a-z][^>]*>` pattern would wrongly
 * match and misclassify as HTML, corrupting the value once Contentstack's
 * HTML-RTE tries to parse "String"/"Integer" as tags.
 */
const HTML_TAG_RE =
  /<\/?(p|div|span|strong|em|b|i|u|s|ul|ol|li|h[1-6]|a|br|img|table|thead|tbody|tr|td|th|blockquote|pre|code|figure|figcaption)\b[^>]*>/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
/** Contentstack's single-line text editor is meant for short values; longer
 *  plain-text values (descriptions, blurbs) read better as multi_line_text. */
const MULTILINE_THRESHOLD = 100;

/**
 * Classify an ImpEx column into a source type consumed by schemaMapper, using
 * the header-derived flags plus the observed cell values for that column.
 */
/**
 * Decide whether a `(lookup)` column really points at another migrated item.
 *
 * An ImpEx lookup qualifier says which ATTRIBUTE to match on, not what kind of thing
 * is being matched. `approvalStatus(code)`, `target(code)`, `language(isocode)` and
 * `validComponentTypes(code)` all look identical to `template(uid,$contentCV)` in the
 * header, but the first four resolve against ENUMS and type codes — there is no entry
 * to point at. Typing them as references produced empty reference fields in
 * Contentstack (values like `approved`, `en`, `sameWindow` silently vanished) and
 * 2417 phantom "unresolved reference" warnings on real SAP data.
 *
 * Decided from the data: a lookup is an item reference when at least one of its values
 * matches a declared item id, or when the column is a known reference by name. A column
 * whose targets all live outside the export becomes plain text, which preserves the
 * value instead of dropping it into an unresolvable reference.
 */
function isItemReference(col: ImpexColumnDef, values: string[], itemIds: Set<string>): boolean {
  if (REF_TARGETS[col.name.toLowerCase()]) return true;
  return values.some((v) =>
    String(v)
      .split(',')
      .map((s) => s.trim())
      .some((id) => id !== '' && itemIds.has(id)),
  );
}

function classifyColumn(col: ImpexColumnDef, values: string[], itemIds: Set<string>): string {
  if (col.isMedia) return 'file';
  if (col.isReference && isItemReference(col, values, itemIds)) {
    const multiple =
      col.name.toLowerCase() === 'cmscomponents' || values.some((v) => v.includes(','));
    return multiple ? 'referenceMultiple' : 'reference';
  }

  const name = col.name.toLowerCase();
  if (name === 'url' || name === 'urllink') return 'url';

  const nonEmpty = values.filter((v) => v !== '');
  // Column named `content`, or any column whose values actually contain HTML
  // markup (SAP components put rich text under many different field names).
  if (name === 'content' || (nonEmpty.length && nonEmpty.some((v) => HTML_TAG_RE.test(v)))) {
    return 'html';
  }
  if (nonEmpty.length && nonEmpty.every((v) => v === 'true' || v === 'false')) return 'boolean';
  if (nonEmpty.length && nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'number';
  if (nonEmpty.length && nonEmpty.every((v) => ISO_DATE_RE.test(v))) return 'date';
  if (nonEmpty.length && nonEmpty.some((v) => v.length > MULTILINE_THRESHOLD)) return 'multiline';
  return 'string';
}

/**
 * Contentstack REQUIRES every content type to have a `title` field, and this
 * repo's CT-update path marks every CT as a page (`is_page: true`,
 * `sub_title: ['url']`), so a `url` field is required too. Without these rows the
 * schemas import locally but the CMA rejects the CT update at migration time.
 *
 * `title` is the primary MANDATORY field: re-point the source display field at
 * uid `title` when one exists, otherwise synthesize it — and always mark it
 * `mandatory: true`. `url` is also synthesized/kept (required by the page path).
 */
function ensureMandatoryFields(fieldMapping: Field[]): void {
  let titleField = fieldMapping.find((f) => f.contentstackFieldUid === 'title');

  if (!titleField) {
    const candidate = fieldMapping.find(
      (f) =>
        TITLE_CANDIDATES.includes(f.otherCmsField.toLowerCase()) &&
        ['single_line_text', 'multi_line_text', 'text'].includes(f.contentstackFieldType),
    );
    if (candidate) {
      candidate.uid = candidate.contentstackFieldUid = candidate.backupFieldUid = 'title';
      candidate.contentstackField = 'title';
      titleField = candidate;
    } else {
      titleField = baseField('title', 'text', 'text');
      fieldMapping.unshift(titleField);
    }
  }
  // title is mandatory whether it came from a source column or was synthesized
  titleField.advanced = { ...titleField.advanced, mandatory: true };

  let urlField = fieldMapping.find((f) => f.contentstackFieldUid === 'url');
  if (!urlField) {
    urlField = baseField('url', 'text', 'url');
    fieldMapping.push(urlField);
  }
  // url is mandatory whether it came from a source column or was synthesized
  urlField.advanced = { ...urlField.advanced, mandatory: true };
}

/**
 * Parse the ImpEx export into Contentstack content-type schemas.
 *
 * The emitted CT object shape (`otherCmsTitle` / `otherCmsUid` /
 * `contentstackTitle` / `contentstackUid` / `type` / `fieldMapping`) is the
 * contract the api side consumes — keep these exact keys.
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const { blocks } = parseImpexPath(filePath);
    const prefix = affix ? `${affix}_` : '';

    // Every declared item id in the export, mirroring how the api side builds its
    // reference lookup (uid/code only). Used to tell a genuine item reference from an
    // enum/type-code lookup that happens to share the same header syntax.
    const itemIds = new Set<string>();
    for (const [type, block] of blocks) {
      if (ASSET_TYPES.has(type)) continue;
      for (const row of block.rows) {
        const id = row.uid ?? row.code;
        if (id) itemIds.add(id);
      }
    }

    for (const [type, block] of blocks) {
      if (ASSET_TYPES.has(type)) {
        console.info(`ℹ️  "${type}" → handled as assets (skipped as content type)`);
        continue;
      }

      const fieldMapping: Field[] = [];
      for (const [name, col] of block.columns) {
        if (DROP_COLUMNS.has(name.toLowerCase())) continue; // uid/uuid: not content fields
        const values = block.rows.map((r) => r[name]).filter((v) => v !== undefined);
        const sourceType = classifyColumn(col, values, itemIds);
        const field = mapField(name, sourceType);

        if (sourceType === 'reference' || sourceType === 'referenceMultiple') {
          const targets = REF_TARGETS[name.toLowerCase()];
          if (targets) field.refrenceTo = targets.map((t) => toCtUid(`${prefix}${t}`));
        }

        guardReservedUid(field);
        fieldMapping.push(field);
      }

      ensureMandatoryFields(fieldMapping);

      const contentType = {
        otherCmsTitle: type,
        otherCmsUid: toCtUid(`${prefix}${type}`),
        contentstackTitle: type,
        contentstackUid: toCtUid(`${prefix}${type}`),
        type: 'content_type',
        fieldMapping,
      };

      writeJson(path.join(contentTypeFolderPath, `${type}.json`), contentType);
    }

    return readJsonFilesFromFolder(contentTypeFolderPath);
  } catch (error: any) {
    console.error('Error while creating content types:', error?.message);
    return [];
  }
}

export default extractContentTypes;
