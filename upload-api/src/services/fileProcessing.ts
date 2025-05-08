import { HTTP_TEXTS, HTTP_CODES } from '../constants';
import { parseXmlToJson, saveJson, saveZip, getDbConnection } from '../helper';
import JSZip from 'jszip';
import validator from '../validators';
import config from '../config/index';
import logger from '../utils/logger.js';
import * as Cheerio from 'cheerio';

const handleFileProcessing = async (
  fileExt: string,
  zipBuffer: any,
  cmsType: string,
  name: string
) => {
  if (fileExt === 'zip') {
    const zip = new JSZip();
    await zip.loadAsync(zipBuffer);
    if (await validator({ data: zip, type: cmsType, extension: fileExt })) {
      const isSaved = await saveZip(zip, name);
      if (isSaved) {
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL
        });
        return {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
          file_details: config
        };
      }
    } else {
      logger.warn('Validation error:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR
      });
      return {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR,
        file_details: config
      };
    }
  } else if (fileExt === 'xml') {
    if (await validator({ data: zipBuffer, type: cmsType, extension: fileExt })) {
      const $ = Cheerio.load(zipBuffer, { xmlMode: true });
      const fixedXml = $.xml();
      const parsedJson = await parseXmlToJson(fixedXml);
      const isSaved = await saveJson(parsedJson, `${name}.json`);
      if (isSaved) {
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL
        });
        return {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
          file_details: config
        };
      } else {
        logger.warn('Validation error:', {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: HTTP_TEXTS?.VALIDATION_ERROR
        });
        return {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: HTTP_TEXTS?.VALIDATION_ERROR,
          file_details: config
        };
      }
    }
  } else if (fileExt === 'sql') {
    console.log('SQL file processing');
    try {
      // Get database connection
      const dbConnection = await getDbConnection(config.mysql);

      if (dbConnection) {
        logger.info('Database connection success:', {
          status: HTTP_CODES?.OK,
          message: 'Successfully connected to database'
        });
        return {
          status: HTTP_CODES?.OK,
          message: 'Successfully connected to database',
          file_details: config
        };
      } else {
        logger.warn('Database connection error:', {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: 'Failed to connect to database'
        });
        return {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: 'Failed to connect to database',
          file_details: config
        };
      }
    } catch (error) {
      logger.error('Database connection error:', error);
      return {
        status: HTTP_CODES?.SERVER_ERROR,
        message: 'Failed to connect to database',
        file_details: config
      };
    }
  } else {
    console.log('File is not zip');

    // if file is not zip
    // Convert the buffer to a string assuming it's UTF-8 encoded
    const jsonString = Buffer?.from?.(zipBuffer)?.toString?.('utf8');
    if (await validator({ data: jsonString, type: cmsType, extension: fileExt })) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL
      });
      return {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
        file_details: config
      };
    } else {
      logger.warn('Validation error:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR
      });
      return {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR,
        file_details: config
      };
    }
  }
};

export default handleFileProcessing;
