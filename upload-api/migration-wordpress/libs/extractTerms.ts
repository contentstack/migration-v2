import GenerateSchema from 'generate-schema';
import { handleAttributesSchema } from './schemaMapper';
import helper from "../utils/helper";
import config from '../config/index.json';
import path from 'path';

const { contentTypes: contentTypesConfig } = config.modules;
const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

const handleAuthorSchema = async(author : any) => {
  const schema: any = GenerateSchema.json("schema", author);
  const properties = schema?.items?.properties ?? schema?.properties;

  const Authorschema = await handleAttributesSchema(properties, null, 'Author');
  return Authorschema;
}

const extractTerms = async(allTerms: any, type: string) => {
    if(allTerms?.length > 0){
      const terms = {
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
        if(Array.isArray(allTerms)){
          const fields = await handleAuthorSchema(allTerms?.[0]);
          terms?.fieldMapping?.push(...fields.map(field => ({ 
            ...field, 
            isDeleted: false, 
            advanced: { ...field?.advanced, mandatory: field?.advanced?.mandatory ?? false } 
          })));
        }
        else{
          const fields = await handleAuthorSchema(allTerms);
          terms?.fieldMapping?.push(...fields.map(field => ({ 
            ...field, 
            isDeleted: false, 
            advanced: { ...field?.advanced, mandatory: field?.advanced?.mandatory ?? false } 
          })));
        }
        const filePath = path.join(contentTypeFolderPath, `${type}.json`);
        await helper.writeFileAsync(filePath, terms, 4);
        console.log(`Successfully created content type: ${type}.json`);
    }
    
     return; 
    
}

export default extractTerms