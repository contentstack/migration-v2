import axios from 'axios';
import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
import { extractContentstackLocales, resolveContentstackExportRoot } from './locales';

const createContentstackMapper = async (
  filePath: string = '',
  projectId: string | string[],
  app_token: string | string[]
) => {
  try {
    const resolvedRoot = resolveContentstackExportRoot(filePath) || filePath;
    if (!resolvedRoot) {
      logger.warn('Contentstack locale extraction skipped: export root not found', { filePath });
      return false;
    }

    const locales = await extractContentstackLocales(resolvedRoot);
    if (!locales?.length) {
      logger.warn('Contentstack locale extraction returned no locales', { resolvedRoot });
      return false;
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
        locale: locales,
        extractPath: resolvedRoot
      }
    };

    const mapRes = await axios.request(mapperConfig);
    if (mapRes?.status === 200) {
      logger.info('Contentstack source locales saved', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED
      });
      return true;
    }

    return false;
  } catch (error: any) {
    logger.error('Contentstack locale extraction failed', {
      message: error?.message,
      response: error?.response?.data
    });
    return false;
  }
};

export default createContentstackMapper;
