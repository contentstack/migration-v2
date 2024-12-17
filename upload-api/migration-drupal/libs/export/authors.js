/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');

/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');
const { MIGRATION_DATA_CONFIG } = require('../../constants/index')
const authorConfig = MIGRATION_DATA_CONFIG.modules.authors;
const authorsFolderPath = path.resolve(
  MIGRATION_DATA_CONFIG.data,
  MIGRATION_DATA_CONFIG.entryfolder,
  authorConfig.dirName
);
const limit = 100;


/**
 * Create folders and files
 */

function initialAuthorDirSetUp() {
  if (!fs.existsSync(authorsFolderPath)) {
    mkdirp.sync(authorsFolderPath);
    helper.writeFile(path.join(authorsFolderPath, authorConfig.fileName));
  }
}

let connection;

async function putAuthors(authordetails) {
  try {
    let authordata = {}
    authordetails.forEach((data) => {
      console.log(data)
      if (data['name'] !== '') {
        const uid = `${data['uid']}_${data['name'].toLowerCase()}`;


        authordata[uid] = {
          uid: uid,
          title: data['name'],
          email: data['mail'],
          timezone: data['timezone'],
        };

      }
    });

    await helper.writeFileAsync(path.join(authorsFolderPath, authorConfig.fileName), authordata);
  } catch (error) {
    console.error('Failed to put authors:', error);
  }
}

function getAuthors(skip) {
  return new Promise((resolve, reject) => {
    const query = `${MIGRATION_DATA_CONFIG['mysql-query']['authors']} LIMIT ${skip}, ${limit}`;
    connection.query(query, (error, rows) => {
      if (error) {
        console.error('Error querying authors:', error);
        return reject(error);
      }

      if (rows.length > 0) {
        putAuthors(rows);
      }
      resolve();
    });
  });
}

async function getAllAuthors(userCount) {
  const promises = [];
  for (let i = 0; i < userCount; i += limit) {
    promises.push(getAuthors(i));
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to get all authors:', error);
  } finally {
    connection.end();
  }
}

async function extractAuthors(config) {
  connection = helper.connect(config?.mysql)
  initialAuthorDirSetUp()
  try {
    connection.connect();
    const query = MIGRATION_DATA_CONFIG['mysql-query']['authorCount'];
    connection.query(query, async (error, rows) => {
      if (error) {
        console.error('Failed to get author count:', error);
        // connection.end();
        return;
      }

      const userCount = rows[0]?.usercount || 0;
      if (userCount > 0) {
        await getAllAuthors(userCount);
      } else {
        console.log('No authors found.');
        connection.end();
      }
    });
  } catch (error) {
    console.error('Error during start:', error);
    connection.end();
  }
}



module.exports = extractAuthors;
