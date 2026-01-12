
import path from 'path';
import helper from "../utils/helper";
import config from '../config/index.json';

import GenerateSchema from 'generate-schema';
import { handleAttributesSchema } from './schemaMapper';
import { Field } from '../interface/interface';


const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

const handleCategorySchema = async(category : any) => {
  const schema: any = GenerateSchema.json("schema", category);
  //console.info("AUthorschema 123", schema);
  const properties = schema?.items?.properties ?? schema?.properties;
  //console.info("AUthorschema", properties);
  const AUthorschema = await handleAttributesSchema(properties, null, 'Category');
  return AUthorschema;
}
async function extractCategories (categoriesData: any, type: string){
    const category = {
        "status": 1,
        "isUpdated": false,
        "updateAt": "",
        "otherCmsTitle": type,
        "otherCmsUid": type,
        "contentstackTitle": type,
        "contentstackUid": type,
        "type": "content_type",
        "fieldMapping": [] as Field[]
      };
      if(typeof categoriesData === 'object'){
        category.fieldMapping = await handleCategorySchema(categoriesData);
      }else if(Array.isArray(categoriesData)){
        category.fieldMapping = await handleCategorySchema(categoriesData?.[0]);
      }
      const filePath = path.join(contentTypeFolderPath, `${type}.json`);
      await helper.writeFileAsync(filePath, category, 4);
      console.log(`Successfully created unified content type: ${type}.json`);
    
    
     return; 

}

export default extractCategories