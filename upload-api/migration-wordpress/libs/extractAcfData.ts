import fs from 'fs';
import path from 'path';
import defaultTypeMapping from '../config/acf-type-mapping.json';

interface AcfExportField {
  key: string;
  label: string;
  name: string;
  type: string;
  required?: number;
  multiple?: number;
  [key: string]: any;
}

interface AcfExportGroup {
  key: string;
  title: string;
  fields: AcfExportField[];
  location: Array<Array<{ param: string; operator: string; value: string }>>;
  active?: boolean;
}

interface AcfTypeMappingEntry {
  contentstackFieldType: string;
  otherCmsType: string;
  multiple?: boolean;
}

type AcfTypeMapping = Record<string, AcfTypeMappingEntry>;

/**
 * Resolves the configured ACF export path (acfExportDir) into the set of JSON
 * files to process plus the base directory used for the acf-type-mapping.json
 * override.
 *
 * Accepts either:
 *  - a directory → every *.json inside it (excluding acf-type-mapping.json)
 *  - a single .json file → just that file; baseDir is the file's parent dir
 *
 * Returns absolute file paths so callers never re-join against the base dir.
 */
async function resolveAcfExport(
  exportPath: string
): Promise<{ files: string[]; baseDir: string }> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(exportPath);
  } catch {
    // Path does not exist / not accessible — nothing to process
    return { files: [], baseDir: exportPath };
  }

  if (stat.isFile()) {
    return { files: [exportPath], baseDir: path.dirname(exportPath) };
  }

  if (stat.isDirectory()) {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(exportPath);
    } catch {
      return { files: [], baseDir: exportPath };
    }
    const files = entries
      .filter(entry => entry.endsWith('.json') && entry !== 'acf-type-mapping.json')
      .map(entry => path.join(exportPath, entry));
    return { files, baseDir: exportPath };
  }

  return { files: [], baseDir: exportPath };
}

/**
 * Loads the ACF→Contentstack type mapping.
 * Starts from the bundled default (acf-type-mapping.json) and merges any
 * acf-type-mapping.json found in baseDir on top, so users can override or
 * extend entries without touching source code.
 */
async function loadTypeMapping(baseDir: string): Promise<AcfTypeMapping> {
  const mapping: AcfTypeMapping = { ...(defaultTypeMapping as AcfTypeMapping) };

  if (!baseDir) return mapping;

  try {
    const raw = await fs.promises.readFile(path.join(baseDir, 'acf-type-mapping.json'), 'utf8');
    const custom: AcfTypeMapping = JSON.parse(raw);
    Object.assign(mapping, custom);
  } catch {
    // No custom override — defaults are used as-is
  }

  return mapping;
}

function groupAppliesToPostType(group: AcfExportGroup, postType: string): boolean {
  return group.location.some(ruleSet =>
    ruleSet.some(rule => rule.param === 'post_type' && rule.operator === '==' && rule.value === postType)
  );
}

/**
 * Builds a Contentstack field mapper from ACF JSON export files.
 *
 * `exportPath` may point at either a directory of ACF export files or a single
 * ACF export .json file (see resolveAcfExport). Reads each file (skipping
 * acf-type-mapping.json), filters groups to those that apply to postType, and
 * resolves each field's Contentstack type via the loaded type mapping.
 */
