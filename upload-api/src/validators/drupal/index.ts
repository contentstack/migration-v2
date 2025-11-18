import mysql from 'mysql2/promise';
import axios from 'axios';
import logger from '../../utils/logger';

interface ValidatorProps {
  data: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number | string;
  };
  assetsConfig?: {
    base_url?: string;
    public_path?: string;
  };
}

/**
 * Normalizes and validates URL configuration
 */
function normalizeUrlConfig(
  baseUrl: string,
  publicPath: string
): { baseUrl: string; publicPath: string } {
  let normalizedBaseUrl = baseUrl ? baseUrl.trim() : '';
  let normalizedPublicPath = publicPath ? publicPath.trim() : '';

  if (normalizedBaseUrl) {
    // Remove trailing slash from baseUrl
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/+$/, '');

    // Ensure baseUrl has protocol
    if (!normalizedBaseUrl.startsWith('http://') && !normalizedBaseUrl.startsWith('https://')) {
      normalizedBaseUrl = `https://${normalizedBaseUrl}`;
    }
  }

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
  }

  return {
    baseUrl: normalizedBaseUrl,
    publicPath: normalizedPublicPath
  };
}

/**
 * Constructs asset URL from URI, baseUrl, and publicPath
 */
function constructAssetUrl(uri: string, baseUrl: string, publicPath: string): string {
  const { baseUrl: cleanBaseUrl, publicPath: cleanPublicPath } = normalizeUrlConfig(
    baseUrl,
    publicPath
  );

  // Handle public:// scheme
  if (uri.startsWith('public://')) {
    const relativePath = uri.replace('public://', '');
    return `${cleanBaseUrl}${cleanPublicPath}${relativePath}`;
  }

  // Handle private:// scheme
  if (uri.startsWith('private://')) {
    const relativePath = uri.replace('private://', '');
    return `${cleanBaseUrl}/system/files/${relativePath}`;
  }

  // Handle absolute URLs
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  // Handle relative paths
  const path = uri.startsWith('/') ? uri : `/${uri}`;
  return `${cleanBaseUrl}${path}`;
}

/**
 * Validates assets configuration by testing if assets are accessible
 * @param connection - Active MySQL connection
 * @param assetsConfig - Assets configuration with base_url and public_path
 * @returns Promise<boolean> - true if at least one asset returns 200, false otherwise
 */
