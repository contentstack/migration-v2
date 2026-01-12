import GenerateSchema from 'generate-schema';
import { handleAttributesSchema } from './schemaMapper';
import helper from "../utils/helper";
import config from '../config/index.json';
import path from 'path';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

const handleAuthorSchema = async(author : any) => {
  const schema: any = GenerateSchema.json("schema", author);
  //console.info("AUthorschema 123", schema);
  const properties = schema?.items?.properties ?? schema?.properties;
  //console.info("AUthorschema", properties);
  const AUthorschema = await handleAttributesSchema(properties, null, 'Author');
  return AUthorschema;
}
const extractAuthor = async(item:any, type: string) => {
  const author = {
    "status": 1,
    "isUpdated": false,
    "updateAt": "",
    "otherCmsTitle": type,
    "otherCmsUid": type,
    "contentstackTitle": type,
    "contentstackUid": type,
    "type": "content_type",
    "fieldMapping":[{
      "isDeleted": false,
      "uid": "title",
      "backupFieldUid": "title",
      "otherCmsField": "title",
      "otherCmsType": "text",
      "contentstackField": "title",
      "contentstackFieldUid": "title",
      "contentstackFieldType": "text",
      "backupFieldType": "text",
      "advanced": {
        "mandatory": true
      }
    },
    {
      "isDeleted": false,
      "uid": "url",
      "otherCmsField": "url",
      "backupFieldUid": "url",
      "otherCmsType": "text",
      "contentstackField": "Url",
      "contentstackFieldUid": "url",
      "contentstackFieldType": "url",
      "backupFieldType": "url",
      "advanced": {
        "mandatory": true
      }
    }]
  };
  if(typeof item === 'object'){
    const fields = await handleAuthorSchema(item);
    author?.fieldMapping?.push(...fields.map(field => ({ 
      ...field, 
      isDeleted: false, 
      advanced: { ...field?.advanced, mandatory: field?.advanced?.mandatory ?? false } 
    })));
  }else if(Array.isArray(item)){
    const fields = await handleAuthorSchema(item?.[0]);
    author?.fieldMapping?.push(...fields.map(field => ({ 
      ...field, 
      isDeleted: false, 
      advanced: { ...field?.advanced, mandatory: field?.advanced?.mandatory ?? false } 
    })));
  }
  const filePath = path.join(contentTypeFolderPath, `${type}.json`);
  await helper.writeFileAsync(filePath, author, 4);
  console.log(`Successfully created unified content type: ${type}.json`);


 return; 
};
export default extractAuthor;