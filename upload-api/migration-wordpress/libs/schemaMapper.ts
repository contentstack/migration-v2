import { Field, WordPressBlock } from '../interface/interface';
import restrictedUid from '../utils/index';
import GenerateSchema from 'generate-schema';

const MEDIA_BLOCK_NAMES = ['core/image', 'core/video', 'core/audio', 'core/file'];

function resolveBlockName(key: any): string {
  if (key?.attributes?.metadata?.name) return key.attributes.metadata.name;
  if (key?.name === 'core/missing') {
    return key?.attributes?.originalName || 'body';
  }
  if (MEDIA_BLOCK_NAMES.includes(key?.name)) return 'media';
  return key?.name;
}

const getFieldName = (key: string   ) => {
    if(key?.includes('/')){
        return key?.split('/')?.[1];
    }
    else if(key?.includes('wp:')){
        const parts = key.split('_');  // e.g. ['wp', 'post', 'title']
        
        //let displayName : string = '';
        const displayName = parts
        .filter(item => !item.includes('wp:'))
        .join(' ');
        return displayName;
    }
    return key;
}

const getFieldUid = (key: string, affix: string) => {
    if (!key) return key;
  
    let uid = key.includes("/") ?
      key.split("/")[1]
      : key.startsWith("wp:") ?
        key.replace("wp:", "")
        : key;
  
    uid = uid?.toLowerCase().replace(/-/g, "_");
    const isPresent = restrictedUid?.includes(uid);
  
    return isPresent ? `${affix}_${uid}` : uid;
  };

/** First 4 chars of clientId (hyphens stripped) — short UIDs; tiny collision risk on huge pages. */
export function clientIdForUid(clientId: string | undefined): string {
    if (!clientId) return '0';
    const compact = clientId?.replace?.(/-/g, '')?.toLowerCase();
    return compact?.slice?.(0, 4) || '0';
}
  

async function processInnerBlocks(key: WordPressBlock, parentUid: string | null = null, parentFieldName: string | null = null, affix: string | null = null): Promise<any[]> {
    if (!key?.innerBlocks || !Array.isArray(key.innerBlocks) || key.innerBlocks.length === 0) {
      return [];
    }
    
    // Process inner blocks here - placeholder for actual implementation
    const results: any = [];
    for (const block of key.innerBlocks) {

        const processed = await schemaMapper(block, parentUid, parentFieldName, affix || ' '); 
        const flattenedProcessed = Array.isArray(processed) ? processed : [processed];
        
        
        flattenedProcessed.forEach((item) => {
            if (item) { // Only process non-null/undefined items
                const existingBlock = results?.find((result:Field) => 
                    result?.otherCmsField === item?.otherCmsField && 
                    result?.contentstackFieldType === item?.contentstackFieldType && 
                    result?.contentstackField === item?.contentstackField &&
                    parentUid && result?.contentstackFieldUid?.includes(parentUid) && 
                    item?.contentstackFieldUid?.includes(parentUid)) ; 
               
                if (existingBlock && existingBlock !== 'undefined') {
                    existingBlock.advanced = {
                      ...existingBlock?.advanced,
                      multiple: true
                    };
                  } else {
                    results?.push?.(item);
                  }
            }
        });
    }
    
    return results;
}
async function handleAttributesSchema(schema : any, parentUid: string | null = null, parentName:string ,affix: string | null = null){
    
    const attributeSchema: Field[] = [];
    for (const [field, config] of Object.entries(schema)) {
        const excludeKeys = ['id'];
        const type = (config as { type?: string })?.type;
        const fieldUid = parentUid ? `${parentUid}.${getFieldUid(field, affix || '')}` : getFieldUid(field, affix || '');
        const fieldName = parentUid ? `${parentName} > ${getFieldName(field)}` : getFieldName(field);
        
        if (type && !excludeKeys?.includes(getFieldName(field))) {
           
            switch(type) {
                case 'string':
                    attributeSchema?.push?.({
                    uid: fieldUid,
                    otherCmsField: getFieldName(field),
                    otherCmsType: getFieldName(field),
                    contentstackField: fieldName,
                    contentstackFieldUid: fieldUid,
                    contentstackFieldType: 'single_line_text',
                    backupFieldType: 'single_line_text',
                    backupFieldUid: fieldUid,
                    advanced: {}
                });
                break;
            case 'boolean':
                attributeSchema.push({
                    uid: fieldUid,
                    otherCmsField: getFieldName(field),
                    otherCmsType: getFieldName(field),
                    contentstackField: fieldName,
                    contentstackFieldUid: fieldUid,
                    contentstackFieldType: 'boolean',
                    backupFieldType: 'boolean',
                    backupFieldUid: fieldUid,
                    advanced: {}
                    });
                break;
            case 'number':
                attributeSchema.push({
                    uid: fieldUid,
                    otherCmsField: getFieldName(field),
                    otherCmsType: getFieldName(field),
                    contentstackField: fieldName,
                    contentstackFieldUid: fieldUid,
                    contentstackFieldType: 'number',
                    backupFieldType: 'number',
                    backupFieldUid: fieldUid,
                    advanced: {}
                });
                break;
            default:
                attributeSchema.push({
                    uid: fieldUid,
                    otherCmsField: getFieldName(field),
                    otherCmsType: getFieldName(field),
                    contentstackField: fieldName,
                    contentstackFieldUid: fieldUid,
                    contentstackFieldType: 'single_line_text',
                    backupFieldType: 'single_line_text',
                    backupFieldUid: fieldUid,
                    advanced: {}
                });
                break;
        }
      }
    }
    return attributeSchema;
}

