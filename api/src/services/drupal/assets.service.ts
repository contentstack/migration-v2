import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';
import mysql from 'mysql2';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { getDbConnection } from '../../helper/index.js';
import { processBatches } from '../../utils/batch-processor.utils.js';

const {
  DATA,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  ASSETS_FAILED_FILE,
} = MIGRATION_DATA_CONFIG;

interface AssetMetaData {
  uid: string;
  url: string;
  filename: string;
}

interface DrupalAsset {
  fid: string | number;
  uri: string;
  filename: string;
  filesize: string | number;
  filemime?: string;
  status?: string | number;
  uid?: string | number;
  timestamp?: string | number;
  id?: string | number; // For file_usage table
  count?: string | number; // For file_usage table
}

/**
 * Interface to track asset download URLs and their status
 */
interface AssetUrlTracker {
  success: Array<{
    uid: string;
    url: string;
    filename: string;
  }>;
  failed: Array<{
    uid: string;
    url: string;
    filename: string;
    reason: string;
  }>;
}

/**
 * Writes data to a specified file, ensuring the target directory exists.
 */
async function writeFile(dirPath: string, filename: string, data: any) {
  let fileHandle;
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);

    // Use file handle for better control over file operations
    fileHandle = await fs.promises.open(filePath, 'w');
    await fileHandle.writeFile(JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error(`Error writing ${dirPath}/${filename}::`, err);
    throw err; // Re-throw to handle upstream
  } finally {
    // Ensure file handle is always closed
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (closeErr) {
        console.error(
          `Error closing file handle for ${dirPath}/${filename}:`,
          closeErr
        );
      }
    }
  }
}

/**
 * Executes SQL query and returns results as Promise
 */
const executeQuery = (
  connection: mysql.Connection,
  query: string
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results as any[]);
      }
    });
  });
};

const publicPathCache = new Map<string, string>();

