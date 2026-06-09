import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField from './schemaMapper';
import { ensureDir, writeJson, findDataFile, readNdjson } from '../utils/helper';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

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
 * Parse the Sanity NDJSON export into Contentstack content-type schemas.
 *
 * - documents live one-per-line in `data.ndjson`
 * - each document's content type is its `_type`
 * - Sanity's own system documents (`_type` starting with `sanity.`) are skipped
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const dataFile = findDataFile(filePath);
    const documents = readNdjson(dataFile);

    // group documents by their `_type`, skipping Sanity system docs and drafts
    const grouped: Record<string, any[]> = documents.reduce((acc: any, doc: any) => {
      const type = doc?._type;
      if (!type || type.startsWith('sanity.')) return acc;
      if (typeof doc?._id === 'string' && doc._id.startsWith('drafts.')) return acc;
      (acc[type] ||= []).push(doc);
      return acc;
    }, {});

    for (const [type, docs] of Object.entries(grouped)) {
      // union of field names across all docs of this type
      const fieldTypes = new Map<string, string>();
      docs.forEach((doc) => {
        Object.entries(doc).forEach(([key, value]) => {
          if (key.startsWith('_')) return; // skip system fields (_id, _type, _rev, ...)
          if (!fieldTypes.has(key)) {
            fieldTypes.set(key, inferSanityType(value));
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
 * Infer a Sanity field/widget type from a serialized value.
 *
 * Sanity tags objects with `_type` (image, reference, slug, block, ...). Arrays
 * of `{_type: 'block'}` are portable text; other object arrays are repeatable
 * groups. ISO-8601 strings are treated as datetimes.
 */
function inferSanityType(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.find((v) => v && typeof v === 'object');
    if (first && (first as any)._type === 'block') return 'block';
    if (first) return 'array'; // array of objects -> repeatable group
    return 'string';
  }
  if (value === null) return 'string';
  if (typeof value === 'object') {
    const t = (value as any)._type;
    if (t === 'image' || t === 'file') return t;
    if (t === 'reference') return 'reference';
    if (t === 'slug') return 'slug';
    if (t === 'geopoint') return 'geopoint';
    if (Array.isArray((value as any))) return 'array';
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
