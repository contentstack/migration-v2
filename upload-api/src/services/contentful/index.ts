/* eslint-disable @typescript-eslint/no-var-requires */
import axios from 'axios';

import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
import { Config } from '../../models/types';

const { extractContentTypes, createInitialMapper, extractLocale } = require('migration-contentful');

const createContentfulMapper = async (
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: Config
) => {
  console.log('');
  console.log('🔄 [createContentfulMapper] STARTING CONTENTFUL MAPPER CREATION');
  console.log('🔄 [createContentfulMapper] Project ID:', projectId);
  console.log('🔄 [createContentfulMapper] Config:', config);
  
  try {
    const { localPath } = config;
    const cleanLocalPath = localPath?.replace?.(/\/$/, '');
    console.log('🔄 [createContentfulMapper] Calling extractLocale with path:', cleanLocalPath);
    
    const fetchedLocales = await extractLocale(cleanLocalPath);
    
    console.log('🔄 [createContentfulMapper] Received locales from extractLocale:', fetchedLocales);
    console.log('🔄 [createContentfulMapper] First locale (master):', fetchedLocales?.[0]);
    console.log('🔄 [createContentfulMapper] All locales:', fetchedLocales);

    // 🔧 extractLocale already normalizes and puts master locale first
    const normalizedLocales = fetchedLocales || [];
    
    console.log('🔄 [createContentfulMapper] Final locales to save (master is first):', normalizedLocales);

    await extractContentTypes(cleanLocalPath, affix);
    const initialMapper = await createInitialMapper(cleanLocalPath, affix);
    const req = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(initialMapper)
    };
    const { data} = await axios.request(req);
    if (data?.data?.content_mapper?.length) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED
      });
    }

    console.log('🔄 [createContentfulMapper] Sending locales to backend API...');
    console.log('🔄 [createContentfulMapper] API URL:', `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`);
    console.log('🔄 [createContentfulMapper] Payload (master is first):', { locale: normalizedLocales });
    
    const mapperConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: {
        locale: normalizedLocales // Master locale is always first element
      }
    };

    const mapRes = await axios.request(mapperConfig);
    console.log('✅ [createContentfulMapper] Backend API response status:', mapRes?.status);
    
    if (mapRes?.status == 200) {
      logger.info('Legacy CMS', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED
      });
      console.log('✅ [createContentfulMapper] Locales saved successfully to backend!');
    }
  } catch (err: any) {
    console.error('🚀 ~ createContentfulMapper ~ err:', err?.response?.data ?? err);
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR
    });
  }
};

export default createContentfulMapper;
