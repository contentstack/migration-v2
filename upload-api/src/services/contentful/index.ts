/* eslint-disable @typescript-eslint/no-var-requires */
import axios from 'axios';

import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
import { Config } from '../../models/types';

const { extractContentTypes, createInitialMapper } = require('migration-contentful');

const createContentfulMapper = async (
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: Config
) => {
  try {
    const { localPath } = config;
    await extractContentTypes(localPath, affix);
    const initialMapper = await createInitialMapper();
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
    const response = await axios.request(req)
    if (response?.data?.content_mapper?.length) {
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
