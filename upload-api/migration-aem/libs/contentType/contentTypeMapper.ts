import { extractComponentPath } from "../../helper";
import { IContentTypeMappers, IcontentTypeProcessor, IContentTypeSchemaBuilder } from "./types/contentTypeMapper.interface";



const contentTypeSchemaBuilder: IContentTypeSchemaBuilder = async ({ type }) => {
  switch (type) {

  }
}


const contentTypeProcessor: IcontentTypeProcessor = async ({ itemSchema, affix }) => {
  const fieldTypes: string[] | undefined = itemSchema?.[':itemsOrder'];
  console.info("=================================>")
  for await (const field of fieldTypes ?? []) {
    const item = itemSchema?.[":items"]?.[field];
    const type = extractComponentPath(item?.[":type"]);
    console.info("🚀 ~ forawait ~ item:", type);
    await contentTypeProcessor({ itemSchema: item, affix });
    // const fieldItemsOrder = item?.[":itemsOrder"];
    // console.info("🚀 ~ field:", item?.[":type"], fieldItemsOrder);
  }

}

const contentTypeMappers: IContentTypeMappers = async ({ templateData, affix }) => {
  // The ':itemsOrder' key is from AEM template structure and not a secret
  for (const key of templateData?.[':itemsOrder'] ?? []) {
    // The ':items' key is from AEM template structure and not a secret
    const item = templateData?.[":items"]?.[key]
    await contentTypeProcessor({ itemSchema: item, affix })
  }


}


export default contentTypeMappers;