async function processAttributes(key: WordPressBlock, parentUid: string | null = null, parentName:string ,affix: string | null = null){ 
    const schema:any = GenerateSchema.json("schema", key?.attributes);
    const attributeSchema = await handleAttributesSchema(schema?.properties,parentUid, parentName, affix);
    return attributeSchema;

 }

async function schemaMapper (key: WordPressBlock | WordPressBlock[], parentUid: string | null = null, parentFieldName: string | null = null, affix: string): Promise<any> {
    if (Array.isArray(key)) {
        const schemas: Field[] = [];
        for (const item of key) {
            const result = await schemaMapper(item, parentUid, parentFieldName, affix);

            const compareField = Array.isArray(result) ? result[0] : result;
            const existingBlock: Field | undefined = compareField ? schemas.find((schemaItem: Field) => 
                compareField?.otherCmsField === schemaItem?.otherCmsField && 
                schemaItem?.contentstackFieldType === compareField?.contentstackFieldType && 
                schemaItem?.contentstackField === compareField?.contentstackField &&
                parentUid && compareField?.contentstackFieldUid?.includes(parentUid) &&
                parentUid && schemaItem?.contentstackFieldUid?.includes(parentUid)
            ) : undefined;

            if (existingBlock && typeof existingBlock === 'object' && 'advanced' in existingBlock) {
                existingBlock.advanced = {
                  ...(existingBlock.advanced as object),
                  multiple: true
                };
            } else {
                if (Array.isArray(result)) {
                    schemas.push(...result);
                } else {
                    schemas.push(result);
                }
              }
        }
        return schemas;
    }
    
    const fieldName = parentFieldName ? `${parentFieldName} > ${getFieldName(resolveBlockName(key))}` : getFieldName(resolveBlockName(key));
    
    switch (key?.name) {
        case 'core/paragraph':
        case 'core/html':
        case 'core/pullquote':
        case 'core/table':
        case 'core/columns':
        case 'core/verse':
        case 'core/code': {
            const rteUid = parentUid ?
            `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`
            : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            return {
                uid: rteUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType:getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName ,
                contentstackFieldUid: rteUid,
                contentstackFieldType: 'json',
                backupFieldType: 'json',
                backupFieldUid: rteUid,
                advanced: {}
            };
        }
        case 'core/missing':
            const rteUid = parentUid ?
                `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`
                : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            if(key?.attributes?.originalName === 'jetpack/markdown'){
                return {
                    uid: rteUid,
                    otherCmsField: getFieldName(resolveBlockName(key)),
                    otherCmsType: getFieldName(resolveBlockName(key)),
                    contentstackField: fieldName ,
                    contentstackFieldUid: rteUid,
                    contentstackFieldType: 'markdown',
                    backupFieldType: 'markdown',
                    backupFieldUid: rteUid,
                    advanced: {}
                };
            }
            else if (key?.attributes?.originalName === 'jetpack/story') {
                const storyGroupUid = rteUid;
                const storyFieldBase = fieldName;
                const groupSchema: Field[] = [
                    {
                        uid: storyGroupUid,
                        otherCmsField: getFieldName(resolveBlockName(key)),
                        otherCmsType: getFieldName(resolveBlockName(key)),
                        contentstackField: storyFieldBase,
                        contentstackFieldUid: storyGroupUid,
                        contentstackFieldType: 'group',
                        backupFieldType: 'group',
                        backupFieldUid: storyGroupUid,
                        advanced: { multiple: true },
                    },
                ];
                const storyChildren: Array<{
                    key: string;
                    contentstackFieldType: 'single_line_text' | 'file';
                }> = [
                    { key: 'title', contentstackFieldType: 'single_line_text' },
                    { key: 'alt', contentstackFieldType: 'single_line_text' },
                    { key: 'caption', contentstackFieldType: 'single_line_text' },
                    { key: 'image', contentstackFieldType: 'file' },
                ];
                for (const { key: childKey, contentstackFieldType: csType } of storyChildren) {
                    const childUid = `${storyGroupUid}.${getFieldUid(childKey, affix)}`;
                    groupSchema.push({
                        uid: childUid,
                        otherCmsField: childKey,
                        otherCmsType: childKey,
                        contentstackField: `${storyFieldBase} > ${getFieldName(childKey)}`,
                        contentstackFieldUid: childUid,
                        contentstackFieldType: csType,
                        backupFieldType: csType,
                        backupFieldUid: childUid,
                        advanced: {},
                    });
                }
                return groupSchema;
            }
            else{
                return {
                    uid: rteUid,
                    otherCmsField: getFieldName(resolveBlockName(key)),
                    otherCmsType:getFieldName( resolveBlockName(key) ?? resolveBlockName(key)),
                    contentstackField: fieldName ,
                    contentstackFieldUid: rteUid,
                    contentstackFieldType: 'json',
                    backupFieldType: 'json',
                    backupFieldUid: rteUid,
                    advanced: {}
                };
        }
        case 'core/image':
        case 'core/audio':
        case 'core/video':
        case 'core/file': {
            const fileUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            
            return {
                uid: fileUid,
                otherCmsField: 'media',
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: 'media',
                contentstackFieldUid: fileUid,
                contentstackFieldType: 'file',
                backupFieldType: 'file',
                backupFieldUid: fileUid,
                advanced: {}
            };
        }

        case 'core/heading':
        case 'core/accordion-heading':
        case 'core/list-item': {
            const textUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            return {
                uid: textUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: textUid,
                contentstackFieldType: 'single_line_text',
                backupFieldType: 'single_line_text',
                backupFieldUid: textUid,
                advanced: {}
            };
        }

        case 'core/social-link':
        case 'core/navigation-link': {
           
            const LinkUid = parentUid ? `${parentUid}.${getFieldUid(key?.name, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            return {
                uid: LinkUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: LinkUid,
                contentstackFieldType: 'link',
                backupFieldType: 'link',
                backupFieldUid: LinkUid,
                advanced: {}
            };
        }
        
        case 'core/group': {
            const inner = key?.innerBlocks;
            if (!inner?.length) {
                break;
            }

            // Single inner block: skip wrapper group uid; inner fields use parentFieldName only
            // (no "… > group" segment in labels).
            if (inner.length === 1) {
                const unwrapped = await processInnerBlocks(
                    { ...key, innerBlocks: [inner[0]] },
                    parentUid,
                    parentFieldName,
                    affix
                );
                if (!unwrapped?.length) {
                    break;
                }
                const flat: Field[] = [];
                unwrapped.forEach((schemaObj) => {
                    if (schemaObj) {
                        if (Array.isArray(schemaObj)) {
                            flat.push(...schemaObj);
                        } else {
                            flat.push(schemaObj);
                        }
                    }
                });
                return flat;
            }

            const groupSchema: Field[] = [];
            const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);

            const innerBlocks = await processInnerBlocks(
                key,
                groupUid,
                fieldName,
                affix
            );
            innerBlocks?.length > 0 && groupSchema.push({
                uid: groupUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: groupUid,
                contentstackFieldType: 'group',
                backupFieldType: 'group',
                backupFieldUid: groupUid,
                advanced: {}
            });

            if (innerBlocks?.length > 0) {
                innerBlocks?.forEach((schemaObj) => {
                    if (schemaObj) {
                        if (Array.isArray(schemaObj)) {
                            groupSchema.push(...schemaObj);
                        } else {
                            groupSchema.push(schemaObj);
                        }
                    }
                });

                return groupSchema;
            }
            break;
        }
                
            
         
        case 'core/list':
        case 'core/quote':
        case 'core/social-links':
        case 'core/details':
        case 'core/accordion-item':
        case 'core/accordion-panel':
        case 'core/navigation': {
            const groupSchema: Field[] = [];
            const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);

            const innerBlocks = await processInnerBlocks(
                key, 
                groupUid ,
                fieldName,
                affix
            );
            innerBlocks?.length > 0 && groupSchema.push({
                uid: groupUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: groupUid,
                contentstackFieldType: 'group',
                backupFieldType: 'group',
                backupFieldUid: groupUid,
                advanced: {}
            });
           
            if(innerBlocks?.length > 0 ){
                innerBlocks?.forEach(schemaObj => {
                    if (schemaObj) {
                        if (Array.isArray(schemaObj)) {
                            groupSchema.push(...schemaObj);
                        } else {
                            groupSchema.push(schemaObj);
                        }
                    }
                }); 
               
                return groupSchema;   

            }
            break;
            
        }

        case 'core/cover': {
            const coverSchema: Field[] = []
            if(key?.attributes?.url){
                coverSchema.push({
                uid: `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`,
                otherCmsField: 'media',
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: 'media',
                contentstackFieldUid: `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`,
                contentstackFieldType: 'file',
                backupFieldType: 'file',
                backupFieldUid: `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`,
                advanced: {}
                });
            }
        
            const innerBlocks = await processInnerBlocks(
                key,
                `${parentUid}` ,
                fieldName,
                affix
            );

            innerBlocks?.forEach(schemaObj => {
                if (schemaObj) {
                if (Array.isArray(schemaObj)) {
                    coverSchema.push(...schemaObj);
                } else {
                    coverSchema.push(schemaObj);
                }
                }
            });
            return coverSchema;
        }
          
        
        case 'core/search': {
            const searchEleUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            const searchEle = await processAttributes(key, searchEleUid,fieldName, affix);
            const groupSchema: Field[] = [];
            searchEle?.length > 0 && groupSchema?.push({
                uid: searchEleUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: searchEleUid,
                contentstackFieldType: 'group',
                backupFieldType: 'group',
                backupFieldUid: searchEleUid,
            });
            searchEle?.length > 0 && searchEle?.forEach(schemaObj => {
                if (schemaObj) {
                    if (Array.isArray(schemaObj)) {
                        groupSchema?.push?.(...schemaObj);
                    } else {
                        groupSchema?.push?.({...schemaObj});
                    }
                }
            });
            return groupSchema;
        }
        
           
        case 'core/button': {
            const fieldName = parentFieldName ? `${parentFieldName} > ${getFieldName(key?.attributes?.metadata?.name ?? key?.name)}` :  `${getFieldName(key?.attributes?.metadata?.name ?? key?.name)}` ;
            const buttonUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);

            return { 
                uid: buttonUid,
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: buttonUid,
                contentstackFieldType: 'link',
                backupFieldType: 'link',
                backupFieldUid: buttonUid,

            };
            
        }
        
        case 'core/buttons': { 
            const groupSchema: Field[] = [];
            const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);

            const innerBlocks = await processInnerBlocks(
                key, 
                groupUid ,
                fieldName,
                affix
            );
            if (innerBlocks?.length === 1) {
                const items = Array.isArray(innerBlocks[0]) ? innerBlocks[0] : [innerBlocks[0]];
                items?.forEach((item: Field) => {
                    
                    item.uid = `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`;
                    item.otherCmsField = getFieldName(resolveBlockName(key));
                    item.otherCmsType = getFieldName(resolveBlockName(key));
                    item.contentstackField = `${parentFieldName} > ${getFieldName(resolveBlockName(key))}`;
                    item.contentstackFieldUid = `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`;
                    item.backupFieldUid = `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}`;
                });
                return items;
            }

            if (innerBlocks?.length > 1) {
                groupSchema.push({
                    uid: groupUid,
                    otherCmsField: getFieldName(key?.name),
                    otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                    contentstackField: fieldName,
                    contentstackFieldUid: groupUid,
                    contentstackFieldType: 'group',
                    backupFieldType: 'group',
                    backupFieldUid: groupUid,
                    advanced: {}
                });

                innerBlocks.forEach(schemaObj => {
                    if (schemaObj) {
                        if (Array.isArray(schemaObj)) {
                            groupSchema.push(...schemaObj);
                        } else {
                            groupSchema.push(schemaObj);
                        }
                    }
                }); 
            
                return groupSchema;
            }
           
        }

        case 'core/media-text': {
            const mediaTextSchema: Field[] = [];
            const mediaTextUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix)}` : getFieldUid(`${key?.name}_${clientIdForUid(key?.clientId)}`, affix);
            const innerBlocks =
                key?.innerBlocks && key?.innerBlocks?.length > 0
                    ? await processInnerBlocks(key, parentUid, parentFieldName, affix)
                    : [];
            const mediaId = key?.attributes?.mediaId;
            const hasMediaAttr =
                mediaId != null && mediaId !== '' && Number(mediaId) > 0;

            if (!hasMediaAttr && innerBlocks?.length === 0) {
                return [];
            }

            if (hasMediaAttr) {
                const mediaFileUid = `${mediaTextUid}.${getFieldUid('media', affix)}`;
                const mediatypeUid = `${mediaTextUid}.${getFieldUid('mediatype', affix)}`;
                mediaTextSchema.push(
                    {
                        uid: mediaFileUid,
                        otherCmsField: 'media',
                        otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                        contentstackField: `${parentFieldName} > media`,
                        contentstackFieldUid: mediaTextUid,
                        contentstackFieldType: 'file',
                        backupFieldType: 'file',
                        backupFieldUid: mediaTextUid,
                        advanced: {},
                    },
                    {
                        uid: mediatypeUid,
                        otherCmsField: 'mediatype',
                        otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                        contentstackField: `${parentFieldName} > mediatype`,
                        contentstackFieldUid: mediaTextUid,
                        contentstackFieldType: 'single_line_text',
                        backupFieldType: 'single_line_text',
                        backupFieldUid: mediaTextUid,
                        advanced: {},
                    }
                );
            }
            innerBlocks?.forEach((schemaObj) => {
                if (schemaObj) {
                    if (Array.isArray(schemaObj)) {
                        mediaTextSchema.push(...schemaObj);
                    } else {
                        mediaTextSchema.push(schemaObj);
                    }
                }
            });
            return mediaTextSchema;
        }

    }
    return [];
}

export { getFieldName, getFieldUid, schemaMapper, handleAttributesSchema };