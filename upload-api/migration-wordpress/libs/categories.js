/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs');
const config = require('../config');
const { JSDOM } = require('jsdom');
const { htmlToJson } = require('@contentstack/json-rte-serializer');

const chalk = require('chalk');

/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');

const categoryConfig = config.modules.categories;

var categoryFolderPath = '';

/**
 * Create folders and files
 */
function staringDir(affix) {
  const categoryFolderName = affix
  ? `${affix
      .replace(/^\d+/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/(^_+)|(_+$)/g, '')
      .toLowerCase()}_${categoryConfig.dirName}`
  : categoryConfig.dirName;
  categoryFolderPath = path.resolve(config.data, config.entryfolder, categoryFolderName);

  if (!fs.existsSync(categoryFolderPath)) {
    mkdirp.sync(categoryFolderPath);
    helper.writeFile(path.join(categoryFolderPath, categoryConfig.fileName));
  }
}

const convertHtmlToJson = (htmlString) => {
  const dom = new JSDOM(htmlString.replace(/&amp;/g, '&'));
  const htmlDoc = dom.window.document.querySelector('body');
  return htmlToJson(htmlDoc);
};

function parentCategories(catId, data, categoiesData) {
  const parentId = helper.readFile(
    path.join(process.cwd(), config.data, 'reference', 'reference.json')
  );
  const catParent = [];
  const getParent = data['parent'];

  Object.keys(parentId).forEach((key) => {
    if (getParent === parentId[key].slug) {
      catParent.push({
        uid: parentId[key].uid,
        _content_type_uid: parentId[key].content_type
      });
    }
  });

  categoiesData[catId]['parent'] = catParent;
}
async function saveCategories(categoryDetails) {
  try {
    let categorydata = helper.readFile(path.join(categoryFolderPath, categoryConfig.fileName));

    Array.isArray(categoryDetails)
      ? categoryDetails.map((data) => {
          const uid = `category_${data['id']}`;
          const title = data['title'] ? data['title'].replace(/&amp;/g, '&') : `Category - ${uid}`;
          const description = convertHtmlToJson(data['description'] || '');
          const nicename = data['nicename'] || '';

          categorydata[uid] = {
            uid,
            title,
            url: '/' + uid.replace('_', '/'),
            nicename,
            description
          };

          parentCategories(uid, data, categorydata);
        })
      : [];

    await helper.writeFileAsync(
      path.join(categoryFolderPath, categoryConfig.fileName),
      categorydata,
      4
    );

    console.log(chalk.green(`${categoryDetails.length}`, ' Categories exported successfully'));
  } catch (err) {
    console.error(chalk.red('Error in saving categories:', err));
  }
}
async function getAllCategories() {
  try {
    const alldata = helper.readFile(path.join(config.data, config.json_filename));
    const categories =
      alldata?.rss?.channel?.['wp:category'] ?? alldata?.channel?.['wp:category'] ?? '';

    if (!categories || categories.length === 0) {
      console.log(chalk.red('\nNo categories found'));
      return;
    }

    const categoriesArrray = Array.isArray(categories)
      ? categories.map((categoryinfo) => ({
          id: categoryinfo['wp:term_id'],
          title: categoryinfo['wp:cat_name'],
          nicename: categoryinfo['wp:category_nicename'],
          description: categoryinfo['wp:category_description'],
          parent: categoryinfo['wp:category_parent']
        }))
      : [
          {
            id: categories['wp:term_id'],
            title: categories['wp:cat_name'],
            nicename: categories['wp:category_nicename'],
            description: categories['wp:category_description'],
            parent: categories['wp:category_parent']
          }
        ];

    await saveCategories(categoriesArrray);
  } catch (err) {
    console.error(chalk.red('Error fetching categories:', err));
  }
}
async function extractCategories(affix) {
  try {
    console.log(`Exporting categories..`);
    staringDir(affix)
    await getAllCategories();
  } catch (err) {
    console.error(chalk.red('Error exporting categories:', err));
  }
}

module.exports = extractCategories;
