import axios from 'axios';
import path from 'path';
import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from '../../constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { extractContentTypes, extractLocale } from 'migration-datocms';
import { deleteFolderSync } from '../../helper';

const createDatocmsMapper = async (
  filePath: string = '',
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: any
) => {
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
        locale: Array.from(localeData)
      },
    };

    const mapRes = await axios.request(mapperConfig);
    if (mapRes?.status === 200) {
      logger.info('Legacy CMS', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED,
      });
    }

    const contentTypeData: any = await extractContentTypes(affix as string, filePath, config);

    if (contentTypeData) {
      // NOTE: unlike wordpress/aem, do NOT force `type = 'content_type'` here —
      // extractContentTypes already tags DatoCMS's 21 modular_block:true types
      // as `type: 'global_field'` (Sitecore-style) and the 11 entry-level types
      // as `type: 'content_type'`. Overwriting it here would collapse every
      // block back into a plain content type and defeat the whole point of the
      // migration (PRD FR-4 / TRD "no silent block-flattening").
      const fieldMapping: any = { contentTypes: contentTypeData, extractPath: filePath };

      const mapperCallConfig = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(fieldMapping),
      };
      const { data } = await axios.request(mapperCallConfig);
      if (data?.data?.content_mapper?.length) {
        deleteFolderSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA));
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.MAPPER_SAVED
        });
      }
    }
  } catch (err: any) {
    console.error('🚀 ~ createDatocmsMapper ~ err:', err?.response?.data ?? err);
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
};

export default createDatocmsMapper;
