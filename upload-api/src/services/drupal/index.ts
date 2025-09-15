/* eslint-disable @typescript-eslint/no-var-requires */
import axios from 'axios';

import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
import { Config } from '../../models/types';

const { createInitialMapper, extractLocale, extractTaxonomy } = require('migration-drupal');

const createDrupalMapper = async (
  config: Config,
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[]
) => {
  try {
    console.log('hey we are in createDrupalMapper');

    // this is to fetch the locales from the drupal database
    // const fetchedLocales:[]= await extractLocale(config)

    const localeData = await extractLocale(config);
    console.log('🔍 DEBUG: Locale data from extractLocale:', localeData);

    // Extract taxonomy vocabularies and save to drupalMigrationData
    console.log('🏷️ Extracting taxonomy vocabularies...');
    const taxonomyData = await extractTaxonomy(config.mysql);
    console.log(`✅ Extracted ${taxonomyData.length} taxonomy vocabularies`);

    const initialMapper = await createInitialMapper(config, affix);

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

    const { data } = await axios.request(req);
    console.log('🚀 ~ createDrupalMapper ~ data:', data?.data);
    if (data?.data?.content_mapper?.length) {
      console.log('Inside the if block of createDrupalMapper');

      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED
      });
    } else {
      console.log('Inside the else block of createDrupalMapper');
    }

    const localeArray = Array.from(localeData);
    console.log('🔍 DEBUG: Sending locales to API:', localeArray);
    
    const mapperConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: {
        locale: localeArray
      }
    };

    const mapRes = await axios.request(mapperConfig);
    if (mapRes?.status == 200) {
      logger.info('Legacy CMS', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED
      });
    }
  } catch (err: any) {
    console.error('🚀 ~ createDrupalMapper ~ err:', err?.response?.data ?? err);
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR
    });
  }
};

export default createDrupalMapper;
