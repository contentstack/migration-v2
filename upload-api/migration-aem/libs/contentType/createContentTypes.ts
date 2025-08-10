import path from "path";
import { CONSTANTS } from "../../constant";
import { createContentTypeObject, findComponentByType, writeJsonFile } from "../../helper";
import { isContainerComponent, isExperienceFragment, parseXFPath } from "../../helper/component.identifier";
import { createFragmentComponent } from "./fragment";
import { IContentTypeMaker } from "./types/createContentTypes.interface";


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
        const obj: any = {}
        obj[element] = conatinerSchema
        schema?.push(obj);
      }
    } else {
      const [, csValue] = findComponentByType(contentstackComponents, type) ?? [];
      if (csValue && typeof csValue === "object" && "type" in csValue) {
        schema?.push(csValue)
      } else {
        console.info("🚀 ~ processTemplateItems ~ type: undefined", type);
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
      if (isExperienceFragment?.(template)?.isXF) {
        // console.info("🚀 ~ contentTypeMaker ~ template:", template)
      } else {
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

  }
  const contentDataFilePath = path.resolve(CONSTANTS?.CONENT_DATA_FILE);
  // const mergedContentData = mergeContentTypeFieldMappings(contentData);
  await writeJsonFile(contentData, contentDataFilePath);
}


export default contentTypeMaker;