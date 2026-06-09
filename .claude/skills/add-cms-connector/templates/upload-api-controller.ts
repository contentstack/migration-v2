// upload-api/src/controllers/<cms>/index.ts
import axios from 'axios';
import path from 'path';
import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from '../../constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { extractContentTypes, extractLocale } from 'migration-<cms>';
import { deleteFolderSync } from '../../helper';

const create<Cms>Mapper = async (
  filePath = '',
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: any,
) => {
  try {
    // 1) locales -> backend
    const localeData = await extractLocale(filePath);
    const localeRes = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
      headers: { app_token, 'Content-Type': 'application/json' },
      data: { locale: Array.from(localeData) },
    });
    if (localeRes?.status === 200) {
      logger.info('Legacy CMS', { status: HTTP_CODES?.OK, message: HTTP_TEXTS?.LOCALE_SAVED });
    }

    // 2) content types / field mapping -> backend
    const contentTypeData: any = await extractContentTypes(affix as string, filePath, config);
    if (contentTypeData) {
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      contentTypeData.forEach((contentType: any) => {
        contentType.type = 'content_type';
        fieldMapping.contentTypes.push(contentType);
      });

      const { data } = await axios.request({
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: { app_token, 'Content-Type': 'application/json' },
        data: JSON.stringify(fieldMapping),
      });

      if (data?.data?.content_mapper?.length) {
        deleteFolderSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA));
        logger.info('Validation success:', { status: HTTP_CODES?.OK, message: HTTP_TEXTS?.MAPPER_SAVED });
      }
    }
  } catch (err: any) {
    console.error('🚀 ~ create<Cms>Mapper ~ err:', err?.response?.data ?? err);
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
};

export default create<Cms>Mapper;
