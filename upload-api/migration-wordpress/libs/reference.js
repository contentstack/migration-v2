/**
 * External module Dependencies.
 */
var mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs');

/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');
const config = require('../config');
const referenceConfig = config.modules.references;
const referenceFolderPath = path.resolve(config.data, referenceConfig.dirName);
const referencePath = path.join(referenceFolderPath, referenceConfig.fileName);
/**
 * Create folders and files
 */

function startDir() {
if (!fs.existsSync(referenceFolderPath)) {
  mkdirp.sync(referenceFolderPath);
  helper.writeFile(path.join(referencePath));
} 
}

async function saveReference(referenceDetails) {
  try {
    let referenceData = helper.readFile(referencePath) || {};

    referenceDetails.forEach(function (data, index) {
      const uid = data['id'];
      const slug = data['slug'];
      const content_type = data['content_type'] || '';
      // this is for reference purpose
      referenceData[uid] = {
        uid: uid,
        slug: slug,
        content_type: content_type
      };

      // fs.writeFileSync(
      //   path.join(referenceFolderPath, referenceConfig.fileName),
      //   JSON.stringify(referenceData, null, 4)
      // );
    });
    await helper.writeFileAsync(referencePath, referenceData, 4);
    console.log('Reference data saved successfully.');
  } catch (error) {
    console.error('Error saving reference data:', error?.message);
  }
}
async function getAllreference(affix) {
  try {
    startDir()
    const alldata = helper.readFile(path.join(config.data, config.json_filename));

    const prefix = affix
      .replace(/^\d+/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/(^_+)|(_+$)/g, '')
      .toLowerCase();

    const referenceTags = alldata?.rss?.channel['wp:tag'] ?? alldata?.channel['wp:tag'] ?? '';
    const referenceTerms = alldata?.rss?.channel['wp:term'] ?? alldata?.channel['wp:term'] ?? '';
    const referenceCategories =
      alldata?.rss?.channel['wp:category'] ?? alldata?.channel['wp:category'] ?? '';

    const referenceArray = [];
    const categories = prefix ? `${prefix}_categories` : 'categories';
    const terms = prefix ? `${prefix}_terms` : 'terms';
    const tag = prefix ? `${prefix}_tag` : 'tag';

    // referenceArray for categories
    if (Array.isArray(referenceCategories)) {
      referenceCategories.forEach((catinfo) => {
        referenceArray.push({
          id: `category_${catinfo['wp:term_id']}`,
          slug: catinfo['wp:category_nicename'],
          content_type: categories
        });
      });
    } else if (typeof referenceCategories === 'object') {
      referenceArray.push({
        id: `category_${referenceCategories['wp:term_id']}`,
        slug: referenceCategories['wp:category_nicename'],
        content_type: categories
      });
    }

    // referenceArray for terms
    if (Array.isArray(referenceTerms)) {
      referenceTerms.forEach(function (terminfo) {
        referenceArray.push({
          id: `terms_${terminfo['wp:term_id']}`,
          slug: terminfo['wp:term_slug'],
          content_type: terms
        });
      });
    } else if (typeof referenceTerms === 'object') {
      referenceArray.push({
        id: `terms_${referenceTerms['wp:term_id']}`,
        slug: referenceTerms['wp:term_slug'],
        content_type: terms
      });
    }

    // referenceArray for tags
    if (Array.isArray(referenceTags)) {
      referenceTags.forEach(function (taginfo) {
        referenceArray.push({
          id: `tags_${taginfo['wp:term_id']}`,
          slug: taginfo['wp:tag_slug'],
          content_type: tag
        });
      });
    } else if (typeof referenceTags === 'object') {
      referenceArray.push({
        id: `tags_${referenceTags['wp:term_id']}`,
        slug: referenceTags['wp:tag_slug'],
        content_type: tag
      });
    }

    if (referenceArray.length > 0) {
      await saveReference(referenceArray);
    }
    console.log('All references processed successfully.');
  } catch (error) {
    console.error('Error processing references:', error?.message);
  }
}


module.exports = getAllreference;
