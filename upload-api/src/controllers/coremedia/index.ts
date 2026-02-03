import axios, { AxiosResponse, AxiosError } from 'axios';
import http from 'http';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { deleteFolderSync } from '../../helper';
import logger from '../../utils/logger';
import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from '../../constants';

// Import from migration-coremedia module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentTypes: ExtractContentTypes, extractLocales } = require('migration-coremedia');

const { CONTENT_TYPES_DIR_NAME, GLOBAL_FIELDS_DIR_NAME, GLOBAL_FIELDS_FILE_NAME } =
  MIGRATION_DATA_CONFIG;

interface RequestParams {
  payload: any;
  projectId: string | string[];
  app_token: string | string[];
  endpoint?: string;
}

/**
 * Send locale data to the backend API
 */
const createLocaleSource = async ({
  app_token,
  localeData,
  projectId
}: {
  app_token: string | string[];
  localeData: Set<string> | string[];
  projectId: string | string[];
}) => {
  const processedLocales = Array.isArray(localeData) ? localeData : Array.from(localeData ?? []);

  const mapperConfig = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${process.env.NODE_BACKEND_API}/v2/migration/localeMapper/${projectId}`,
    headers: {
      app_token,
      'Content-Type': 'application/json'
    },
    data: {
      locale: processedLocales
    }
  };

  try {
    const mapRes = await axios.request(mapperConfig);

    if (mapRes?.status === 200) {
      logger.info('CoreMedia Locales', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED
      });
      console.log('✅ Locales saved successfully:', processedLocales);
    } else {
      logger.warn('CoreMedia locale error:', {
        status: mapRes?.status,
        message: HTTP_TEXTS?.LOCALE_FAILED
      });
    }
  } catch (error: any) {
    logger.warn('CoreMedia locale error:', {
      status: error?.response?.status || HTTP_CODES?.UNAUTHORIZED,
      message: error?.response?.data?.message || HTTP_TEXTS?.LOCALE_FAILED
    });
  }
};

/**
 * Send content type data to the backend API for mapping
 */
const sendRequestWithRetry = async <T = any>(params: RequestParams): Promise<AxiosResponse<T>> => {
  const { payload, projectId, app_token, endpoint = 'mapper/createDummyData' } = params;
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/${endpoint}/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: payload,
        timeout: 240000, // 4-minute timeout
        httpAgent: new http.Agent({
          keepAlive: true,
          maxSockets: 1
        })
      };

      return await axios.request<T>(config);
    } catch (error) {
      const axiosError = error as AxiosError;
      retries++;
      const delay = 2000 * retries; // Progressive backoff: 2s, 4s, 6s

      logger.warn(
        `API request failed (attempt ${retries}/${maxRetries}): ${axiosError.code || axiosError.message}`,
        {
          status: axiosError.response?.status || 'NETWORK_ERROR'
        }
      );

      if (retries >= maxRetries) {
        throw axiosError;
      }

      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This line is technically unreachable, but TypeScript requires a return
  throw new Error('Maximum retries reached');
};

/**
 * CoreMedia Migration Controller
 * 
 * Features:
 * - Extracts locales from CoreMedia export
 * - Extracts content types from CoreMedia ZIP export
 * - Transforms them to Contentstack schema format
 * - Sends to backend API for field mapping
 */
const createCoremediaMapper = async (
  filePath: string,
  projectId: string | string[],
  app_token: string | string[],
  affix: string | string[],
  config: { localPath?: string } & Record<string, any>
) => {
  try {
    // Get original ZIP path from config (not the extracted folder path)
    const originalZipPath = config?.localPath || filePath;
    
    console.log('🚀 Starting CoreMedia migration...');
    console.log('📁 Extracted folder path:', filePath);
    console.log('📦 Original ZIP path:', originalZipPath);

    // Step 1: Extract locales from the extracted folder
    console.log('🌍 Extracting locales...');
    const localeData = extractLocales(filePath);
    await createLocaleSource({ app_token, projectId, localeData });

    // Step 2: Set the original ZIP path for the content type extractor
    // extractContentTypes expects a ZIP file, not a directory
    process.env.localPath = originalZipPath;

    // Step 3: Initialize and run content type extraction
    const extractor = new ExtractContentTypes();
    await extractor.start();
    console.log('✅ Content types extracted successfully');

    // Step 4: Read the generated schema
    const migrationDataPath = path.join(process.cwd(), 'MigrationData');
    const schemaFilePath = path.join(migrationDataPath, CONTENT_TYPES_DIR_NAME, 'schema.json');

    if (!existsSync(schemaFilePath)) {
      console.error('❌ Schema file not found at:', schemaFilePath);
      logger.warn('CoreMedia extraction failed:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: 'No schema file generated'
      });
      return false;
    }

    const schemaContent = readFileSync(schemaFilePath, 'utf8');
    const contentTypesData = JSON.parse(schemaContent);
    console.log(`📊 Found ${contentTypesData?.length || 0} content types`);

    if (!contentTypesData || contentTypesData.length === 0) {
      logger.warn('CoreMedia extraction warning:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: 'No content types found'
      });
      return false;
    }

    // Step 5: Prepare payload for the API
    const fieldMapping: { contentTypes: any[]; extractPath: string } = {
      contentTypes: [],
      extractPath: filePath
    };

    // Add content types
    for (const contentType of contentTypesData) {
      if (contentType) {
        contentType.type = 'content_type';
        fieldMapping.contentTypes.push(contentType);
      }
    }

    // Add global fields if they exist
    const globalFieldsPath = path.join(
      migrationDataPath,
      GLOBAL_FIELDS_DIR_NAME,
      GLOBAL_FIELDS_FILE_NAME
    );
    
    if (existsSync(globalFieldsPath)) {
      const globalFieldsContent = readFileSync(globalFieldsPath, 'utf8');
      const globalFields = JSON.parse(globalFieldsContent);

      for (const key in globalFields) {
        if (Object.prototype.hasOwnProperty.call(globalFields, key)) {
          const element = globalFields[key];
          element.type = 'global_field';
          fieldMapping.contentTypes.push(element);
        }
      }
      console.log('✅ Global fields added');
    }

    // Step 6: Send to backend API
    console.log('📤 Sending to backend API...');
    const { data } = await sendRequestWithRetry({
      payload: fieldMapping,
      projectId,
      app_token
    });

    if (data?.data?.content_mapper?.length) {
      // Clean up migration data
      deleteFolderSync(migrationDataPath);

      logger.info('CoreMedia migration success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED
      });
      console.log('✅ CoreMedia migration completed successfully!');
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('❌ CoreMedia mapper error:', err?.response?.data ?? err?.message ?? err);
    logger.warn('CoreMedia migration error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR
    });
    return false;
  }
};

export default createCoremediaMapper;