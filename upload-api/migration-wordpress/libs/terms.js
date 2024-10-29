/**
 * External module Dependencies.
 */
var mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs'),
  when = require('when');

const chalk = require('chalk');

/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');
const config = require('../config');
const termsConfig = config.modules.terms;
var termsFolderPath = ""
/**
 * Create folders and files
 */
function staringDir(affix) {
  const termsFolderName = affix
    ? `${affix
        .replace(/^\d+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/(^_+)|(_+$)/g, '')
        .toLowerCase()}_${termsConfig.dirName}`
    : termsConfig.dirName;
   termsFolderPath = path.resolve(config.data, config.entryfolder, termsFolderName);
  if (!fs.existsSync(termsFolderPath)) {
    mkdirp.sync(termsFolderPath);
    helper.writeFile(path.join(termsFolderPath, termsConfig.fileName));
  }
}

async function saveTerms(termsDetails) {
  try {
    const termsFilePath = path.join(termsFolderPath, termsConfig.fileName);
    let termsdata = helper.readFile(termsFilePath);

    for (const data of termsDetails) {
      const { id, term_name, term_taxonomy = '', term_slug } = data;
      const uid = `terms_${id}`;
      const title = term_name ?? `Terms - ${id}`;
      const url = `/terms/${uid}`;

      termsdata[uid] = {
        uid,
        title,
        url,
        taxonomy: term_taxonomy,
        slug: term_slug
      };
    }

    await helper.writeFileAsync(termsFilePath, termsdata, 4);
    console.log(chalk.green(`${termsDetails.length} Terms exported successfully`));
  } catch (error) {
    console.error(chalk.red('Error saving terms:', error));
    throw error;
  }
}

async function getAllTerms() {
  try {
    const alldata = helper.readFile(path.join(config.data, config.json_filename));
    const terms = alldata?.rss?.channel['wp:term'] || alldata?.channel['wp:term'] || '';

    if (!terms || terms.length === 0) {
      console.log(chalk.red('\nNo terms found'));
      return;
    }
    const termsArray = Array.isArray(terms)
      ? terms.map((term) => ({
          id: term['wp:term_id'],
          term_name: term['wp:term_name'],
          term_slug: term['wp:term_slug'],
          term_taxonomy: term['wp:term_taxonomy']
        }))
      : [
          {
            id: terms['wp:term_id'],
            term_name: terms['wp:term_name'],
            term_slug: terms['wp:term_slug'],
            term_taxonomy: terms['wp:term_taxonomy']
          }
        ];

    await saveTerms(termsArray);
  } catch (error) {
    console.error(chalk.red('Error retrieving terms:', error?.message));
  }
}

async function extractTerms(affix) {
  try {
    console.log(`Exporting terms...`);
    staringDir(affix)
    await getAllTerms();
  } catch (error) {
    console.error(chalk.red('Error during export process:', error));
  }
}

module.exports = extractTerms;
