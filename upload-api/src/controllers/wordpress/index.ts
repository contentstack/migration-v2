import axios from "axios";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractContentTypes, contentTypeMaker } = require('migration-wordpress')

const createWordpressMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: object) => {
  try {
    await extractContentTypes(affix);
    const contentTypeData = await contentTypeMaker(affix)
    if(contentTypeData){
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      contentTypeData.forEach((contentType: any) => {
        const jsonfileContent = contentType;
        jsonfileContent.type = "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      })
    
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
      console.log(response); 
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