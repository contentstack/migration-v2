import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField from './schemaMapper';
import { ensureDir, writeJson, findDataFile, readNdjson } from '../utils/helper';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

// ISO-8601 date / datetime (dates serialize as plain strings in most exports).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

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
 * Decide whether a record is real content or a system/internal/draft document.
 *
 * ⚠️ ADAPT THIS — every CMS ships internal records you must NOT turn into content
 * types. Skipping it generates junk CTs (e.g. Sanity `sanity.previewUrlSecret`).
 * Examples: Sanity → `_type` starts with `sanity.`, `_id` starts with `drafts.`;
 * Drupal → config/menu/system tables; WordPress → `attachment`, `wp_*` post types.
 */
function isSystemRecord(doc: any): boolean {
  const type: string | undefined = doc?._type ?? doc?.type;
  if (!type) return true;
  if (type.startsWith('sanity.')) return true; // <- adapt to your CMS
  if (typeof doc?._id === 'string' && doc._id.startsWith('drafts.')) return true;
  return false;
}

/**
 * Parse the source export into Contentstack content-type schemas.
 *
 * The emitted CT object shape (`otherCmsTitle` / `otherCmsUid` /
 * `contentstackTitle` / `contentstackUid` / `type` / `fieldMapping`) is the
 * contract the api side consumes — keep these exact keys (there is no top-level
 * `uid`/`title`; matches migration-wordpress).
 *
 * ADAPT the read + traversal to your export shape (see extractLocale.ts header).
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const dataFile = findDataFile(filePath); // adapt targetName for your CMS

    // Choose ONE read strategy for your export shape (see extractLocale.ts):
    const documents: any[] = readNdjson(dataFile);
    // const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    // const documents: any[] = Array.isArray(parsed) ? parsed : parsed?.documents ?? [];

    // group documents by their content-type discriminator, skipping system docs
    const grouped: Record<string, any[]> = documents.reduce((acc: any, doc: any) => {
      if (isSystemRecord(doc)) return acc;
      const type = doc?._type ?? doc?.type ?? 'unknown';
      (acc[type] ||= []).push(doc);
      return acc;
    }, {});

    for (const [type, docs] of Object.entries(grouped)) {
      // union of field names across all docs of this type
      const fieldTypes = new Map<string, string>();
      docs.forEach((doc) => {
        Object.entries(doc).forEach(([key, value]) => {
          if (key.startsWith('_')) return; // skip system fields (_id, _type, _rev…)
          if (!fieldTypes.has(key)) {
            fieldTypes.set(key, inferSourceType(value));
          }
        });
      });

      const fieldMapping: Field[] = [...fieldTypes.entries()].map(([name, srcType]) =>
        mapField(name, srcType),
      );

      const contentType = {
        otherCmsTitle: type,
        otherCmsUid: `${affix ? affix + '_' : ''}${type}`,
        contentstackTitle: type,
        contentstackUid: `${affix ? affix + '_' : ''}${type}`,
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

/**
 * Infer a source field/widget type from a serialized value.
 *
 * ⚠️ ADAPT — a JSON export usually carries no schema, so you infer from the data:
 *  - ISO-8601 strings → 'datetime' (otherwise you'd lose date fields to text)
 *  - tagged objects (`{_type: image|reference|slug|...}`) → that type. This part
 *    is CMS-SPECIFIC: Sanity tags objects with `_type`; other CMSs differ.
 *  - array of `{_type:'block'}` (portable text) → 'block'; an array of MEDIA
 *    objects (image/file) → a MULTIPLE file field (NOT a group — else galleries
 *    drop every asset); other object arrays → 'array' (repeatable group).
 * Note: some distinctions collapse without a schema (e.g. short vs long string) —
 * the user refines those in the field-mapping UI, so a sane default is fine.
 */
function inferSourceType(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.find((v) => v && typeof v === 'object');
    if (first && (first as any)._type === 'block') return 'block'; // portable text
    if (first && ((first as any)._type === 'image' || (first as any)._type === 'file'))
      return 'fileMultiple'; // array of media -> multiple file (map to file + multiple)
    if (first) return 'array'; // array of objects -> repeatable group
    return 'string';
  }
  if (value === null) return 'string';
  if (typeof value === 'object') {
    const t = (value as any)._type; // CMS-specific structured-object marker
    if (t === 'image' || t === 'file') return t;
    if (t === 'reference') return 'reference';
    if (t === 'slug') return 'slug';
    if (t === 'geopoint') return 'geopoint';
    return 'object';
  }
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return ISO_DATE.test(value as string) ? 'datetime' : 'string';
    default:
      return 'string';
  }
}

export default extractContentTypes;
