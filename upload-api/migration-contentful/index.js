/* eslint-disable @typescript-eslint/no-var-requires */

const extractContentTypes = require('./libs/extractContentTypes');
const createInitialMapper = require('./libs/createInitialMapper');
const extractLocale = require('./libs/extractLocale');
const extractEntries = require('./libs/extractEntries');

module.exports = {
  extractContentTypes,
  createInitialMapper,
  extractLocale,
  extractEntries
};
