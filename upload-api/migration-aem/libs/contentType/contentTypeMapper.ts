import { IContentTypeMappers, IcontentTypeProcessor, IContentTypeSchemaBuilder } from "./types/contentTypeMapper.interface";

const contentTypeSchemaBuilder: IContentTypeSchemaBuilder = async ({ }) => {

}


const contentTypeProcessor: IcontentTypeProcessor = async ({ itemSchema, affix }) => {
  const fieldTypes: string[] | undefined = itemSchema?.[':itemsOrder'];
  for await (const field of fieldTypes ?? []) {
    const item = itemSchema?.[":items"]?.[field]
    console.info("🚀 ~ field:", item?.[":type"])
  }
}

const contentTypeMappers: IContentTypeMappers = async ({ templateData, affix }) => {
  // The ':itemsOrder' key is from AEM template structure and not a secret
  for (const key of templateData?.[':itemsOrder'] ?? []) {
    // The ':items' key is from AEM template structure and not a secret
    const item = templateData?.[":items"]?.[key];
    await contentTypeProcessor({ itemSchema: item, affix })
  }


}


export default contentTypeMappers;