// AUTO-DETECT PUBLIC PATH FROM DATABASE
const detectPublicPath = async (
  connection: mysql.Connection,
  baseUrl: string,
  projectId: string,
  destination_stack_id: string
): Promise<string> => {
  const srcFunc = 'detectPublicPath';

  try {
    // Try to get public file path from Drupal's system table
    const configQuery = `
      SELECT value 
      FROM config 
      WHERE name = 'system.file' 
      LIMIT 1
    `;

    try {
      const configResults = await executeQuery(connection, configQuery);
      if (configResults.length > 0) {
        const config = JSON.parse(configResults[0].value);
        if (config.path && config.path.public) {
          const detectedPath = config.path.public;
          return detectedPath.endsWith('/') ? detectedPath : `${detectedPath}/`;
        }
      }
    } catch (configErr) {}

    // Final fallback: Try to detect from an actual file by testing URLs
    const sampleFileQuery = `
      SELECT uri, filename 
      FROM file_managed 
      WHERE uri LIKE 'public://%' 
      LIMIT 5
    `;

    const sampleResults = await executeQuery(connection, sampleFileQuery);
    if (sampleResults.length > 0) {
      // Try common Drupal paths with the user-provided baseUrl
      const commonPaths = [
        '/sites/default/files/',
        '/sites/all/files/',
        '/files/',
      ];

      // Also try to extract path patterns from the database URIs
      for (const sampleFile of sampleResults) {
        const sampleUri = sampleFile.uri;

        for (const testPath of commonPaths) {
          const testUrl = `${baseUrl}${testPath}${sampleUri.replace(
            'public://',
            ''
          )}`;
          try {
            const response = await axios.get(testUrl, {
              timeout: 5000,
              maxContentLength: 1024, // Only download first 1KB to test
              headers: {
                'User-Agent': 'Contentstack-Drupal-Migration/1.0',
              },
            });
            if (response.status === 200) {
              const message = getLogMessage(
                srcFunc,
                `Auto-detected public path: ${testPath}`,
                {}
              );
              await customLogger(
                projectId,
                destination_stack_id,
                'info',
                message
              );
              return testPath;
            }
          } catch (err) {
            // Continue to next path
          }
        }
      }

      // If common paths don't work, try to extract from URI patterns
      // Look for patterns like /sites/[site]/files/ in the database
      const uriPatternQuery = `
        SELECT DISTINCT uri 
        FROM file_managed 
        WHERE uri LIKE 'public://%' 
        LIMIT 10
      `;

      const uriResults = await executeQuery(connection, uriPatternQuery);
      const pathPatterns = new Set();

      uriResults.forEach((row) => {
        const uri = row.uri;
        // Extract potential path patterns from URIs
        const matches = uri.match(/public:\/\/(?:sites\/([^\/]+)\/)?files\//);
        if (matches) {
          pathPatterns.add(`/sites/${matches[1]}/files/`);
        }
      });

      // Test extracted patterns
      for (const pattern of pathPatterns) {
        const patternStr = pattern as string;
        for (const sampleFile of sampleResults.slice(0, 2)) {
          // Test with fewer files
          const testUrl = `${baseUrl}${patternStr}${sampleFile.uri.replace(
            'public://',
            ''
          )}`;
          try {
            const response = await axios.get(testUrl, {
              timeout: 5000,
              maxContentLength: 1024, // Only download first 1KB to test
              headers: {
                'User-Agent': 'Contentstack-Drupal-Migration/1.0',
              },
            });
            if (response.status === 200) {
              const message = getLogMessage(
                srcFunc,
                `Auto-detected public path from patterns: ${patternStr}`,
                {}
              );
              await customLogger(
                projectId,
                destination_stack_id,
                'info',
                message
              );
              return patternStr;
            }
          } catch (err) {
            // Continue to next pattern
          }
        }
      }
    }

    // Ultimate fallback

    const message = getLogMessage(
      srcFunc,
      `Could not auto-detect public path. Using default: /sites/default/files/`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'warn', message);
    return '/sites/default/files/';
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error detecting public path: ${error.message}. Using default.`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'warn', message);
    return '/sites/default/files/';
  }
};

// URL VALIDATION AND NORMALIZATION
const normalizeUrlConfig = (
  baseUrl: string,
  publicPath: string
): { baseUrl: string; publicPath: string } => {
  // Validate inputs - allow empty values for auto-detection
  if (!baseUrl && !publicPath) {
    throw new Error(
      `Invalid URL configuration: Both baseUrl and publicPath are empty. At least one must be provided.`
    );
  }

  // Normalize baseUrl (handle empty case)
  let normalizedBaseUrl = baseUrl ? baseUrl.trim() : '';

  if (normalizedBaseUrl) {
    // Remove trailing slash from baseUrl
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/+$/, '');

    // Ensure baseUrl has protocol
    if (
      !normalizedBaseUrl.startsWith('http://') &&
      !normalizedBaseUrl.startsWith('https://')
    ) {
      normalizedBaseUrl = `https://${normalizedBaseUrl}`;
    }

    // Validate baseUrl format
    try {
      new URL(normalizedBaseUrl);
    } catch (error) {
      throw new Error(
        `Invalid baseUrl format: "${baseUrl}" → "${normalizedBaseUrl}". Please provide a valid URL.`
      );
    }
  }

  // Normalize publicPath (handle empty case)
  let normalizedPublicPath = publicPath ? publicPath.trim() : '';

  if (normalizedPublicPath) {
    // Ensure publicPath starts with /
    if (!normalizedPublicPath.startsWith('/')) {
      normalizedPublicPath = `/${normalizedPublicPath}`;
    }

    // Ensure publicPath ends with /
    if (!normalizedPublicPath.endsWith('/')) {
      normalizedPublicPath = `${normalizedPublicPath}/`;
    }

    // Remove duplicate slashes
    normalizedPublicPath = normalizedPublicPath.replace(/\/+/g, '/');

    // Validate publicPath doesn't contain invalid characters
    if (
      normalizedPublicPath.includes('..') ||
      normalizedPublicPath.includes('//')
    ) {
      throw new Error(
        `Invalid publicPath format: "${publicPath}" → "${normalizedPublicPath}". Path contains invalid characters.`
      );
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    publicPath: normalizedPublicPath,
  };
};

// DYNAMIC URL CONSTRUCTION - HANDLES MULTIPLE PATH FORMATS
const constructAssetUrl = (
  uri: string,
  baseUrl: string,
  publicPath: string
): string => {
  try {
    // Normalize the input URLs first
    const { baseUrl: cleanBaseUrl, publicPath: cleanPublicPath } =
      normalizeUrlConfig(baseUrl, publicPath);

    // Already a full URL - return as is
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    // Handle public:// scheme
    if (uri.startsWith('public://')) {
      const relativePath = uri.replace('public://', '');

      // Check if we have valid baseUrl and publicPath
      if (!cleanBaseUrl || !cleanPublicPath) {
        throw new Error(
          `Cannot construct URL: baseUrl="${cleanBaseUrl}", publicPath="${cleanPublicPath}". Both are required for public:// URIs.`
        );
      }

      const fullUrl = `${cleanBaseUrl}${cleanPublicPath}${relativePath}`;
      return fullUrl;
    }

    // Handle private:// scheme
    if (uri.startsWith('private://')) {
      const relativePath = uri.replace('private://', '');

      if (!cleanBaseUrl) {
        throw new Error(
          `Cannot construct URL: baseUrl="${cleanBaseUrl}". Base URL is required for private:// URIs.`
        );
      }

      return `${cleanBaseUrl}/system/files/${relativePath}`;
    }

    // Handle relative paths
    const path = uri.startsWith('/') ? uri : `/${uri}`;

    if (!cleanBaseUrl) {
      throw new Error(
        `Cannot construct URL: baseUrl="${cleanBaseUrl}". Base URL is required for relative paths.`
      );
    }

    return `${cleanBaseUrl}${path}`;
  } catch (error: any) {
    console.error(`❌ URL Construction Error: ${error.message}`);
    throw new Error(`Failed to construct asset URL: ${error.message}`);
  }
};

// IMPROVED SAVE ASSET WITH BETTER ERROR HANDLING
const saveAsset = async (
  assets: DrupalAsset,
  failedJSON: any,
  assetData: any,
  metadata: AssetMetaData[],
  projectId: string,
  destination_stack_id: string,
  baseUrl: string = '',
  publicPath: string = '/sites/default/files/',
  retryCount = 0,
  authHeaders: any = {}, // Support for authentication
  urlTracker?: AssetUrlTracker, // Track successful and failed URLs
  userProvidedPublicPath?: string // Original user-provided path (for failed URL tracking)
): Promise<string> => {
  try {
    const srcFunc = 'saveAsset';
    const assetsSave = path.join(
      DATA,
      destination_stack_id,
      ASSETS_DIR_NAME,
      'files'
    );

    const assetId = `assets_${assets.fid}`;
    const fileName = assets.filename;
    const fileUrl = constructAssetUrl(assets.uri, baseUrl, publicPath);

    // Check if asset already exists
    if (fs.existsSync(path.resolve(assetsSave, assetId, fileName))) {
      return assetId;
    }

    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 120000, // Increased to 2 minutes
        maxContentLength: 500 * 1024 * 1024, // 500MB max
        headers: {
          'User-Agent': 'Contentstack-Drupal-Migration/1.0',
          ...authHeaders, // Spread any authentication headers
        },
        validateStatus: (status) => status === 200, // Only accept 200
      });

      const assetPath = path.resolve(assetsSave, assetId);

      // Create asset data
      assetData[assetId] = {
        uid: assetId,
        urlPath: `/assets/${assetId}`,
        status: true,
        content_type: assets.filemime || 'application/octet-stream',
        file_size: assets.filesize.toString(),
        tag: [],
        filename: fileName,
        url: fileUrl,
        is_dir: false,
        parent_uid: null,
        _version: 1,
        title: fileName,
        publish_details: [],
      };

      await fs.promises.mkdir(assetPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(assetPath, fileName),
        Buffer.from(response.data),
        'binary'
      );
      await writeFile(
        assetPath,
        `_contentstack_${assetId}.json`,
        assetData[assetId]
      );

      metadata.push({ uid: assetId, url: fileUrl, filename: fileName });

      // Track successful download
      if (urlTracker) {
        urlTracker.success.push({
          uid: assetId,
          url: fileUrl,
          filename: fileName,
        });
      }

      if (failedJSON[assetId]) {
        delete failedJSON[assetId];
      }

      const message = getLogMessage(
        srcFunc,
        `✅ Asset "${fileName}" (${assets.fid}) downloaded successfully.`,
        {}
      );
      await customLogger(projectId, destination_stack_id, 'info', message);

      return assetId;
    } catch (err: any) {
      // Retry logic with exponential backoff
      if (retryCount < 3) {
        // Increased to 3 retries
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s

        await new Promise((resolve) => setTimeout(resolve, delay));

        return await saveAsset(
          assets,
          failedJSON,
          assetData,
          metadata,
          projectId,
          destination_stack_id,
          baseUrl,
          publicPath,
          retryCount + 1,
          authHeaders,
          urlTracker,
          userProvidedPublicPath
        );
      } else {
        // After 3 retries failed, try fallback paths (if not already tried)
        const commonPaths = [
          '/sites/default/files/',
          '/sites/all/files/',
          '/sites/g/files/bxs2566/files/', // Rice University specific
          'sites/default/files/',
          'sites/all/files/',
        ];

        // Only try fallback if current path is the user-provided path
        const isUserProvidedPath =
          publicPath === (userProvidedPublicPath || publicPath);

        if (isUserProvidedPath) {
          // Try each common path
          for (const fallbackPath of commonPaths) {
            // Skip if already tried
            if (fallbackPath === publicPath) {
              continue;
            }

            try {
              // Attempt download with fallback path (reset retry count)
              const result = await saveAsset(
                assets,
                failedJSON,
                assetData,
                metadata,
                projectId,
                destination_stack_id,
                baseUrl,
                fallbackPath,
                0, // Reset retry count for fallback attempt
                authHeaders,
                urlTracker,
                userProvidedPublicPath || publicPath // Keep original user path for tracking
              );

              // Check if asset was actually saved (exists in assetData)
              if (assetData[assetId]) {
                return result; // Successfully downloaded with fallback path
              }
            } catch (fallbackErr) {
              // Continue to next fallback path
              continue;
            }
          }
        }

        // All attempts failed - log failure
        const errorDetails = {
          status: err.response?.status,
          statusText: err.response?.statusText,
          message: err.message,
          url: fileUrl,
        };

        // Use user-provided public path for the failed URL
        const failedUrl = constructAssetUrl(
          assets.uri,
          baseUrl,
          userProvidedPublicPath || publicPath
        );

        failedJSON[assetId] = {
          failedUid: assets.fid,
          name: fileName,
          url: failedUrl,
          file_size: assets.filesize,
          reason_for_error: JSON.stringify(errorDetails),
        };

        // Track failed download with user-provided URL
        if (urlTracker) {
          urlTracker.failed.push({
            uid: assetId,
            url: failedUrl,
            filename: fileName,
            reason: `${err.response?.status || 'Network error'}: ${
              err.message
            }`,
          });
        }

        const message = getLogMessage(
          srcFunc,
          `❌ Failed to download "${fileName}" (${assets.fid}) after all attempts: ${err.message}`,
          {},
          err
        );
        await customLogger(projectId, destination_stack_id, 'error', message);

        return assetId;
      }
    }
  } catch (error) {
    console.error('❌ Error in saveAsset:', error);
    return `assets_${assets.fid}`;
  }
};

