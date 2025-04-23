/* eslint-disable @typescript-eslint/no-var-requires */

const extractContentTypes = require('./libs/content_types.js');
const contentTypeMaker = require('./libs/contenttypemapper.js');
const extractLocale = require('./libs/extractLocale.js');

module.exports = {
  extractContentTypes,
  contentTypeMaker,
  extractLocale
};
