import mysql from 'mysql2/promise';
import logger from '../../utils/logger';

interface ValidatorProps {
  data: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number | string;
  };
}

/**
 * Validates Drupal SQL connection by testing a specific query
 * Tests connection with: "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'"
 * @param data - Database configuration object containing connection details
 * @returns Promise<boolean> - true if connection successful and query returns results, false otherwise
 */
async function drupalValidator({ data }: ValidatorProps): Promise<boolean> {
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
      return false;
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
      return false;
    }

    // Test with the specific Drupal config query
    const configQuery =
      "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    try {
      const [configRows] = await connection.execute(configQuery);

      // Check if config query returned any results
      const hasConfigResults = Array.isArray(configRows) && configRows.length > 0;

      if (hasConfigResults) {
        logger.info('Drupal validator: All validation checks passed successfully', {
          nodeFieldDataExists: true,
          configQueryResults: (configRows as any[]).length
        });
        return true;
      } else {
        logger.warn('Drupal validator: Config query executed but returned no results', {
          query: configQuery
        });
        return false;
      }
    } catch (configError: any) {
      logger.error('Drupal validator: Config table query failed', {
        error: configError.message,
        code: configError.code,
        sqlState: configError.sqlState,
        query: configQuery
      });
      return false;
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

    // Return false for any connection or query errors
    return false;
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
