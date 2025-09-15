/* eslint-disable @typescript-eslint/no-var-requires */

const extractTaxonomy = require('./libs/extractTaxonomy');
const createInitialMapper = require( './libs/createInitialMapper' );
const extractLocale= require('./libs/extractLocale');

module.exports = {
  // extractContentTypes,
  extractTaxonomy,
  createInitialMapper,
  extractLocale
};
