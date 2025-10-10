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
    // this is to fetch the locales from the drupal database
    // const fetchedLocales:[]= await extractLocale(config)

    const localeData = await extractLocale(config);

    // Extract taxonomy vocabularies and save to drupalMigrationData
    await extractTaxonomy(config.mysql);

    const initialMapper = await createInitialMapper(config, affix);

    // Include assetsConfig and mySQLDetails with the mapper data
    const mapperPayload = {
      ...initialMapper,
      assetsConfig: config.assetsConfig,
      mySQLDetails: config.mysql
    };

    const req = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(mapperPayload)
    };

    const { data } = await axios.request(req);
    if (data?.data?.content_mapper?.length) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED
      });
    }

    const localeArray = Array.from(localeData);

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
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR
    });
  }
};

export default createDrupalMapper;
