/* eslint-disable @typescript-eslint/no-var-requires */

const extractContentTypes = require('./libs/extractContentTypes');
const createInitialMapper = require('./libs/createInitialMapper');
const extractLocale = require('./libs/extractLocale');
const extractTaxonomy = require('./libs/extractTaxonomy');
const extractEntries = require('./libs/extractEntries');
const extractAssets = require('./libs/extractAssets');

module.exports = {
  extractContentTypes,
  createInitialMapper,
  extractLocale,
  extractTaxonomy,
  extractEntries,
  extractAssets
};
