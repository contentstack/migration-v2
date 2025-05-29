import { IContentTypeMappers, ICreateMapperSchema } from "./types/contentTypeMapper.interface";


const createMapperSchema: ICreateMapperSchema = ({ itemSchema, affix }) => {
}
const contentTypeMappers: IContentTypeMappers = async ({ templateData, affix }) => {
  // The ':itemsOrder' key is from AEM template structure and not a secret
  for (const key of templateData?.[':itemsOrder'] ?? []) {
    // The ':items' key is from AEM template structure and not a secret
    const item = templateData?.[":items"]?.[key];
    console.info("🚀 ~ constcontentTypeMappers:IContentTypeMappers= ~ item:", item?.[":items"], item?.[':itemsOrder'])
  }


}


export default contentTypeMappers;