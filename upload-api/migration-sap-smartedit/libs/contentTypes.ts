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
 * Classify an ImpEx column into a source type consumed by schemaMapper, using
 * the header-derived flags plus the observed cell values for that column.
 */
function classifyColumn(col: ImpexColumnDef, values: string[]): string {
  if (col.isMedia) return 'file';
  if (col.isReference) {
    const multiple =
      col.name.toLowerCase() === 'cmscomponents' || values.some((v) => v.includes(','));
    return multiple ? 'referenceMultiple' : 'reference';
  }

  const name = col.name.toLowerCase();
  if (name === 'content') return 'html';
  if (name === 'url' || name === 'urllink') return 'url';

  const nonEmpty = values.filter((v) => v !== '');
  if (nonEmpty.length && nonEmpty.every((v) => v === 'true' || v === 'false')) return 'boolean';
  if (nonEmpty.length && nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'number';
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

  if (!fieldMapping.some((f) => f.contentstackFieldUid === 'url')) {
    const row = baseField('url', 'text', 'url');
    row.advanced = { mandatory: true };
    fieldMapping.push(row);
  }
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

    for (const [type, block] of blocks) {
      if (ASSET_TYPES.has(type)) {
        console.info(`ℹ️  "${type}" → handled as assets (skipped as content type)`);
        continue;
      }

      const fieldMapping: Field[] = [];
      for (const [name, col] of block.columns) {
        if (DROP_COLUMNS.has(name.toLowerCase())) continue; // uid/uuid: not content fields
        const values = block.rows.map((r) => r[name]).filter((v) => v !== undefined);
        const sourceType = classifyColumn(col, values);
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
