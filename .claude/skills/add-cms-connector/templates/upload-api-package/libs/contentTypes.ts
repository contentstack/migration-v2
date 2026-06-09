import fs from 'fs';
import path from 'path';
import config from '../config/index.json';
import { CT, DataConfig, Field } from '../interface/interface';
import mapField from './schemaMapper';
import { ensureDir, writeJson } from '../utils/helper';

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
 * Parse the source export into Contentstack content-type schemas.
 *
 * ADAPT the traversal below to the real export shape:
 *  - find where the array of documents/records lives
 *  - group records by their type (content-type discriminator)
 *  - for each type, build the fieldMapping from the union of its fields
 */
async function extractContentTypes(
  affix: string,
  filePath: string,
  _dataConfig: DataConfig,
): Promise<CT[]> {
  try {
    ensureDir(contentTypeFolderPath);

    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    // TODO: point these at the real structure of the sample export.
    const documents: any[] = Array.isArray(parsed) ? parsed : parsed?.documents ?? [];

    // group documents by their content-type discriminator (e.g. `_type` in Sanity)
    const grouped: Record<string, any[]> = documents.reduce((acc: any, doc: any) => {
      const type = doc?._type ?? doc?.type ?? 'unknown';
      (acc[type] ||= []).push(doc);
      return acc;
    }, {});

    for (const [type, docs] of Object.entries(grouped)) {
      // union of field names across all docs of this type
      const fieldTypes = new Map<string, string>();
      docs.forEach((doc) => {
        Object.entries(doc).forEach(([key, value]) => {
          if (key.startsWith('_')) return; // skip system fields
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

/** Cheap runtime type inference; refine per source CMS conventions. */
function inferSourceType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'string';
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

export default extractContentTypes;
