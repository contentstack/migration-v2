import { Field, WordPressBlock } from '../interface/interface';
import restrictedUid from '../utils/index';
import GenerateSchema from 'generate-schema';

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
  

async function processInnerBlocks(key: WordPressBlock, parentUid: string | null = null, parentFieldName: string | null = null): Promise<any[]> {
    if (!key?.innerBlocks || !Array.isArray(key.innerBlocks) || key.innerBlocks.length === 0) {
      return [];
    }
    
    // Process inner blocks here - placeholder for actual implementation
    const results: any = [];
    for (const block of key.innerBlocks) {

        const processed = await schemaMapper(block, parentUid, parentFieldName, ''); 
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
                    uid: field,
                    otherCmsField: getFieldName(field),
                    otherCmsType: getFieldName(field),
                    contentstackField: fieldName,
                    contentstackFieldUid: fieldUid,
                    contentstackFieldType: 'single_line_text',
                    backupFieldType: 'single_line_text',
                    backupFieldUid: fieldUid,
                    advanced: {}
                })
                break;
            case 'boolean':
                attributeSchema.push({
                    uid: field,
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
                    uid: field,
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
                    uid: field,
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
            const existingBlock: Field | undefined = schemas.find((schemaItem: Field) => 
                result?.otherCmsField === schemaItem?.otherCmsField && 
                schemaItem?.contentstackFieldType === result?.contentstackFieldType && 
                schemaItem?.contentstackField === result?.contentstackField &&
                result?.contentstackFieldUid?.includes(parentUid)
            );
                item?.contentstackFieldUid?.includes(parentUid) ; 
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
    
    const fieldName = parentFieldName ? `${parentFieldName} > ${getFieldName(key?.attributes?.metadata?.name ?? (key?.name === 'core/missing' ? 'body' : key?.name))}` : getFieldName(key?.attributes?.metadata?.name ?? (key?.name === 'core/missing' ? 'body' : key?.name));
    
    switch (key?.name) {
        case 'core/paragraph':
        case 'core/html':
        case 'core/pullquote':
        case 'core/table':
        case 'core/columns':
        case 'core/missing':
        case 'core/code': {
            const rteUid = parentUid ?
            `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}`
            : getFieldUid(`${key?.name}_${key?.clientIdkey}`, affix);
            return {
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType:getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName ,
                contentstackFieldUid: rteUid,
                contentstackFieldType: 'json',
                backupFieldType: 'json',
                backupFieldUid: rteUid,
                advanced: {}
            }
        }
        break;
        case 'core/image':
        case 'core/audio':
        case 'core/video':
        case 'core/file': {
            const fileUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            
            return {
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: fileUid,
                contentstackFieldType: 'file',
                backupFieldType: 'file',
                backupFieldUid: fileUid,
                advanced: {}
            }
        }
        break;
            
        case 'core/heading':
        case 'core/list-item': {
            const textUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            return {
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: textUid,
                contentstackFieldType: 'single_line_text',
                backupFieldType: 'single_line_text',
                backupFieldUid: textUid,
                advanced: {}
            }
        }
        break;
        case 'core/social-link':
        case 'core/navigation-link': {
           
            const LinkUid = parentUid ? `${parentUid}.${getFieldUid(key?.name, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            return {
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: LinkUid,
                contentstackFieldType: 'link',
                backupFieldType: 'link',
                backupFieldUid: LinkUid,
                advanced: {}
            }
        }
        break;
        case 'core/list':
        case 'core/quote':
        case 'core/cover':
        case 'core/social-links':
        case 'core/details':
        case 'core/group':
        case 'core/navigation': {
            const groupSchema: Field[] = [];
            const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);

            const innerBlocks = await processInnerBlocks(
                key, 
                groupUid ,
                fieldName
            );
            innerBlocks?.length > 0 && groupSchema.push({
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
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
        break;
        case 'core/search': {
            const searchEleUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            const searchEle = await processAttributes(key, searchEleUid,fieldName, affix);
            searchEle.push({
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: searchEleUid,
                contentstackFieldType: 'group',
                backupFieldType: 'group',
                backupFieldUid: searchEleUid,
            });
            return searchEle;
        }
        break;
         
        case 'core/site-logo': {
            const buttonUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            const button = await processAttributes(key, buttonUid, fieldName, affix);
            button.push({
                uid: getFieldUid(key?.name, affix),
                otherCmsField: getFieldName(key?.name),
                otherCmsType: getFieldName(key?.attributes?.metadata?.name ?? key?.name),
                contentstackField: fieldName,
                contentstackFieldUid: buttonUid,
                contentstackFieldType: 'group',
                backupFieldType: 'group',
                backupFieldUid: buttonUid,
            });

            return button;
        }
        break;  
        case 'core/button': {
            const parentName = parentFieldName ? `${parentFieldName}` :  `${getFieldName(key?.attributes?.metadata?.name ?? key?.name)}` ;
            const buttonUid = parentUid ? `${parentUid}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);
            const button = await processAttributes(key, buttonUid, parentName, affix);
            return button;
        }
        break;
        case 'core/buttons': { 
            const groupSchema: Field[] = [];
            const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key?.name}_${key?.clientId}`, affix)}` : getFieldUid(`${key?.name}_${key?.clientId}`, affix);

            const innerBlocks = await processInnerBlocks(
                key, 
                groupUid ,
                fieldName
            );
            innerBlocks?.length > 0 && groupSchema.push({
                uid: getFieldUid(`${key?.name}_${key?.clientId}`, affix),
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
        break;

    }
    return [];
}

export { getFieldName, getFieldUid ,schemaMapper, handleAttributesSchema};