/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp'),
  path = require('path'),
  _ = require('lodash'),
  fs = require('fs');
const config = require('../config');
const chalk = require('chalk');
/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');

const authorConfig = config.modules.authors;

var authorsFolderPath = "";
var authorsFilePath = "";

/**
 * Create folders and files if they are not created
 */
function startingDir(affix) {
  const authorFolderName = affix
  ? `${affix
      .replace(/^\d+/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/(^_+)|(_+$)/g, '')
      .toLowerCase()}_${authorConfig.dirName}`
  : authorConfig.dirName;

   authorsFolderPath = path.resolve(config.data, config.entryfolder, authorFolderName);
 authorsFilePath = path.join(authorsFolderPath, authorConfig.fileName);
  if (!fs.existsSync(authorsFolderPath)) {
    mkdirp.sync(authorsFolderPath);
    helper.writeFile(authorsFilePath);
  }
}
const filePath = false;
async function saveAuthors(authorDetails) {
  try {
    const slugRegExp = /[^a-z0-9_-]+/g;

    let authordata = helper.readFile(authorsFilePath);

    authorDetails.forEach((data) => {
      const uid =
        data['wp:author_id'] === undefined
          ? `authors_${data['wp:author_login']}`
          : `authors_${data['wp:author_id']}`;

      const url = `/author/${uid.toLowerCase().replace(slugRegExp, '-')}`;
      authordata[uid] = {
        uid: uid,
        title:
          data['wp:author_login'] ??
          `Authors - ${data['wp:author_login']}` ??
          `Authors - ${data['wp:author_id']}`,
        url: url,
        email: data['wp:author_email'],
        first_name: data['wp:author_first_name'],
        last_name: data['wp:author_last_name']
      };
    });
    await helper.writeFileAsync(authorsFilePath, authordata, 4);
    console.log(chalk.green(`\n${authorDetails.length}`), ' Authors exported successfully');
    console.log(`${authorDetails.length} Authors exported successfully`);
  } catch (error) {
    console.error('error while saving authors', error?.message);
  }
}
async function getAllAuthors() {
  try {
    const alldata = helper.readFile(path.join(config.data, config.json_filename));
    const authors = alldata?.rss?.channel?.['wp:author'] ?? alldata?.channel?.['wp:author'] ?? '';

    if (authors && authors.length > 0) {
      if (!filePath) {
        await saveAuthors(authors);
      } else {
        const authorIds = fs.existsSync(filePath)
          ? fs.readFileSync(filePath, 'utf-8').split(',')
          : [];

        if (authorIds.length > 0) {
          const authorDetails = authors.filter((author) =>
            authorIds.includes(author['wp:author_id'])
          );

          if (authorDetails.length > 0) {
            await saveAuthors(authorDetails);
          }
        }
      }
    } else if (typeof authors === 'object') {
      if (
        !filePath ||
        (fs.existsSync(filePath) &&
          fs.readFileSync(filePath, 'utf-8').split(',').includes(authors['wp:author_id']))
      ) {
        await saveAuthors([authors]);
      } else {
        console.log(chalk.red('\nNo authors UID found'));
      }
    } else {
      console.log(chalk.red('\nNo authors found'));
    }
  } catch (error) {
    console.error('error while getting authors', error?.message);
  }
}
async function extractAuthors(affix) {
  console.log(`Exporting authors...`);
  try {
    
    startingDir(affix);
    await getAllAuthors();
  } catch (error) {
    console.error('error in author module', error?.message);
  }
}

module.exports = extractAuthors;