async function acfMapperFromExportFiles(exportPath: string, postType: string): Promise<Record<string, unknown>> {
  const acfMapper: Record<string, unknown> = {};

  if (!exportPath) return acfMapper;

  const { files, baseDir } = await resolveAcfExport(exportPath);
  if (!files.length) return acfMapper;

  const typeMapping = await loadTypeMapping(baseDir);

  for (const filePath of files) {
    let groups: AcfExportGroup[];
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      groups = parsed;
    } catch {
      continue;
    }

    const file = path.basename(filePath);
    console.log(`Processing ACF export file: ${file}`);
    console.info(`Found ${groups.length} groups in ${file}`, groups);


    for (const group of groups) {
      //if (group.active === false) continue;
      if (!groupAppliesToPostType(group, postType)) continue;

      for (const field of group.fields) {
        if (!field.name) continue;

        const typeInfo = typeMapping[field.type] ?? { contentstackFieldType: 'single_line_text', otherCmsType: 'text' };
        // ACF select with multiple:1 stores an array — treat as multiple
        const isMultiple = typeInfo.multiple || (field.type === 'select' && field.multiple === 1);

        const options =
          field.choices && typeof field?.choices === 'object' && !Array.isArray(field?.choices)
            ? Object.entries(field?.choices).map(([key, value]) => ({ key, value }))
            : undefined;

        acfMapper[field.name] = {
          uid: field.name,
          otherCmsField: field.name,
          otherCmsType: typeInfo.otherCmsType,
          contentstackField: field.label,
          contentstackFieldUid: field.name,
          contentstackFieldType: typeInfo.contentstackFieldType,
          backupFieldType: typeInfo.contentstackFieldType,
          backupFieldUid: field.name,
          advanced: {
            defaultValue: field.default_value,
            placeholder: field.placeholder,
            mandatory: field.required === 1,
            ...(isMultiple ? { multiple: true } : {}),
            ...(options ? { options } : {})
          },
          isDeleted: false
        };
      }
    }
  }

  return acfMapper;
}

async function handleAcfData(postAcfData: any[]): Promise<Record<string, unknown>> {
    if (!Array.isArray(postAcfData)) {
        return {};
    }
    const postWithAcf = postAcfData[0]?.acf;
  
    return (postWithAcf as Record<string, unknown>) ?? {};
}

/**
 * @param parentPrefix — When mapping items inside an array (or nested under one), prefix for
 *   Contentstack UIDs / backup UIDs; contentstackField becomes "parentPrefix key" (space‑separated).
 */
async function acfMpapperGenerator(acfData: any, parentPrefix?: string): Promise<Record<string, unknown>> {
    const acfMapper: any = {};
    if (!acfData || typeof acfData !== 'object' || Array.isArray(acfData)) {
        return acfMapper;
    }

    for (const key of Object.keys(acfData)) {
        const value = acfData[key];
        const type = (Array.isArray(value) ? 'array' : typeof value) as string;

        const compositeUid = parentPrefix ? `${parentPrefix}.${key}` : key;
        const contentstackField = parentPrefix ? `${parentPrefix} > ${key}` : key;

        switch (type) {
            case 'string':
            case 'text':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'single_line_text',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'single_line_text',
                    backupFieldType: 'single_line_text',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'number':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'number',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'number',
                    backupFieldType: 'number',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'boolean':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'boolean',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'boolean',
                    backupFieldType: 'boolean',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'array': {
                const childPrefix = parentPrefix ? `${parentPrefix}.${key}` : key;
                const firstItem =
                    Array.isArray(value) && value.length > 0 ? value[0] : null;
              
                const nestedMapper =
                    firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)
                        ? await acfMpapperGenerator(firstItem, childPrefix)
                        : {};

                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'array',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'group',
                    backupFieldType: 'group',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false,
                        multiple: true
                    },
                    isDeleted: false
                };
                for (const nestedKey of Object.keys(nestedMapper)) {
                    acfMapper[`${key}.${nestedKey}`] = nestedMapper[nestedKey];
                }
                break;
            }
            case 'object':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'object',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'object',
                    backupFieldType: 'object',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'date':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'date',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'date',
                    backupFieldType: 'date',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'time':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'time',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'time',
                    backupFieldType: 'time',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'datetime':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'datetime',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'datetime',
                    backupFieldType: 'datetime',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            case 'email':
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'email',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'email',
                    backupFieldType: 'email',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
            default:
                acfMapper[key] = {
                    uid: compositeUid,
                    otherCmsField: key,
                    otherCmsType: 'single_line_text',
                    contentstackField,
                    contentstackFieldUid: compositeUid,
                    contentstackFieldType: 'single_line_text',
                    backupFieldType: 'single_line_text',
                    backupFieldUid: compositeUid,
                    advanced: {
                        mandatory: false
                    },
                    isDeleted: false
                };
                break;
        }
    }
    return acfMapper;
}

export { handleAcfData, acfMpapperGenerator, acfMapperFromExportFiles };
