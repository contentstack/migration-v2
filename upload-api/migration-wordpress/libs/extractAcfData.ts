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
 * Loads the ACF→Contentstack type mapping.
 * Starts from the bundled default (acf-type-mapping.json) and merges any
 * acf-type-mapping.json found in exportDir on top, so users can override or
 * extend entries without touching source code.
 */
async function loadTypeMapping(exportDir: string): Promise<AcfTypeMapping> {
  const mapping: AcfTypeMapping = { ...(defaultTypeMapping as AcfTypeMapping) };

  if (!exportDir) return mapping;

  try {
    const raw = await fs.promises.readFile(path.join(exportDir, 'acf-type-mapping.json'), 'utf8');
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
 * Reads every *.json file in exportDir (skipping acf-type-mapping.json),
 * filters groups to those that apply to postType and are active,
 * and resolves each field's Contentstack type via the loaded type mapping.
 */
async function acfMapperFromExportFiles(exportDir: string, postType: string): Promise<Record<string, unknown>> {
  const acfMapper: Record<string, unknown> = {};

  if (!exportDir) return acfMapper;

  const typeMapping = await loadTypeMapping(exportDir);

  let files: string[];
  try {
    files = await fs.promises.readdir(exportDir);
  } catch {
    return acfMapper;
  }

  for (const file of files) {
    if (!file.endsWith('.json') || file === 'acf-type-mapping.json') continue;

    let groups: AcfExportGroup[];
    try {
      const raw = await fs.promises.readFile(path.join(exportDir, file), 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      groups = parsed;
    } catch {
      continue;
    }

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
            ...(isMultiple ? { multiple: true } : {})
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
