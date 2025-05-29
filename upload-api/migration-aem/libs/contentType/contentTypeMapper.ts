import { IContentTypeMappers, ICreateMapperSchema } from "./types/contentTypeMapper.interface";


const createMapperSchema: ICreateMapperSchema = ({ itemSchema, affix }) => {
}
const contentTypeMappers: IContentTypeMappers = async ({ templateData, affix }) => {
  for (const key of templateData?.[':itemsOrder'] ?? []) {
    const item = templateData?.[":items"]?.[key];
    console.info("🚀 ~ constcontentTypeMappers:IContentTypeMappers= ~ item:", item?.[":items"], item?.[':itemsOrder'])
  }


}


export default contentTypeMappers;