import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, DatoContentType, DatoField, DatoFieldsEntry, Field } from '../interface/interface';
import mapField, { baseField, BlockInfo, MapperCtx } from './schemaMapper';
import { ensureDir, writeJson, readJson, resolveExportRoot } from '../utils/helper';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

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
 * Contentstack REQUIRES every content type to have a `title` field, and this
 * repo's CT-update path marks every CT as a page (`mergeTwoCts` sets
 * `is_page: true`, `sub_title: ['url']`), so a `url` field is required too —
 * applied uniformly to both entry-level content types and the block types
 * emitted as `global_field` (the generic CT-writer doesn't special-case skip
 * this for global fields either). Without these rows the CMA rejects the CT
 * update at migration time:
 *   "content_type: should have a 'title' field."
 *   "schema: should have a 'url' field."
 */
const TITLE_CANDIDATES = ['title', 'name', 'label', 'heading'];

function ensureMandatoryFields(fieldMapping: Field[]): void {
  const topLevel = (f: Field) => !f.uid.includes('.');

  if (!fieldMapping.some((f) => topLevel(f) && f.contentstackFieldUid === 'title')) {
    const candidate = fieldMapping.find(
      (f) =>
        topLevel(f) &&
        TITLE_CANDIDATES.includes(f.otherCmsField.toLowerCase()) &&
        ['single_line_text', 'multi_line_text', 'text'].includes(f.contentstackFieldType),
    );
    if (candidate) {
      candidate.uid = candidate.contentstackFieldUid = candidate.backupFieldUid = 'title';
      candidate.contentstackField = 'title';
      candidate.advanced = { ...candidate.advanced, mandatory: true };
    } else {
      const row = baseField('title', 'text', 'single_line_text');
      row.advanced = { mandatory: true };
      fieldMapping.unshift(row);
    }
  }

  if (!fieldMapping.some((f) => topLevel(f) && f.contentstackFieldUid === 'url')) {
    const row = baseField('url', 'text', 'url');
    row.advanced = { mandatory: true };
    fieldMapping.push(row);
  }
}

/**
 * Parse the DatoCMS export into Contentstack content-type / global-field
 * schemas. Unlike the generic schema-less template, DatoCMS ships an EXPLICIT
 * schema (`content_types.json` + `fields.json`) separate from the data
 * (`records.json`) — so the field map is built deterministically from the
 * schema, not inferred from record samples.
 *
 * The emitted CT object shape (`otherCmsTitle` / `otherCmsUid` /
 * `contentstackTitle` / `contentstackUid` / `type` / `fieldMapping`) is the
 * contract the api side consumes.
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const root = resolveExportRoot(filePath);
    const contentTypes: DatoContentType[] = readJson(path.join(root, 'content_types.json'));
    const fieldsByTypeId: Record<string, DatoFieldsEntry> = readJson(path.join(root, 'fields.json'));

    // Build the global id -> {apiKey, contentstackUid, isBlock} lookup ONCE,
    // covering both entry-level types and block types — link/links/single_block/
    // rich_text fields on ANY content type may point at either.
    const blocksById = new Map<string, BlockInfo>();
    contentTypes.forEach((ct) => {
      const contentstackUid = `${affix ? affix + '_' : ''}${ct.api_key}`;
      blocksById.set(ct.id, { apiKey: ct.api_key, contentstackUid, isBlock: ct.modular_block });
    });

    // id -> that type's own DatoField[] (needed when a rich_text field recurses
    // into a block's fields).
    const blockFieldsById = new Map<string, DatoField[]>();
    Object.entries(fieldsByTypeId).forEach(([id, entry]) => {
      blockFieldsById.set(id, entry.fields ?? []);
    });

    for (const ct of contentTypes) {
      const fieldsEntry = fieldsByTypeId[ct.id];
      const sourceFields = fieldsEntry?.fields ?? [];

      const ctx: MapperCtx = { affix, blocksById, parent: undefined };
      const fieldMapping: Field[] = [];
      sourceFields.forEach((field) => {
        fieldMapping.push(...mapField(field, ctx, blockFieldsById));
      });

      ensureMandatoryFields(fieldMapping);

      const contentstackUid = blocksById.get(ct.id)!.contentstackUid;
      const contentType = {
        // otherCmsTitle/otherCmsUid double as BOTH the UI display label (rendered
        // e.g. in SaveChangesModal) AND createEntry's join key against
        // records.json (via api_key, resolved from each record's __itemTypeId) —
        // mirrors migration-wordpress setting both to its post-type slug.
        otherCmsTitle: ct.api_key,
        otherCmsUid: ct.api_key,
        contentstackTitle: ct.name,
        contentstackUid,
        type: ct.modular_block ? 'global_field' : 'content_type',
        fieldMapping,
      };

      writeJson(path.join(contentTypeFolderPath, `${ct.api_key}.json`), contentType);
    }

    return readJsonFilesFromFolder(contentTypeFolderPath);
  } catch (error: any) {
    console.error('Error while creating DatoCMS content types:', error?.message);
    return [];
  }
}

export default extractContentTypes;
