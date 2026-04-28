/* eslint-disable @typescript-eslint/no-var-requires */

const extractContentTypes = require('./libs/extractContentTypes');
const createInitialMapper = require('./libs/createInitialMapper');
const extractLocale = require('./libs/extractLocale');
const extractTaxonomy = require('./libs/extractTaxonomy');

module.exports = {
  extractContentTypes,
  createInitialMapper,
  extractLocale,
  extractTaxonomy
};
