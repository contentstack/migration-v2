/* eslint-disable @typescript-eslint/no-var-requires */

const extractContentTypes = require('./libs/extractContentTypes');
const createInitialMapper = require('./libs/createInitialMapper');
const extractLocale = require('./libs/extractLocale');

module.exports = {
  extractContentTypes,
  createInitialMapper,
  extractLocale
};
