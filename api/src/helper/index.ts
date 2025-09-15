import mysql from 'mysql2';
import customLogger from '../utils/custom-logger.utils.js';

const createDbConnection = async (config: any, projectId: string = '', stackId: string = ''): Promise<mysql.Connection | null> => {
  try {
    // Create the connection with config values
    const connection = mysql.createConnection({
      host: config?.host,
      user: config?.user,
      password: config?.password,
      database: config?.database,
      port: Number(config?.port)
    });

    // Test the connection by wrapping the connect method in a promise
    return new Promise((resolve, reject) => {
      connection.connect(async (err) => {
        if (err) {
          await customLogger(projectId, stackId, 'error', `Database connection failed: ${err.message}`);
          reject(err);
          return;
        }

        await customLogger(projectId, stackId, 'info', 'Database connection established successfully');
        resolve(connection);
      });
    });
  } catch (error: any) {
    await customLogger(projectId, stackId, 'error', `Failed to create database connection: ${error.message}`);
    return null;
  }
};

// Usage example
const getDbConnection = async (config: any, projectId: string = '', stackId: string = '') => {
  try {
    const connection = await createDbConnection(config, projectId, stackId);
    if (!connection) {
      throw new Error('Could not establish database connection');
    }
    return connection;
  } catch (error: any) {
    await customLogger(projectId, stackId, 'error', `Database connection error: ${error.message}`);
    throw error; // Re-throw so caller can handle it
  }
};

export { createDbConnection, getDbConnection };