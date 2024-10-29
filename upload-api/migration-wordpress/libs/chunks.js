/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs');

/**
 * Internal module Dependencies.
 */
const config = require('../config');
const helper = require('../utils/helper');
const postConfig = config.modules.posts;
var postFolderName = global.wordPress_prefix
  ? `${global.wordPress_prefix
      .replace(/^\d+/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/(^_+)|(_+$)/g, '')
      .toLowerCase()}_${postConfig.dirName}`
  : postConfig.dirName;
const postFolderPath = path.resolve(config.data, config.entryfolder, postFolderName, 'en-us');
// entries posts 'en-us'
const chunksDir = path.resolve(config.data, 'chunks');
const indexFilePath = path.join(
  process.cwd(),
  config.data,
  'entries',
  postFolderName,
  'en-us',
  'index.json'
);

function startingDir() {
  if (!fs.existsSync(postFolderPath)) {
    mkdirp.sync(postFolderPath);
  }

  if (!fs.existsSync(chunksDir)) {
    mkdirp.sync(chunksDir);
  }
}

async function splitJsonIntoChunks(arrayData) {
  try {
    let chunkData = [];
    let chunkIndex = 1;
    let postIndex = {};

    for (let i = 0; i < arrayData.length; i++) {
      chunkData.push(arrayData[i]);

      if (chunkData.length >= 100 || (i === arrayData.length - 1 && chunkData.length > 0)) {
        // Write chunk data to file
        const chunkFilePath = path.join(chunksDir, `post-${chunkIndex}.json`);
        await helper.writeFileAsync(chunkFilePath, chunkData, 4);

        postIndex[chunkIndex] = `post-${chunkIndex}.json`;

        // Reset chunk data
        chunkData = [];
        chunkIndex++;
      }
    }

    await helper.writeFileAsync(indexFilePath, postIndex, 4);
  } catch (error) {
    console.error('Error while splitting JSON into chunks:', error?.message);
  }
}

async function extractChunks(affix) {
  console.log(`Creating chunks...`);
  try {
    postFolderName = affix
    startingDir(affix);

    const alldata = helper.readFile(path.join(config.data, config.json_filename));
    const posts = alldata?.rss?.channel['item'] ?? alldata?.channel['item'] ?? '';

    if (posts && posts.length > 0) {
      await splitJsonIntoChunks(posts);
      console.log('Post chunks creation completed.');
    } else {
      console.error('No posts found.');
    }
  } catch (error) {
    console.error(error);
    return;
  }
}

module.exports = extractChunks;