// ASSETS QUERY - FETCH ALL FILES
const fetchAssetsFromDB = async (
  connection: mysql.Connection,
  projectId: string,
  destination_stack_id: string
): Promise<DrupalAsset[]> => {
  const srcFunc = 'fetchAssetsFromDB';

  // Query to fetch ALL files from Drupal
  const assetsQuery = `
    SELECT 
      fm.fid, 
      fm.filename, 
      fm.uri, 
      fm.filesize, 
      fm.filemime
    FROM file_managed fm
    ORDER BY fm.fid ASC
  `;

  try {
    const results = await executeQuery(connection, assetsQuery);

    const message = getLogMessage(
      srcFunc,
      `Fetched ${results.length} total assets from database.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    return results as DrupalAsset[];
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Failed to fetch assets from database: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Retries failed assets using FID query
 */
const retryFailedAssets = async (
  connection: mysql.Connection,
  failedAssetIds: string[],
  failedJSON: any,
  assetData: any,
  metadata: AssetMetaData[],
  projectId: string,
  destination_stack_id: string,
  baseUrl: string = '',
  publicPath: string = '/sites/default/files/',
  authHeaders: any = {},
  urlTracker?: AssetUrlTracker,
  userProvidedPublicPath?: string
): Promise<void> => {
  const srcFunc = 'retryFailedAssets';

  if (failedAssetIds.length === 0) {
    return;
  }

  try {
    const assetsFIDQuery = `SELECT a.fid, a.filename, a.uri, a.filesize, a.filemime, b.id, b.count FROM file_managed a, file_usage b WHERE a.fid IN (${failedAssetIds.join(
      ','
    )})`;
    const results = await executeQuery(connection, assetsFIDQuery);

    if (results.length > 0) {
      const limit = pLimit(1); // Reduce to 1 for large datasets to prevent EMFILE errors
      const tasks = results.map((asset: DrupalAsset) =>
        limit(() =>
          saveAsset(
            asset,
            failedJSON,
            assetData,
            metadata,
            projectId,
            destination_stack_id,
            baseUrl,
            publicPath,
            0,
            authHeaders,
            urlTracker,
            userProvidedPublicPath
          )
        )
      );

      await Promise.all(tasks);

      const message = getLogMessage(
        srcFunc,
        `Retried ${results.length} failed assets.`,
        {}
      );
      await customLogger(projectId, destination_stack_id, 'info', message);
    }
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error retrying failed assets: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
  }
};

// UPDATED createAssets WITH AUTO-DETECTION
export const createAssets = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string,
  baseUrl: string = '',
  publicPath: string = '', // Now optional - will auto-detect if empty
  isTest = false
) => {
  const srcFunc = 'createAssets';
  let connection: mysql.Connection | null = null;

  try {
    // Create database connection first
    connection = await getDbConnection(
      dbConfig,
      projectId,
      destination_stack_id
    );

    // Auto-detect public path if not provided or empty
    let detectedPublicPath = publicPath;
    if (!publicPath || publicPath.trim() === '') {
      detectedPublicPath = await detectPublicPath(
        connection,
        baseUrl,
        projectId,
        destination_stack_id
      );
    } else {
    }

    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const assetMasterFolderPath = path.join(
      DATA,
      destination_stack_id,
      'logs',
      ASSETS_DIR_NAME
    );

    await fs.promises.mkdir(assetsSave, { recursive: true });
    await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });

    const failedJSON: any = {};
    const assetData: any = {};
    const metadata: AssetMetaData[] = [];
    const fileMeta = { '1': ASSETS_SCHEMA_FILE };
    const failedAssetIds: string[] = [];

    // Initialize URL tracker for assets_url.json
    const urlTracker: AssetUrlTracker = {
      success: [],
      failed: [],
    };

    const message = getLogMessage(
      srcFunc,
      `Exporting assets using base URL: ${baseUrl} and public path: ${detectedPublicPath}`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Fetch assets from database
    const assetsData = await fetchAssetsFromDB(
      connection,
      projectId,
      destination_stack_id
    );

    if (assetsData && assetsData.length > 0) {
      let assets = assetsData;
      if (isTest) {
        assets = assets.slice(0, 10);
      }

      const batchSize = assets.length > 10000 ? 100 : 1000;
      const results = await processBatches(
        assets,
        async (asset: DrupalAsset) => {
          try {
            return await saveAsset(
              asset,
              failedJSON,
              assetData,
              metadata,
              projectId,
              destination_stack_id,
              baseUrl,
              detectedPublicPath, // Use detected path
              0,
              {}, // authHeaders
              urlTracker, // Pass URL tracker
              publicPath || detectedPublicPath // Use original user-provided path for tracking
            );
          } catch (error) {
            failedAssetIds.push(asset.fid.toString());
            return `assets_${asset.fid}`;
          }
        },
        {
          batchSize,
          concurrency: 5, // Increased from 1 for better performance
          delayBetweenBatches: 200,
        },
        (batchIndex, totalBatches, batchResults) => {
          if (batchIndex % 10 === 0) {
          }
        }
      );

      // Retry failed assets
      if (failedAssetIds.length > 0) {
        await retryFailedAssets(
          connection,
          failedAssetIds,
          failedJSON,
          assetData,
          metadata,
          projectId,
          destination_stack_id,
          baseUrl,
          detectedPublicPath, // Use detected path
          {}, // authHeaders
          urlTracker, // Pass URL tracker
          publicPath || detectedPublicPath // User-provided path for tracking
        );
      }

      await writeFile(assetsSave, ASSETS_SCHEMA_FILE, assetData);
      await writeFile(assetsSave, ASSETS_FILE_NAME, fileMeta);

      if (Object.keys(failedJSON).length > 0) {
        await writeFile(assetMasterFolderPath, ASSETS_FAILED_FILE, failedJSON);
      }

      // Write assets_url.json with successful and failed URLs
      await writeFile(assetsSave, 'assets_url.json', urlTracker);

      const successMessage = getLogMessage(
        srcFunc,
        `Successfully processed ${
          Object.keys(assetData).length
        } assets out of ${assets.length} total assets.`,
        {}
      );
      await customLogger(
        projectId,
        destination_stack_id,
        'info',
        successMessage
      );

      return results;
    } else {
      const message = getLogMessage(srcFunc, `No assets found.`, {});
      await customLogger(projectId, destination_stack_id, 'info', message);
      return [];
    }
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating assets.`,
      {},
      err
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw err;
  } finally {
    if (connection) {
      connection.end();
    }
  }
};
