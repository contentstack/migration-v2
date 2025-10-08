import path from "path";
import { CONSTANTS } from "../../constant";
import { createContentTypeObject, ensureField, findComponentByType, writeJsonFile } from "../../helper";
import { isContainerComponent, parseXFPath } from "../../helper/component.identifier";
import { createFragmentComponent } from "./fragment";
import { IContentTypeMaker } from "./types/createContentTypes.interface";
import { ModularBlocksField } from "./fields/contentstackFields";
import { processContentModels } from "../../helper/fieldMappings.merge";
import { flattenContentTypes } from "../../helper/contentType.flatten";


async function processTemplateItems(itemsOrder: string[], items: any, contentstackComponents: any) {
  const schema = [];
  for (const element of itemsOrder) {
    const item = items?.[element];
    const type = item?.[':type'];
    const isContainerCheck = isContainerComponent(type);
    if (parseXFPath(type)) {
      const keys = item?.localizedFragmentVariationPath?.split('/');
      const keyElement = element?.split('-');
      const segmentData = keys?.filter((segment: string) => keyElement?.includes(segment));
      const referenceField = await createFragmentComponent(segmentData, item, contentstackComponents);
      schema?.push(referenceField);
    } else if (isContainerCheck?.isContainer) {
      const itemsOrder = item?.[':itemsOrder'];
      const items = item?.[':items'];
      const conatinerSchema: any = await processTemplateItems(itemsOrder, items, contentstackComponents);
      if (conatinerSchema?.length) {
        const modularData = new ModularBlocksField({
          uid: element,
          displayName: element,
          blocks: [],
        }).toContentstack();
        for (const object of conatinerSchema) {
          if (object?.contentstackFieldType === 'group' ||
            object?.contentstackFieldType === 'modular_blocks') {
            const block: any = {
              uid: object?.uid,
              otherCmsField: object?.otherCmsField,
              contentstackField: object?.contentstackField,
              contentstackFieldUid: object?.contentstackFieldUid,
              backupFieldUid: object?.backupFieldUid,
              contentstackFieldType: 'modular_blocks_child',
              backupFieldType: 'modular_blocks_child',
              otherCmsType: 'modular_blocks_child',
              schema: object?.contentstackFieldType === 'modular_blocks' ? [object] : object?.schema,
            }
            modularData.blocks?.push(block);
          } else if (object) {
            const block: any = {
              uid: object?.uid,
              otherCmsField: object?.otherCmsField,
              contentstackField: object?.contentstackField,
              contentstackFieldUid: object?.contentstackFieldUid,
              backupFieldUid: object?.backupFieldUid,
              contentstackFieldType: 'modular_blocks_child',
              backupFieldType: 'modular_blocks_child',
              otherCmsType: 'modular_blocks_child',
              schema: [object],
            }
            modularData.blocks?.push(block);
          }
        }
        schema?.push(modularData);
      }
    } else {
      const [, csValue] = findComponentByType(contentstackComponents, type) ?? [];
      if (csValue && typeof csValue === "object" && "type" in csValue) {
        schema?.push(csValue)
      } else {
        console.info("🚀 ~ processTemplateItems ~ type:", type);
      }
    }
  }
  return schema;
}



const contentTypeMaker: IContentTypeMaker = async ({ templateData, affix, contentstackComponents }) => {
  const contentData = [];
  for await (const [key, value] of Object.entries(templateData ?? {})) {
    if (!Array.isArray(value)) return console.warn(`Value for key "${key}" is not an array:`, value);
    for await (const template of value) {
      const itemsOrder = template?.[':items']?.root?.[':itemsOrder'];
      const items = template?.[':items']?.root?.[':items'];
      const Schema = await processTemplateItems(itemsOrder, items, contentstackComponents);
      const contentTypeObject = createContentTypeObject({
        otherCmsTitle: key,
        otherCmsUid: key,
        fieldMapping: Schema,
      });
      contentData?.push(contentTypeObject);
    }
  }
  const contentDataFilePath = path.resolve(CONSTANTS?.CONENT_DATA_FILE);
  const processData = processContentModels(contentData);
  const flattenData = flattenContentTypes(processData);
  flattenData.forEach((schema: any) => {
    ensureField(schema.fieldMapping, {
      uid: 'url',
      otherCmsField: 'url',
      otherCmsType: 'text',
      contentstackField: 'Url',
      contentstackFieldUid: 'url',
      contentstackFieldType: 'url',
      backupFieldType: 'url',
      backupFieldUid: 'url'
    }, 'url');
    ensureField(schema.fieldMapping, {
      uid: 'title',
      otherCmsField: 'title',
      otherCmsType: 'text',
      contentstackField: 'Title',
      contentstackFieldUid: 'title',
      contentstackFieldType: 'text',
      backupFieldType: 'text',
      backupFieldUid: 'title'
    }, 'title');
  });
  await writeJsonFile(flattenData, contentDataFilePath);
  return flattenData ?? [];
}


export default contentTypeMaker;