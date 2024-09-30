import axios from "axios";
import { readFileSync } from "fs";
import path from 'path';
import { deleteFolderSync } from "../../helper";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes, ExtractConfiguration, reference, ExtractFiles } = require('migration-sitecore');

const createSitecoreMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: object) => {
  try {
    const newPath = path.join(filePath, 'items');
    await ExtractFiles(newPath);
    await ExtractConfiguration(newPath);
    await contentTypes(newPath, affix, config);
    const infoMap = await reference();
    if (infoMap?.contentTypeUids?.length) {
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      for await (const contentType of infoMap?.contentTypeUids ?? []) {
        const fileContent = readFileSync(path?.join?.(infoMap?.path, 'content_types', contentType), 'utf8');
        const jsonfileContent = JSON.parse(fileContent);
        jsonfileContent.type = "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      }
      const fileContent = readFileSync(path?.join(infoMap?.path, 'global_fields', 'globalfields.json'), 'utf8');
      const jsonfileContent = JSON.parse(fileContent);
      for (const key in jsonfileContent) {
        if (jsonfileContent.hasOwnProperty(key)) {
          const element = jsonfileContent[key];
          element.type = "global_field";
          fieldMapping.contentTypes.push(element);
        }
      }
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
    }
  } catch (err: any) {
    console.error("🚀 ~ createSitecoreMapper ~ err:", err?.response?.data ?? err)
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
}


export default createSitecoreMapper;