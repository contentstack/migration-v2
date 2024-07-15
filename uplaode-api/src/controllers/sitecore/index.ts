import axios from "axios";
import { readFileSync } from "fs";
import { deleteFolderSync } from "../../helper";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes, ExtractConfiguration, reference, ExtractFiles } = require('migration-sitecore');

/**
 * Creates a Sitecore mapper by performing various operations such as extracting files, extracting configuration,
 * retrieving content types, and creating dummy data for a given project ID.
 *
 * @param filePath - The file path where the items are located.
 * @param projectId - The ID of the project.
 * @param app_token - The application token.
 * @returns A Promise that resolves when the Sitecore mapper is created successfully.
 * @throws If any error occurs during the process.
 */
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
        fieldMapping?.contentTypes?.push(
          JSON.parse(readFileSync(`${infoMap?.path}/content_types/${contentType}`, 'utf8')),
        );
      }

      for await (const globalField of infoMap?.globalFieldUids ?? []) {
        fieldMapping?.globalFields?.push(
          JSON.parse(readFileSync(`${infoMap?.path}/global_fields/${globalField}`, 'utf8')),
        );
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