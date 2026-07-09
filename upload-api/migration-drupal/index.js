/* eslint-disable @typescript-eslint/no-var-requires */

const extractTaxonomy = require('./libs/extractTaxonomy');
const createInitialMapper = require('./libs/createInitialMapper');
const extractLocale = require('./libs/extractLocale');
const extractEntries = require('./libs/extractEntries');
const extractAssets = require('./libs/extractAssets');

module.exports = {
  // extractContentTypes,
  extractTaxonomy,
  createInitialMapper,
  extractLocale,
  extractEntries,
  extractAssets
};
