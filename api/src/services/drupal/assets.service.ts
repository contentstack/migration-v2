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
 * Constructs the full URL for Drupal assets, handling public:// and private:// schemes
 */
const constructAssetUrl = (
  uri: string,
  baseUrl: string,
  publicPath: string
): string => {
  let url = uri;
  const replaceValue = baseUrl + publicPath;

  if (!url.startsWith('http')) {
    url = url.replace('public://', replaceValue);
    url = url.replace('private://', replaceValue);
  }

  return encodeURI(url);
};

/**
 * Saves an asset to the destination stack directory for Drupal migration.
 * Based on the original Drupal v8 migration logic.
 */
const saveAsset = async (
  assets: DrupalAsset,
  failedJSON: any,
  assetData: any,
  metadata: AssetMetaData[],
  projectId: string,
  destination_stack_id: string,
  baseUrl: string = '',
  publicPath: string = '/sites/default/files/',
  retryCount = 0
): Promise<string> => {
  try {
    const srcFunc = 'saveAsset';
    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);

    // Use Drupal-specific field names
    const assetId = `assets_${assets.fid}`;
    const fileName = assets.filename;
    const fileUrl = constructAssetUrl(assets.uri, baseUrl, publicPath);

    // Check if asset already exists
    if (fs.existsSync(path.resolve(assetsSave, assetId, fileName))) {
      return assetId; // Asset already exists
    }

    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const assetPath = path.resolve(assetsSave, assetId);

      // Create asset data following Drupal migration pattern
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

      const message = getLogMessage(
        srcFunc,
        `Asset "${fileName}" with id ${assets.fid} has been successfully transformed.`,
        {}
      );

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

      // Remove from failed assets if it was previously failed
      if (failedJSON[assetId]) {
        delete failedJSON[assetId];
      }

      await customLogger(projectId, destination_stack_id, 'info', message);
      return assetId;
    } catch (err: any) {
      if (retryCount < 1) {
        // Retry once
        return await saveAsset(
          assets,
          failedJSON,
          assetData,
          metadata,
          projectId,
          destination_stack_id,
          baseUrl,
          publicPath,
          retryCount + 1
        );
      } else {
        // Mark as failed after retry
        failedJSON[assetId] = {
          failedUid: assets.fid,
          name: fileName,
          url: fileUrl,
          file_size: assets.filesize,
          reason_for_error: err?.message,
        };

        const message = getLogMessage(
          srcFunc,
          `Failed to download asset "${fileName}" with id ${assets.fid}: ${err.message}`,
          {},
          err
        );
        await customLogger(projectId, destination_stack_id, 'error', message);
        return assetId;
      }
    }
  } catch (error) {
    console.error('Error in saveAsset:', error);
    return `assets_${assets.fid}`;
  }
};

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

/**
 * Fetches assets from database using SQL query
 */
const fetchAssetsFromDB = async (
  connection: mysql.Connection,
  projectId: string,
  destination_stack_id: string
): Promise<DrupalAsset[]> => {
  const srcFunc = 'fetchAssetsFromDB';
  const assetsQuery =
    'SELECT a.fid, a.filename, a.uri, a.filesize, a.filemime FROM file_managed a';

  try {
    const results = await executeQuery(connection, assetsQuery);

    const message = getLogMessage(
      srcFunc,
      `Fetched ${results.length} assets from database.`,
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
  publicPath: string = '/sites/default/files/'
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
            publicPath
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

/**
 * Creates and processes assets from Drupal database for migration to Contentstack.
 * Based on the original Drupal v8 migration logic with direct SQL queries.
 */
export const createAssets = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string,
  baseUrl: string = '',
  publicPath: string = '/sites/default/files/',
  isTest = false
) => {
  const srcFunc = 'createAssets';
  let connection: mysql.Connection | null = null;

  try {
    console.info('🔍 === DRUPAL ASSETS SERVICE CONFIG ===');
    console.info('📋 Database Config:', JSON.stringify(dbConfig, null, 2));
    console.info('📋 Destination Stack ID:', destination_stack_id);
    console.info('📋 Project ID:', projectId);
    console.info('📋 Base URL:', baseUrl);
    console.info('📋 Public Path:', publicPath);
    console.info('📋 Is Test Migration:', isTest);
    console.info('📋 Function:', srcFunc);
    console.info('========================================');

    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const assetMasterFolderPath = path.join(
      DATA,
      destination_stack_id,
      'logs',
      ASSETS_DIR_NAME
    );

    // Initialize directories and files
    await fs.promises.mkdir(assetsSave, { recursive: true });
    await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });

    // Initialize data structures
    const failedJSON: any = {};
    const assetData: any = {};
    const metadata: AssetMetaData[] = [];
    const fileMeta = { '1': ASSETS_SCHEMA_FILE };
    const failedAssetIds: string[] = [];

    const message = getLogMessage(srcFunc, `Exporting assets...`, {});
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Create database connection
    connection = await getDbConnection(
      dbConfig,
      projectId,
      destination_stack_id
    );

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

      // Use batch processing for large datasets to prevent EMFILE errors
      const batchSize = assets.length > 10000 ? 100 : 1000; // Smaller batches for very large datasets
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
              publicPath
            );
          } catch (error) {
            failedAssetIds.push(asset.fid.toString());
            return `assets_${asset.fid}`;
          }
        },
        {
          batchSize,
          concurrency: 1, // Process one at a time to prevent file handle exhaustion
          delayBetweenBatches: 200, // 200ms delay between batches to allow file handles to close
        },
        (batchIndex, totalBatches, batchResults) => {
          // Periodically save progress for very large datasets
          if (batchIndex % 10 === 0) {
            console.log(
              `💾 Progress: ${batchIndex}/${totalBatches} batches completed (${(
                (batchIndex / totalBatches) *
                100
              ).toFixed(1)}%)`
            );
          }
        }
      );

      // Retry failed assets if any
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
          publicPath
        );
      }

      // Write files following the original pattern
      await writeFile(assetsSave, ASSETS_SCHEMA_FILE, assetData);
      await writeFile(assetsSave, ASSETS_FILE_NAME, fileMeta);

      if (Object.keys(failedJSON).length > 0) {
        await writeFile(assetMasterFolderPath, ASSETS_FAILED_FILE, failedJSON);
      }

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
    // Close database connection
    if (connection) {
      connection.end();
    }
  }
};
