import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField, { baseField, toUid, ParentCtx } from './schemaMapper';
import { ensureDir, writeJson, findDataFile, readNdjson } from '../utils/helper';

/**
 * Max nested-group levels expanded into child schema rows. Deeper structures
 * fall back to a raw `json` leaf (data preserved). Keep in sync with the api
 * side (sanity.service.ts MAX_GROUP_DEPTH).
 */
const MAX_GROUP_DEPTH = 5;

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
      // union of field names across all docs of this type, keeping EVERY sample
      // value per field (group expansion needs more than the first doc's value)
      const fieldSamples = new Map<string, any[]>();
      docs.forEach((doc) => {
        Object.entries(doc).forEach(([key, value]) => {
          if (key.startsWith('_')) return; // skip system fields (_id, _type, _rev, ...)
          if (!fieldSamples.has(key)) fieldSamples.set(key, []);
          if (value !== null && value !== undefined) fieldSamples.get(key)!.push(value);
        });
      });

      const fieldMapping: Field[] = [];
      for (const [name, samples] of fieldSamples) {
        fieldMapping.push(...emitFieldRows(name, samples, undefined, 0));
      }

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
 * Emit the fieldMapping row(s) for one source field, recursing into groups.
 *
 * Leaves (string/block/image/fileMultiple/...) emit a single row via mapField.
 * `object` / `array`-of-objects emit a GROUP parent row plus one row per child,
 * where every child row's uids carry the dotted path (`parent.child`) — the
 * contract the api's buildSchemaTree uses to build the nested CT schema, and
 * the entry transform uses to find a group's children. Child fields are the
 * UNION across all sample objects/array elements (heterogeneous `_type`
 * elements contribute their keys; `_`-prefixed keys are skipped). Zero-child or
 * depth-limited groups fall back to a raw `json` leaf so no data is dropped.
 */
function emitFieldRows(
  name: string,
  samples: any[],
  parent: ParentCtx | undefined,
  depth: number,
): Field[] {
  // prefer an informative sample (a populated array over an empty one)
  const first = samples.find((s) => !(Array.isArray(s) && s.length === 0)) ?? samples[0];
  const srcType = inferSanityType(first);

  // non-group leaves (incl. block / fileMultiple) keep their existing mapping
  if (srcType !== 'object' && srcType !== 'array') {
    return [mapField(name, srcType, parent)];
  }

  if (depth >= MAX_GROUP_DEPTH) {
    return [baseField(name, srcType, 'json', parent)]; // too deep -> raw json leaf
  }

  // gather child samples: object values directly; array elements flattened
  // across ALL docs and elements (union of heterogeneous shapes)
  const elements =
    srcType === 'array'
      ? samples.flatMap((s) => (Array.isArray(s) ? s : [])).filter((e) => e && typeof e === 'object' && !Array.isArray(e))
      : samples.filter((s) => s && typeof s === 'object' && !Array.isArray(s));

  const childSamples = new Map<string, any[]>();
  for (const el of elements) {
    for (const [k, v] of Object.entries(el)) {
      if (k.startsWith('_')) continue; // _type, _key, ...
      if (!childSamples.has(k)) childSamples.set(k, []);
      if (v !== null && v !== undefined) childSamples.get(k)!.push(v);
    }
  }

  if (!childSamples.size) {
    return [baseField(name, srcType, 'json', parent)]; // empty group -> json leaf
  }

  const parentRow = mapField(name, srcType, parent); // object -> group, array -> group+multiple
  const childCtx: ParentCtx = { uid: parentRow.contentstackFieldUid, label: parentRow.contentstackField };
  const rows: Field[] = [parentRow];
  const seenChildUids = new Set<string>();
  for (const [childName, childValues] of childSamples) {
    const childUid = toUid(childName);
    if (seenChildUids.has(childUid)) {
      console.warn(`[sanity] uid collision under group "${name}": "${childName}" -> "${childUid}" already emitted; first wins`);
      continue;
    }
    seenChildUids.add(childUid);
    rows.push(...emitFieldRows(childName, childValues, childCtx, depth + 1));
  }
  return rows;
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
    if (first && ((first as any)._type === 'image' || (first as any)._type === 'file'))
      return 'fileMultiple'; // array of image/file objects -> multiple file field
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
