import { HTTP_TEXTS, HTTP_CODES } from '../constants';
import { parseXmlToJson, saveJson, saveZip } from '../helper';
import JSZip from 'jszip';
import validator from '../validators';
import config from '../config/index';
import logger from '../utils/logger.js';


const handleFileProcessing = async (fileExt: string, zipBuffer: any, cmsType: string, name :string) => {
  if (fileExt === 'zip') {
    const zip = new JSZip();
      await zip.loadAsync(zipBuffer);
    if (await validator({ data: zip, type: cmsType, extension: fileExt })) {    
      const isSaved = await saveZip(zip, name);
      if (isSaved) {
        logger.info('Validation success:', {
          status: HTTP_CODES?.OK,
          message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
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
        message: HTTP_TEXTS?.VALIDATION_ERROR,
      });
      return {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR,
        file_details: config
      };
    }
  } else if (fileExt === 'xml') {
    if (await validator({ data: zipBuffer, type: cmsType, extension: fileExt }) ) {
      const parsedJson = await parseXmlToJson(zipBuffer);
      const isSaved = await saveJson(parsedJson,"data.json");
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
  } else {
    // if file is not zip
    // Convert the buffer to a string assuming it's UTF-8 encoded
    const jsonString = Buffer?.from?.(zipBuffer)?.toString?.('utf8');
    if (await validator({ data: jsonString, type: cmsType, extension: fileExt })) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
      });
      return {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.VALIDATION_SUCCESSFULL,
        file_details: config
      };
    } else {
      logger.warn('Validation error:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.VALIDATION_ERROR,
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
