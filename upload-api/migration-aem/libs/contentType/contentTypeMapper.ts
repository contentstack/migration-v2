import LoggerHandler from "../../componentMaker/componentHandler";
import ComponentTracker from "../../componentMaker/componentTracker";
import { extractComponentPath } from "../../helper";
import { IContentTypeMappers, IcontentTypeProcessor } from "./types/contentTypeMapper.interface";





const contentTypeProcessor: IcontentTypeProcessor = async ({ itemSchema, affix, tracker }) => {
  const fieldTypes: string[] | undefined = itemSchema?.[':itemsOrder'];
  for await (const field of fieldTypes ?? []) {
    const item = itemSchema?.[":items"]?.[field];
    const type = extractComponentPath(item?.[":type"]) ?? null;
    await contentTypeProcessor({ itemSchema: item, affix, tracker });
    type && tracker.pushComponent({ component: type, props: item ?? {} })
  }
}

const contentTypeMappers: IContentTypeMappers = async ({ templateData, affix }) => {
  const tracker = new ComponentTracker([
    new LoggerHandler(),
  ]);
  // The ':itemsOrder' key is from AEM template structure and not a secret
  for (const key of templateData?.[':itemsOrder'] ?? []) {
    // The ':items' key is from AEM template structure and not a secret
    const item = templateData?.[":items"]?.[key]
    await contentTypeProcessor({ itemSchema: item, affix, tracker })
  }
  return tracker;
}


export default contentTypeMappers;