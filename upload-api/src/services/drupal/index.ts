import axios from 'axios';
import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS } from '../../constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  extractAuthors,
  extractTaxonomy,
  extractVocabulary,
  extractContentTypes,
  contentTypeMaker
} = require('migration-drupal');

const createDrupalMapper = async (
  filePath: string,
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: object
) => {
  try {
    await extractAuthors(config);
    await extractTaxonomy(config);
    await extractVocabulary(config);
    await extractContentTypes(config);
    const contentTypeData = await contentTypeMaker(affix);
    if (contentTypeData) {
      const fieldMapping: any = { contentTypes: [], extractPath: filePath };
      contentTypeData.forEach((contentType: any) => {
        const jsonfileContent = contentType;
        jsonfileContent.type = 'content_type';
        fieldMapping?.contentTypes?.push(jsonfileContent);
      });

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/mapper/createDummyData/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(fieldMapping)
      };
      const response = await axios.request(config);
      if (response?.data?.content_mapper?.length) {
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.MAPPER_SAVED
        });
      }
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
