import { parseXFPath } from "../../helper/fragments.identifier";
import { createFragmentComponent } from "./fragment";
import { IContentTypeMaker } from "./types/createContentTypes.interface";




const contentTypeMaker: IContentTypeMaker = async ({ templateData, affix, contentstackComponents }) => {
  for await (const [key, value] of Object.entries(templateData ?? {})) {
    if (!Array.isArray(value)) return console.warn(`Value for key "${key}" is not an array:`, value);
    for await (const template of value) {
      const itemsOrder = template?.[':items']?.root?.[':itemsOrder'];
      const items = template?.[':items']?.root?.[':items'];
      for (const element of itemsOrder) {
        // console.info("🚀 ~ contentTypeMaker ~ element:", element)
        const item = items?.[element];
        // console.info("🚀 ~ contentTypeMaker ~ item:", item)
        if (parseXFPath(item?.[':type'])) {
          const keys = item?.localizedFragmentVariationPath?.split('/');
          const keyElement = element?.split('-');
          const segmentData = keys?.filter((segment: string) => keyElement?.includes(segment));
          const referenceField = await createFragmentComponent(segmentData, item, contentstackComponents)
          // console.info("🚀 ~ contentTypeMaker ~ referenceField:", referenceField)
        }
      }
    }
  }

}


export default contentTypeMaker;