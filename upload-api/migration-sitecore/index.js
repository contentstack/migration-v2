/* eslint-disable @typescript-eslint/no-var-requires */

const contentTypes = require('./libs/contenttypes.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExtractConfiguration = require('./libs/configuration.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const reference = require('./libs/reference.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExtractFiles = require('./libs/convert.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extractLocales = require('./libs/extractLocales.js');

module.exports = {
  contentTypes,
  ExtractConfiguration,
  reference,
  ExtractFiles,
  extractLocales
};
