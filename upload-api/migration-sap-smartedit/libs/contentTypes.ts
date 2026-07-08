import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField, { baseField } from './schemaMapper';
import { ensureDir, writeJson, parseImpex, ImpexColumnDef } from '../utils/helper';

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
 * Re-point the source display field at uid `title` when present; otherwise
 * synthesize both rows.
 */
function ensureMandatoryFields(fieldMapping: Field[]): void {
  if (!fieldMapping.some((f) => f.contentstackFieldUid === 'title')) {
    const candidate = fieldMapping.find(
      (f) =>
        TITLE_CANDIDATES.includes(f.otherCmsField.toLowerCase()) &&
        ['single_line_text', 'multi_line_text', 'text'].includes(f.contentstackFieldType),
    );
    if (candidate) {
      candidate.uid = candidate.contentstackFieldUid = candidate.backupFieldUid = 'title';
      candidate.contentstackField = 'title';
      candidate.advanced = { ...candidate.advanced, mandatory: true };
    } else {
      const row = baseField('title', 'text', 'text');
      row.advanced = { mandatory: true };
      fieldMapping.unshift(row);
    }
  }

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

    const { blocks } = parseImpex(filePath);
    const prefix = affix ? `${affix}_` : '';

    for (const [type, block] of blocks) {
      if (ASSET_TYPES.has(type)) {
        console.info(`ℹ️  "${type}" → handled as assets (skipped as content type)`);
        continue;
      }

      const fieldMapping: Field[] = [];
      for (const [name, col] of block.columns) {
        const values = block.rows.map((r) => r[name]).filter((v) => v !== undefined);
        const sourceType = classifyColumn(col, values);
        const field = mapField(name, sourceType);

        if (sourceType === 'reference' || sourceType === 'referenceMultiple') {
          const targets = REF_TARGETS[name.toLowerCase()];
          if (targets) field.refrenceTo = targets.map((t) => `${prefix}${t}`);
        }

        fieldMapping.push(field);
      }

      ensureMandatoryFields(fieldMapping);

      const contentType = {
        otherCmsTitle: type,
        otherCmsUid: `${prefix}${type}`,
        contentstackTitle: type,
        contentstackUid: `${prefix}${type}`,
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
