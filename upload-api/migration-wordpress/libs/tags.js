/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs');

const chalk = require('chalk');
/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');
const config = require('../config');
const tagsConfig = config.modules.tag;
var tagsFolderPath = '';

/**
 * Create folders and files
 */

function staringDir(affix) {
  const tagsFolderName = affix
    ? `${affix
        .replace(/^\d+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/(^_+)|(_+$)/g, '')
        .toLowerCase()}_${tagsConfig.dirName}`
    : tagsConfig.dirName;
  tagsFolderPath = path.resolve(config.data, config.entryfolder, tagsFolderName);
  if (!fs.existsSync(tagsFolderPath)) {
    mkdirp.sync(tagsFolderPath);
    helper.writeFile(path.join(tagsFolderPath, tagsConfig.fileName));
  }
}

async function saveTags(tagDetails) {
  try {
    const tagsFilePath = path.join(tagsFolderPath, tagsConfig.fileName);
    let tagdata = helper.readFile(tagsFilePath);

    for (const data of tagDetails) {
      const { id, tag_name, tag_slug, description = '' } = data;
      const uid = `tags_${id}`;
      const title = tag_name ?? `Tags - ${id}`;
      const url = `/tags/${uid}`;

      tagdata[uid] = {
        uid,
        title,
        url,
        slug: tag_slug,
        description
      };
    }
    await helper.writeFileAsync(tagsFilePath, tagdata, 4);

    console.log(chalk.green(`${tagDetails.length}`), ' Tags exported successfully');
  } catch (error) {
    console.error(chalk.red('Error saving tags:', error));
    throw error;
  }
}
async function getAllTags() {
  try {
    const alldata = helper.readFile(path.join(config.data, config.json_filename));
    const tags = alldata?.rss?.channel?.['wp:tag'] || alldata?.channel?.['wp:tag'] || '';

    if (!tags || tags.length === 0) {
      console.log(chalk.red('\nNo tags found'));
      return;
    }
    const tagsArray = Array.isArray(tags)
      ? tags.map((taginfo) => ({
          id: taginfo['wp:term_id'],
          tag_name: taginfo['wp:tag_name'],
          tag_slug: taginfo['wp:tag_slug'],
          description: taginfo['wp:tag_description']
        }))
      : [
          {
            id: tags['wp:term_id'],
            tag_name: tags['wp:tag_name'],
            tag_slug: tags['wp:tag_slug'],
            description: tags['wp:tag_description']
          }
        ];

    await saveTags(tagsArray);
  } catch (error) {
    console.error(chalk.red('Error retrieving tags:', error));
    throw error;
  }
}
async function extractTags(affix) {
  try {
    console.log(`Exporting tags...`);
    staringDir(affix)
    await getAllTags();
  } catch (error) {
    console.error(chalk.red('Error during export process:', error));
  }
}

module.exports = extractTags;
