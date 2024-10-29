/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp'),
  path = require('path'),
  fs = require('fs'),
  when = require('when');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const virtualConsole = new jsdom.VirtualConsole();
const { htmlToJson } = require('@contentstack/json-rte-serializer');

virtualConsole.on('error', () => {
  // No-op to skip console errors.
});

const chalk = require('chalk');
/**
 * Internal module Dependencies.
 */
const helper = require('../utils/helper');
const config = require('../config');
function limitConcurrency(maxConcurrency) {
  let running = 0;
  const queue = [];

  function runNext() {
    if (running < maxConcurrency && queue.length > 0) {
      const task = queue.shift();
      running++;
      task().finally(() => {
        running--;
        runNext();
      });
      runNext();
    }
  }

  return async function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      runNext();
    });
  };
}

const limit = limitConcurrency(5); // Limiting to 5 concurrent tasks

const postConfig = config.modules.posts;
var postFolderPath = '';

var referenceId = helper.readFile(
  path.join(process.cwd(), config.data, 'reference', 'reference.json')
);

const alldata = helper.readFile(path.join(config.data, config.json_filename));
const blog_base_url =
  alldata?.rss?.channel['wp:base_blog_url'] || alldata?.channel['wp:base_blog_url'] || '';

const chunksDir = path.resolve(config.data, 'chunks');

function startingDir(affix) {
  referenceId = helper.readFile(
    path.join(process.cwd(), config.data, 'reference', 'reference.json')
  );
  const postFolderName = affix
    ? `${affix
        .replace(/^\d+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/(^_+)|(_+$)/g, '')
        .toLowerCase()}_${postConfig.dirName}`
    : postConfig.dirName;
  postFolderPath = path.resolve(config.data, config.entryfolder, postFolderName, 'en-us');
  if (!fs.existsSync(postFolderPath)) {
    mkdirp.sync(postFolderPath);
    helper.writeFile(path.join(postFolderPath, postConfig.fileName));
  }
}

async function featuredImageMapping(postid, post, postdata) {
  try {
    var assetsId = helper.readFile(path.join(process.cwd(), config.data, 'assets', 'assets.json'));

    if (!post['wp:postmeta'] || !assetsId) return;

    const postmetaArray = Array.isArray(post['wp:postmeta'])
      ? post['wp:postmeta']
      : [post['wp:postmeta']];

    const assetsDetails = postmetaArray
      .filter((meta) => meta['wp:meta_key'] === '_thumbnail_id')
      .map((meta) => {
        const attachmentid = `assets_${meta['wp:meta_value']}`;
        return Object.values(assetsId).find((asset) => asset.uid === attachmentid);
      })
      .filter(Boolean); // Filter out undefined matches

    if (assetsDetails.length > 0) {
      postdata[postid]['featured_image'] = assetsDetails;
    }
    return postdata;
  } catch (error) {
    console.log(error);
  }
}

const extractPostCategories = (categories) => {
  const postCategories = [],
    postTags = [],
    postTerms = [];

  const processCategory = (category) => {
    Object.keys(referenceId).forEach((key) => {
      if (category.attributes.nicename === referenceId[key].slug) {
        const contentType = referenceId[key].content_type;
        if (contentType.endsWith('terms')) {
          postTerms.push({ uid: key, _content_type_uid: contentType });
        } else if (contentType.endsWith('tag')) {
          postTags.push({ uid: key, _content_type_uid: contentType });
        } else if (contentType.endsWith('categories')) {
          postCategories.push({ uid: key, _content_type_uid: contentType });
        }
      }
    });
  };

  if (Array.isArray(categories)) {
    categories.forEach(processCategory);
  } else if (categories && categories['$']?.['domain'] !== 'category') {
    console.log(categories,"------===")
    processCategory(categories);
  }

  return { postCategories, postTags, postTerms };
};