async function validateAssetsConfig(
  connection: mysql.Connection,
  assetsConfig: { base_url?: string; public_path?: string }
): Promise<boolean> {
  try {
    const baseUrl = assetsConfig.base_url || '';
    const publicPath = assetsConfig.public_path || '';

    if (!baseUrl) {
      logger.warn('Assets validator: No base_url provided, skipping asset validation');
      return true; // Skip validation if no base_url provided
    }

    logger.info('Assets validator: Starting asset URL validation', {
      baseUrl,
      publicPath
    });

    // Fetch up to 10 assets from the database
    const assetsQuery = `
      SELECT 
        fm.fid, 
        fm.filename, 
        fm.uri, 
        fm.filesize, 
        fm.filemime
      FROM file_managed fm
      WHERE fm.uri LIKE 'public://%'
      ORDER BY fm.fid ASC
      LIMIT 10
    `;

    const [assets] = await connection.execute(assetsQuery);

    if (!Array.isArray(assets) || assets.length === 0) {
      logger.warn('Assets validator: No assets found in database');
      return true; // No assets to validate
    }

    logger.info(`Assets validator: Found ${assets.length} assets to test`);

    // Test each asset URL
    let successCount = 0;
    const testResults: Array<{
      uri: string;
      url: string;
      status: number | string;
      success: boolean;
    }> = [];

    for (const asset of assets as any[]) {
      const assetUrl = constructAssetUrl(asset.uri, baseUrl, publicPath);

      try {
        const response = await axios.head(assetUrl, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: (status) => status === 200,
          headers: {
            'User-Agent': 'Contentstack-Drupal-Migration-Validator/1.0'
          }
        });

        if (response.status === 200) {
          // ✅ CHECK CONTENT-TYPE: Ensure it's an actual asset, not an HTML page
          const contentType = response.headers['content-type'] || '';

          // Valid asset content types (not HTML)
          const isValidAsset =
            contentType.includes('image/') || // Images: image/jpeg, image/png, etc.
            contentType.includes('application/pdf') || // PDFs
            contentType.includes('application/zip') || // Archives
            contentType.includes('video/') || // Videos
            contentType.includes('audio/') || // Audio
            contentType.includes('application/octet-stream') || // Generic binary
            contentType.includes('application/msword') || // Word docs
            contentType.includes('application/vnd.') || // Office docs (Excel, PowerPoint, etc.)
            contentType.includes('text/plain') || // Text files
            contentType.includes('text/csv'); // CSV files

          // Reject HTML pages (common for error pages or redirects)
          const isHtmlPage =
            contentType.includes('text/html') || contentType.includes('application/xhtml');

          if (isValidAsset && !isHtmlPage) {
            successCount++;
            testResults.push({
              uri: asset.uri,
              url: assetUrl,
              status: 200,
              success: true
            });

            logger.info(`Assets validator: Valid asset found`, {
              uri: asset.uri,
              url: assetUrl,
              status: 200,
              contentType: contentType
            });

            // If we found at least one working asset, validation passes
            if (successCount >= 1) {
              logger.info(
                `Assets validator: Validation successful (${successCount}/${assets.length} assets accessible)`,
                {
                  successCount,
                  totalTested: testResults.length,
                  baseUrl,
                  publicPath
                }
              );
              return true;
            }
          } else {
            // Status 200 but wrong content type (likely HTML error page)
            testResults.push({
              uri: asset.uri,
              url: assetUrl,
              status: `200 but invalid content-type: ${contentType}`,
              success: false
            });

            logger.warn(`Assets validator: URL returns 200 but not a valid asset`, {
              uri: asset.uri,
              url: assetUrl,
              contentType: contentType,
              isHtmlPage: isHtmlPage
            });
          }
        }
      } catch (error: any) {
        testResults.push({
          uri: asset.uri,
          url: assetUrl,
          status: error.response?.status || error.message,
          success: false
        });

        logger.debug('Assets validator: Asset not accessible', {
          uri: asset.uri,
          url: assetUrl,
          status: error.response?.status,
          error: error.message
        });
      }
    }

    // If no assets were accessible, validation fails
    logger.error('Assets validator: No accessible assets found', {
      totalTested: testResults.length,
      successCount,
      baseUrl,
      publicPath,
      failedUrls: testResults.filter((r) => !r.success).map((r) => r.url)
    });

    return false;
  } catch (error: any) {
    logger.error('Assets validator: Error during asset validation', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Validates Drupal SQL connection and optionally validates assets configuration
 * Tests connection with: "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'"
 * @param data - Database configuration object containing connection details
 * @param assetsConfig - Optional assets configuration to validate
 * @returns Promise<{ success: boolean, error?: string }> - success flag and optional error message
 */
async function drupalValidator({
  data,
  assetsConfig
}: ValidatorProps): Promise<{ success: boolean; error?: string } | boolean> {
  let connection: mysql.Connection | null = null;

  try {
    // Debug: Log the received data structure
    logger.info('Drupal validator: Received data structure', {
      dataKeys: Object.keys(data || {}),
      hasHost: !!data?.host,
      hasUser: !!data?.user,
      hasPassword: !!data?.password,
      hasDatabase: !!data?.database,
      host: data?.host,
      user: data?.user,
      database: data?.database,
      port: data?.port
    });

    // Validate required connection parameters (password can be empty for local development)
    if (!data?.host || !data?.user || !data?.database) {
      logger.error('Drupal validator: Missing required database connection parameters', {
        missingHost: !data?.host,
        missingUser: !data?.user,
        missingDatabase: !data?.database
      });
      return {
        success: false,
        error:
          '❌ Missing database connection parameters. Please provide host, user, and database name.'
      };
    }

    // Create MySQL connection configuration
    const connectionConfig: mysql.ConnectionOptions = {
      host: data.host,
      user: data.user,
      password: data.password,
      database: data.database,
      port: Number(data.port) || 3306,
      connectTimeout: 10000 // 10 seconds timeout
    };

    // Create the database connection
    connection = await mysql.createConnection(connectionConfig);

    logger.info('Drupal validator: Database connection established successfully', {
      host: data.host,
      database: data.database,
      port: Number(data.port) || 3306
    });

    // Test connection and validate required Drupal tables exist
    // Check for node_field_data table (this is the table that's missing in the error)
    const nodeFieldDataQuery = 'SELECT COUNT(*) as count FROM node_field_data LIMIT 1';

    try {
      const [nodeRows] = await connection.execute(nodeFieldDataQuery);
      logger.info('Drupal validator: node_field_data table exists and accessible');
    } catch (nodeError: any) {
      logger.error('Drupal validator: node_field_data table check failed', {
        error: nodeError.message,
        code: nodeError.code,
        sqlState: nodeError.sqlState
      });
      return {
        success: false,
        error:
          '❌ Required Drupal table not found: This database appears to be missing critical Drupal content tables. Please ensure this is a Drupal 8/9/10/11 database.'
      };
    }

    // Test with the specific Drupal config query
    const configQuery =
      "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    try {
      const [configRows] = await connection.execute(configQuery);

      // Check if config query returned any results
      const hasConfigResults = Array.isArray(configRows) && configRows.length > 0;

      if (hasConfigResults) {
        logger.info('Drupal validator: Database validation checks passed', {
          nodeFieldDataExists: true,
          configQueryResults: (configRows as any[]).length
        });

        // If assetsConfig is provided, validate assets accessibility
        if (assetsConfig && (assetsConfig.base_url || assetsConfig.public_path)) {
          logger.info('Drupal validator: Starting assets configuration validation');

          const assetsValid = await validateAssetsConfig(connection, assetsConfig);

          if (!assetsValid) {
            logger.error('Drupal validator: Assets validation failed', {
              baseUrl: assetsConfig.base_url,
              publicPath: assetsConfig.public_path
            });
            return {
              success: false,
              error: `❌ Assets validation failed: Unable to access assets at ${assetsConfig.base_url}. Please verify your assets configuration (base URL and public path).`
            };
          }

          logger.info('Drupal validator: All validation checks (DB + Assets) passed successfully');
        } else {
          logger.info('Drupal validator: No assetsConfig provided, skipping asset validation');
        }

        return { success: true };
      } else {
        logger.warn('Drupal validator: Config query executed but returned no results', {
          query: configQuery
        });
        return {
          success: false,
          error:
            '❌ Drupal schema validation failed: Required tables or configuration not found. Please ensure this is a valid Drupal database with content types configured.'
        };
      }
    } catch (configError: any) {
      logger.error('Drupal validator: Config table query failed', {
        error: configError.message,
        code: configError.code,
        sqlState: configError.sqlState,
        query: configQuery
      });
      return {
        success: false,
        error: `❌ Database schema error: ${configError.code === 'ER_NO_SUCH_TABLE' ? 'Required Drupal tables not found' : configError.message}. Ensure this is a Drupal 8/9/10 database.`
      };
    }
  } catch (error: any) {
    // Log specific error details for debugging
    logger.error('Drupal validator: Database connection or query failed', {
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      stack: error.stack,
      host: data?.host,
      database: data?.database,
      port: data?.port
    });

    // Return specific error messages based on error code
    let errorMessage = '❌ Database connection failed: ';
    if (error.code === 'ECONNREFUSED') {
      errorMessage += `Cannot connect to MySQL server at ${data?.host}:${data?.port || 3306}. Please check if the database server is running and accessible.`;
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage += `Access denied for user '${data?.user}'. Please verify your username and password are correct.`;
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage += `Database '${data?.database}' does not exist. Please verify the database name is correct.`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      errorMessage += `Cannot reach database server at ${data?.host}. Please check the host address and network connectivity.`;
    } else {
      errorMessage += `${error.message}`;
    }

    return { success: false, error: errorMessage };
  } finally {
    // Always close the connection if it was established
    if (connection) {
      try {
        await connection.end();
        logger.info('Drupal validator: Database connection closed successfully');
      } catch (closeError: any) {
        logger.warn('Drupal validator: Error closing database connection', {
          error: closeError.message
        });
      }
    }
  }
}

export default drupalValidator;
