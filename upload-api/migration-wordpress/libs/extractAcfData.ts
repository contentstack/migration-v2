async function handleAcfData(postAcfData: any[]): Promise<Record<string, unknown>> {
    if (!Array.isArray(postAcfData)) {
        return {};
    }
    return postAcfData.reduce((acc: Record<string, unknown>, post: any) => {
        const acf = post?.acf;
        if (acf && typeof acf === 'object' && !Array.isArray(acf)) {
            return { ...acc, ...acf };
        }
        return acc;
    }, {});
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
                        mandatory: false
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

export { handleAcfData, acfMpapperGenerator };
