'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const phpUnserialize = require('phpUnserialize');
/**
 * Internal module dependencies.
 */
const config = require('../config');
const { readFile, writeFile } = require('../utils/helper');
const { getDbConnection } = require('../../src/helper');

/**
 * Setup the folder path
 */
const drupalFolderPath = path.resolve(config.data);

const extractQueries = async () => {
  let connection;
  try {
    if (!fs.existsSync(drupalFolderPath)) {
      mkdirp.sync(drupalFolderPath);
    }

    // Get database connection - pass your MySQL config
    connection = await getDbConnection(config.mysql);

    // SQL query
    const query =
      "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    // Execute query - mysql2 uses promises if you use the promise() method
    const [rows] = await connection.promise().query(query);

    let details_data = [];

    // Process results
    for (let i = 0; i < rows.length; i++) {
      try {
        const conv_details = phpUnserialize(rows[i].data);
        details_data.push({
          field_name: conv_details.field_name,
          content_types: conv_details.bundle,
          type: conv_details.field_type,
          content_handler: conv_details?.settings?.handler
        });
      } catch (err) {
        console.warn(`Couldn't parse row ${i}:`, err.message);
      }
    }

    console.log(`Processed ${details_data.length} field configurations`);

    // Save the data to a file
    const outputPath = path.join(drupalFolderPath, 'field_mappings.json');
    writeFile(outputPath, JSON.stringify(details_data, null, 2));
    console.log(`Data saved to ${outputPath}`);

    return details_data;
  } catch (error) {
    console.error('Error extracting queries:', error);
    throw error;
  } finally {
    // Always close the connection when done
    if (connection) {
      connection.end();
      console.log('Database connection closed');
    }
  }
};

module.exports = extractQueries;
