import axios from "axios";
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from "../../constants";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { extractContentTypes, extractLocale, extractEntries, extractAssets } from 'migration-wordpress';
import { deleteFolderSync } from "../../helper";
import path from "path";



const createWordpressMapper = async (filePath: string = "", projectId: string | string[], app_token: string | string[], affix: string | string[], config: any) => {
  try {
    const localeData = await extractLocale(filePath);

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

    let contentTypeData : any = await extractContentTypes(affix as string, filePath, config);
    //const contentTypeData = await contentTypeMaker(affix, filePath)

    // Populate per-content-type `entryMapping` from the WXR items. Without this the backend
    // content_mapper writes no entry_mapper rows, which leaves the delta-migration Step 4
    // (Map Entry) empty on restart.
    if (Array.isArray(contentTypeData) && contentTypeData?.length > 0) {
      contentTypeData = await extractEntries(filePath, contentTypeData);
    }

    if(contentTypeData){
      const assetMapping = await extractAssets(filePath);
      const fieldMapping: any = { contentTypes: [], extractPath: filePath, assetMapping };
      // Forward the authored content-model folder (index.json → project) so the API's Article/course/…
      // drop-in reads models from it. Only sent when configured; otherwise the API keeps its default.
      if (config?.contentModelDir) fieldMapping.contentModelDir = config.contentModelDir;
      contentTypeData.forEach((contentType: any) => {
        const jsonfileContent = contentType;
        // Preserve an explicit type (e.g. 'global_field' for the SEO global field); only default
        // to 'content_type' when the extractor didn't set one.
        jsonfileContent.type = jsonfileContent.type || "content_type";
        fieldMapping?.contentTypes?.push(jsonfileContent);
      })

      const mapperRequest = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(fieldMapping),
      };
      const {data} = await axios.request(mapperRequest);
      if (data?.data?.content_mapper?.length) {
        //deleteFolderSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA));
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.MAPPER_SAVED
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