import mysql from 'mysql2';
import customLogger from '../utils/custom-logger.utils.js';

const createDbConnection = async (
  config: any,
  projectId: string = '',
  stackId: string = ''
): Promise<mysql.Connection | null> => {
  try {
    // Create the connection with config values
    const connection = mysql.createConnection({
      host: config?.host,
      user: config?.user,
      password: config?.password,
      database: config?.database,
      port: Number(config?.port),
    });

    // Test the connection by wrapping the connect method in a promise
    return new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          // Close the connection properly with callback to prevent resource leaks
          // Wait for connection.end() to complete before rejecting
          connection.end((endErr) => {
            // Log any errors from connection.end but proceed with original error
            if (endErr) {
              customLogger(
                projectId,
                stackId,
                'warn',
                `Error closing failed connection: ${endErr.message}`
              ).catch(() => {}); // Fire-and-forget warning log
            }
            // Log error then reject - wrapped in try-catch for synchronous exceptions
            try {
              customLogger(
                projectId,
                stackId,
                'error',
                `Database connection failed: ${err.message}`
              )
                .then(() => reject(err))
                .catch(() => reject(err)); // Reject even if logging fails
            } catch {
              // Handle synchronous exceptions from customLogger itself
              reject(err);
            }
          });
          return;
        }

        // Log success then resolve - wrapped in try-catch for synchronous exceptions
        // Note: In success path, connection should remain open (returned to caller for use)
        try {
          customLogger(
            projectId,
            stackId,
            'info',
            'Database connection established successfully'
          )
            .then(() => resolve(connection))
            .catch(() => resolve(connection)); // Resolve even if logging fails
        } catch {
          // Handle synchronous exceptions from customLogger itself
          // Connection remains open intentionally - it's working and returned to caller
          try {
            resolve(connection);
          } catch {
            // If resolve itself fails (extremely rare), close connection to prevent leak
            connection.end(() => {});
          }
        }
      });
    });
  } catch (error: any) {
    // Use .catch() for consistency with the Promise callback pattern above
    customLogger(
      projectId,
      stackId,
      'error',
      `Failed to create database connection: ${error.message}`
    ).catch(() => {
      // Silently ignore logging errors
    });
    return null;
  }
};

// Usage example
const getDbConnection = async (
  config: any,
  projectId: string = '',
  stackId: string = ''
) => {
  try {
    const connection = await createDbConnection(config, projectId, stackId);
    if (!connection) {
      throw new Error('Could not establish database connection');
    }
    return connection;
  } catch (error: any) {
    await customLogger(
      projectId,
      stackId,
      'error',
      `Database connection error: ${error.message}`
    );
    throw error; // Re-throw so caller can handle it
  }
};

export { createDbConnection, getDbConnection };
