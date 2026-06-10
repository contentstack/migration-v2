import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField, { baseField, toUid, ParentCtx } from './schemaMapper';
import { ensureDir, writeJson, findDataFile, readNdjson } from '../utils/helper';

/**
 * Max nested-group levels expanded into child schema rows. Deeper structures
 * fall back to a raw `json` leaf (data preserved). Keep in sync with the api
 * side (<cms>.service.ts MAX_GROUP_DEPTH).
 */
const MAX_GROUP_DEPTH = 5;

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
      // union of field names across all docs of this type, keeping EVERY sample
      // value per field (group expansion needs more than the first doc's value)
      const fieldSamples = new Map<string, any[]>();
      docs.forEach((doc) => {
        Object.entries(doc).forEach(([key, value]) => {
          if (key.startsWith('_')) return; // skip system fields (_id, _type, _rev…)
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
 * Leaves emit a single row via mapField. Nested objects / arrays-of-objects emit
 * a GROUP parent row plus one row per child, where every child row's uids carry
 * the dotted path (`parent.child`) — the contract the api's buildSchemaTree uses
 * to build the nested CT schema, and the entry transform uses to find a group's
 * children (see reference/entry-creation.md). Child fields are the UNION across
 * all sample objects/array elements (heterogeneous element shapes contribute
 * their keys). Zero-child or depth-limited groups fall back to a raw `json` leaf
 * so no data is dropped.
 *
 * ⚠️ ADAPT: which inferred types count as "group-shaped" ('object'/'array' here)
 * and which keys are internal (the `_`-prefix skip) are CMS-specific.
 */
function emitFieldRows(
  name: string,
  samples: any[],
  parent: ParentCtx | undefined,
  depth: number,
): Field[] {
  // prefer an informative sample (a populated array over an empty one)
  const first = samples.find((s) => !(Array.isArray(s) && s.length === 0)) ?? samples[0];
  const srcType = inferSourceType(first);

  // non-group leaves (incl. rich text / media arrays) keep their existing mapping
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

  // Heterogeneous arrays (>= 2 distinct element types) -> MODULAR BLOCKS, one
  // block per element type — unless already under a blocks ancestor (Contentstack
  // forbids blocks inside blocks; those fall through to group+multiple).
  // ⚠️ ADAPT the discriminator: `_type` is the Sanity convention; use your
  // source's per-element type key, and exclude types your inferSourceType
  // already routes elsewhere (rich text / media).
  if (srcType === 'array' && !parent?.inBlocks) {
    const discriminated = elements.filter(
      (e) => typeof e._type === 'string' && !['block', 'image', 'file'].includes(e._type),
    );
    const distinctTypes = [...new Set(discriminated.map((e) => e._type as string))];
    if (distinctTypes.length >= 2) {
      return emitModularBlockRows(name, srcType, discriminated, distinctTypes, parent, depth);
    }
  }

  const childSamples = collectChildSamples(elements);

  if (!childSamples.size) {
    return [baseField(name, srcType, 'json', parent)]; // empty group -> json leaf
  }

  const parentRow = mapField(name, srcType, parent); // object -> group, array -> group+multiple
  const childCtx: ParentCtx = {
    uid: parentRow.contentstackFieldUid,
    label: parentRow.contentstackField,
    inBlocks: parent?.inBlocks, // propagate the blocks-ancestor flag through groups
  };
  const rows: Field[] = [parentRow];
  const seenChildUids = new Set<string>();
  for (const [childName, childValues] of childSamples) {
    const childUid = toUid(childName);
    if (seenChildUids.has(childUid)) {
      console.warn(`uid collision under group "${name}": "${childName}" -> "${childUid}" already emitted; first wins`);
      continue;
    }
    seenChildUids.add(childUid);
    rows.push(...emitFieldRows(childName, childValues, childCtx, depth + 1));
  }
  return rows;
}

/** Union of child field samples across a set of object elements (skips internal keys). */
function collectChildSamples(elements: any[]): Map<string, any[]> {
  const childSamples = new Map<string, any[]>();
  for (const el of elements) {
    for (const [k, v] of Object.entries(el)) {
      if (k.startsWith('_')) continue; // internal keys — adapt to your CMS
      if (!childSamples.has(k)) childSamples.set(k, []);
      if (v !== null && v !== undefined) childSamples.get(k)!.push(v);
    }
  }
  return childSamples;
}

/**
 * Emit modular-blocks rows for a heterogeneous array: parent row
 * (`modular_blocks`), one block row per distinct element type
 * (`modular_blocks_child`, otherCmsField = the RAW source type — the entry-time
 * join key), and per-block field rows recursed from THAT type's elements only.
 * Blocks with no mappable fields are skipped; if all are empty, fall back to a
 * raw json leaf. Block field recursion runs with inBlocks=true so deeper
 * heterogeneous arrays become groups, never nested blocks (invalid in CS).
 */
function emitModularBlockRows(
  name: string,
  srcType: string,
  elements: any[],
  distinctTypes: string[],
  parent: ParentCtx | undefined,
  depth: number,
): Field[] {
  const parentRow = baseField(name, srcType, 'modular_blocks', parent);
  const rows: Field[] = [parentRow];
  const seenBlockUids = new Set<string>();
  let emittedBlocks = 0;

  for (const rawType of distinctTypes) {
    const typeElements = elements.filter((e) => e._type === rawType); // ADAPT discriminator
    const childSamples = collectChildSamples(typeElements);
    if (!childSamples.size) {
      console.warn(`block "${rawType}" under "${name}" has no mappable fields; skipped`);
      continue;
    }

    const blockRow = baseField(rawType, 'block', 'modular_blocks_child', {
      uid: parentRow.contentstackFieldUid,
      label: parentRow.contentstackField,
    });
    // deterministic suffix on uid collisions — entry routing matches by RAW
    // otherCmsField, so suffixed blocks still receive their data
    let blockUid = blockRow.contentstackFieldUid;
    for (let n = 2; seenBlockUids.has(blockUid); n += 1) {
      blockUid = `${blockRow.contentstackFieldUid}_${n}`;
      console.warn(`block uid collision under "${name}": "${rawType}" -> "${blockUid}"`);
    }
    seenBlockUids.add(blockUid);
    blockRow.uid = blockRow.contentstackFieldUid = blockRow.backupFieldUid = blockUid;
    rows.push(blockRow);
    emittedBlocks += 1;

    const blockCtx: ParentCtx = {
      uid: blockRow.contentstackFieldUid,
      label: blockRow.contentstackField,
      inBlocks: true,
    };
    const seenChildUids = new Set<string>();
    for (const [childName, childValues] of childSamples) {
      const childUid = toUid(childName);
      if (seenChildUids.has(childUid)) {
        console.warn(`uid collision under block "${rawType}": "${childName}" already emitted; first wins`);
        continue;
      }
      seenChildUids.add(childUid);
      // a blocks field consumes TWO uid segments (parent + block)
      rows.push(...emitFieldRows(childName, childValues, blockCtx, depth + 2));
    }
  }

  if (!emittedBlocks) {
    return [baseField(name, srcType, 'json', parent)]; // all blocks empty -> json leaf
  }
  return rows;
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
