/* eslint-disable @typescript-eslint/no-var-requires */
import axios from 'axios';
import fs from 'fs';
import path from 'path';

import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
import { Config } from '../../models/types';

const {
  extractContentTypes,
  createInitialMapper,
  extractLocale,
  extractTaxonomy,
  extractAssets
} = require('migration-contentful');

const createContentfulMapper = async (
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: Config
) => {
  try {
    const { localPath } = config;
    const cleanLocalPath = localPath?.replace?.(/\/$/, '');
    const fetchedLocales: [] = await extractLocale(cleanLocalPath);

    const mapperConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: {
        locale: Array.from(fetchedLocales)
      }
    };

    const mapRes = await axios.request(mapperConfig);
    if (mapRes?.status == 200) {
      logger.info('Legacy CMS', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED
      });
    }
    
    await extractContentTypes(cleanLocalPath, affix);
    const initialMapper = await createInitialMapper(cleanLocalPath, affix);
    // Must run after createInitialMapper: that step deletes contentfulMigrationData (contentfulSchema) and would remove taxonomy files written earlier.
    await extractTaxonomy(cleanLocalPath);

    // Asset mapping rows for the AssetMapper UI (same flow as AEM/Sitecore).
    const assetMapping = await extractAssets(cleanLocalPath);

    let taxonomies: any[] = [];
    try {
      const taxonomyPath = path.join(
        process.cwd(),
        'contentfulMigrationData',
        'taxonomySchema',
        'taxonomySchema.json'
      );
      if (fs.existsSync(taxonomyPath)) {
        const taxonomyData = await fs.promises.readFile(taxonomyPath, 'utf8');
        taxonomies = JSON.parse(taxonomyData);
        logger.info(`Loaded ${taxonomies.length} Contentful taxonomies to send to API`);
      }
    } catch (error: any) {
      logger.warn(`Could not read Contentful taxonomies: ${error.message}`);
    }
    const req = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
      headers: {
        app_token,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        ...initialMapper,
        taxonomies,
        assetMapping
      })
    };
    const { data} = await axios.request(req);
    if (data?.data?.content_mapper?.length) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED
      });
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
