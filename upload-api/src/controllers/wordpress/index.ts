import axios from "axios";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";
import FormData from 'form-data';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractContentTypes, contentTypeMaker, extractLocale } = require('migration-wordpress')



const createWordpressMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[]) => {
  try {
    
    const localeData = await extractLocale(filePath);
    const formData = new FormData();
    await extractContentTypes(affix);
    const contentTypeData = await contentTypeMaker(affix)
    if(contentTypeData){
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      contentTypeData.forEach((contentType: any) => {
        const jsonfileContent = contentType;
        jsonfileContent.type = "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      })
    const jsonBuffer = Buffer.from(JSON.stringify(fieldMapping), 'utf8');
    formData.append('file', jsonBuffer, { filename: 'fieldMapping.json', contentType: 'application/json' });
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: {
          app_token,
          //'Content-Type': 'application/json'
        },
        data: formData
      };
      const {data} = await axios.request(config);
      if (data?.data?.content_mapper?.length) {
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
        logger.info('Legacy CMS', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.LOCALE_SAVED,
        });
      }
    }
  } catch (err: any) {
    console.error("🚀 ~ createWordpressMapper ~ err:", err?.response?.data ?? err)
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
}


export default createWordpressMapper;