const extractPostAuthor = (authorTitle, affix) => {
  const postAuthor = [];

  const processedAffix = affix
    ? `${affix
        .replace(/^\d+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/(^_+)|(_+$)/g, '')
        .toLowerCase()}_authors`
    : 'authors';
  const authorId = helper.readFile(
    path.join(process.cwd(), config.data, 'entries', processedAffix, 'en-us.json')
  );

  Object.keys(authorId).forEach((key) => {
    if (authorTitle.split(',').join('') === authorId[key].title) {
      postAuthor.push({ uid: key, _content_type_uid: processedAffix });
    }
  });

  return postAuthor;
};

async function processChunkData(chunkData, filename, isLastChunk, affix) {
  const postdata = {};
  try {
    const writePromises = [];

    const typeArray = ['page', 'wp_global_styles', 'wp_block', 'attachment', 'amp_validated_url'];
    const statusArray = ['publish', 'inherit'];
    const isValidPostType = (postType) => !typeArray.includes(postType);
    const isValidStatus = (status) => statusArray.includes(status);

    // iterate over data of each file
    for (const data of chunkData) {
      writePromises.push(
        limit(async () => {
          // necessary validations
          if (!isValidPostType(data['wp:post_type'])) return;
          if (!isValidStatus(data['wp:status'])) return;

          // get categories, tags, terms array
          const { postCategories, postTags, postTerms } = extractPostCategories(data['category']);

          // get author array
          const postAuthor = extractPostAuthor(data['dc:creator'], affix);

          const dom = new JSDOM(
            data['content:encoded']
              .replace(/<!--.*?-->/g, '')
              .replace(/&lt;!--?\s+\/?wp:.*?--&gt;/g, ''),
            { virtualConsole }
          );
          let htmlDoc = dom.window.document.querySelector('body');
          const jsonValue = htmlToJson(htmlDoc);
          const postDate = new Date(data['wp:post_date_gmt']).toISOString();

          const base = blog_base_url.split('/').filter(Boolean);
          const blogname = base[base.length - 1];
          const url = data['link'].split(blogname)[1];
          postdata[`posts_${data['wp:post_id']}`] = {
            title: data['title'] ?? `Posts - ${data['wp:post_id']}`,
            uid: `posts_${data['wp:post_id']}`,
            url: url,
            date: postDate,
            full_description: jsonValue,
            excerpt: data['excerpt:encoded']
              .replace(/<!--.*?-->/g, '')
              .replace(/&lt;!--?\s+\/?wp:.*?--&gt;/g, ''),
            author: postAuthor,
            category: postCategories,
            terms: postTerms,
            tag: postTags
          };
          await featuredImageMapping(`posts_${data['wp:post_id']}`, data, postdata);

          await helper.writeFileAsync(path.join(postFolderPath, filename), postdata, 4);
        })
      );
    }

    // Wait for all write promises to complete and store the results
    const results = await Promise.all(writePromises);
    // check if all promises resolved successfully
    const allSuccess = results.every((result) => typeof result !== 'object' || result.success);

    if (isLastChunk && allSuccess) {
      console.log('last data');
    }
  } catch (error) {
    console.log(error);
    console.log(chalk.red('Error saving posts', error));
    return { success: false, message: error };
  }
}

async function extractPosts(affix) {
  console.log(`Exporting posts...`);
  try {
    startingDir(affix);
    const chunkFiles = fs.readdirSync(chunksDir);
    const lastChunk = chunkFiles[chunkFiles.length - 1];

    // Read and process all files in the directory except the first one
    for (const filename of chunkFiles) {
      const filePath = path.join(chunksDir, filename);
      const data = fs.readFileSync(filePath);
      const chunkData = JSON.parse(data);

      // Check if the current chunk is the last chunk
      const isLastChunk = filename === lastChunk;

      // Process the current chunk
      await processChunkData(chunkData, filename, isLastChunk,affix);
      console.log(
        chalk.green(`${filename.split('.').slice(0, -1).join('.')}`),
        'getting migrated please wait'
      );
    }
    return;
  } catch (error) {
    console.log(error);
    return;
  }
}
module.exports = extractPosts;
