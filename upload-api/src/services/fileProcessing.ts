/* eslint-disable @typescript-eslint/no-var-requires, operator-linebreak */

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
      if (isSaved?.isSaved) {
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL
        });
        return {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
          file_details: config,
          file: isSaved?.filePath
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
  } else if (fileExt === 'folder') {
    if (await validator({ data: zipBuffer, type: cmsType, extension: fileExt })) {
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
  } else if (fileExt === 'sql') {
    try {
      // Validate SQL connection using our Drupal validator
      // Also validate assets configuration if provided
      const validationResult = await validator({
        data: config.mysql,
        type: cmsType,
        extension: fileExt,
        assetsConfig: config.assetsConfig // Pass assetsConfig for validation
      });

      // Handle both old boolean format and new object format
      const isValidConnection =
        typeof validationResult === 'boolean' ? validationResult : validationResult.success;
      const errorMessage =
        typeof validationResult === 'object' && validationResult.error
          ? validationResult.error
          : 'Failed to validate database connection or required tables are missing';

      if (isValidConnection) {
        logger.info('Database validation success:', {
          status: HTTP_CODES?.OK,
          message: 'File validated successfully'
        });
        const successResponse = {
          status: HTTP_CODES?.OK,
          message: 'File validated successfully',
          file_details: config
        };
        return successResponse;
      } else {
        logger.warn('Database validation failed:', {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: errorMessage
        });
        const validationErrorResponse = {
          status: HTTP_CODES?.UNAUTHORIZED,
          message: errorMessage, // Pass the specific error message
          file_details: config
        };
        return validationErrorResponse;
      }
    } catch (error) {
      logger.error('Database validation error:', error);
      const errorResponse = {
        status: HTTP_CODES?.SERVER_ERROR,
        message: 'Database validation failed with error',
        file_details: config
      };
      return errorResponse;
    }
  } else {
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
