import axios from "axios";
import { readFileSync } from "fs";
import path from 'path';
import { deleteFolderSync } from "../../helper";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from "../../constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes, ExtractConfiguration, reference, ExtractFiles, findAndExtractLanguages } = require('migration-sitecore');

const {
  CONTENT_TYPES_DIR_NAME,
  GLOBAL_FIELDS_DIR_NAME,
  GLOBAL_FIELDS_FILE_NAME
} = MIGRATION_DATA_CONFIG;

const createSitecoreMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: object) => {
  try {
    const newPath = path.join(filePath, 'items');
    
    const localeData = await findAndExtractLanguages(path.join(filePath, 'items','master','sitecore','content')); 
    logger.info('Fetched Locales: ', localeData)

    await ExtractFiles(newPath);
    await ExtractConfiguration(newPath);
    await contentTypes(newPath, affix, config);
    const infoMap = await reference();
    if (infoMap?.contentTypeUids?.length) {
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      for await (const contentType of infoMap?.contentTypeUids ?? []) {
        const fileContent = readFileSync(path?.join?.(infoMap?.path, CONTENT_TYPES_DIR_NAME, contentType), 'utf8');
        const jsonfileContent = JSON.parse(fileContent);
        jsonfileContent.type = "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      }
      const fileContent = readFileSync(path?.join(infoMap?.path, GLOBAL_FIELDS_DIR_NAME, GLOBAL_FIELDS_FILE_NAME), 'utf8');
      const jsonfileContent = JSON.parse(fileContent);
      for (const key in jsonfileContent) {
        if (jsonfileContent.hasOwnProperty(key)) {
          const element = jsonfileContent[key];
          element.type = "global_field";
          fieldMapping.contentTypes.push(element);
        }
      }
      // console.log("🚀 ~ createSitecoreMapper ~ fieldMapping:", fieldMapping)
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(fieldMapping),
      };
      const response = await axios.request(config)
      if (response?.data?.content_mapper?.length) {
        deleteFolderSync(infoMap?.path);
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.MAPPER_SAVED,
        });
      }
      
      const mapperConfig = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: {
          locale:Array.from(localeData)
        },
      };

      const mapRes = await axios.request(mapperConfig)
      if(mapRes?.status==200){
        logger.info('Validation success', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.LOCALE_SAVED,
        });   
      }

    }
  } catch (err: any) {
    console.error("🚀 ~ createSitecoreMapper ~ err:", err?.response?.data ?? err, err)
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
}


export default createSitecoreMapper;