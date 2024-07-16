import axios from "axios";
import { readFileSync } from "fs";
import { deleteFolderSync } from "../../helper";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes, ExtractConfiguration, reference, ExtractFiles } = require('migration-sitecore');

const createSitecoreMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[]) => {
  try {
    const path = `${filePath}/items`;
    await ExtractFiles(path);
    await ExtractConfiguration(path);
    await contentTypes(path);
    const infoMap = await reference();
    if (infoMap?.contentTypeUids?.length) {
      const fieldMapping: any = { contentTypes: [] };
      for await (const contentType of infoMap?.contentTypeUids ?? []) {
        const fileContent = readFileSync(`${infoMap?.path}/content_types/${contentType}`, 'utf8');
        const jsonfileContent = JSON.parse(fileContent);
        jsonfileContent.type = "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      }

      for await (const contentType of infoMap?.globalFieldUids ?? []) {
        const fileContent = readFileSync(`${infoMap?.path}/global_fields/${contentType}`, 'utf8');
        const jsonfileContent = JSON.parse(fileContent);
        jsonfileContent.type = "global_field";
        fieldMapping?.contentTypes?.push(jsonfileContent);
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