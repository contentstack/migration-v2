'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const { readFile } = require('../utils/helper');

/**
 * Extracts entries from a Contentful export and groups them by content type ID.
 *
 * @param {string} cleanLocalPath - Path to the Contentful export JSON file.
 * @returns {Record<string, Array>} A map of contentTypeId to array of entry mapping objects.
 */
const extractEntries = (cleanLocalPath) => {
  try {
    const alldata = readFile(cleanLocalPath);
    const { entries } = alldata;
    const locales = alldata?.locales?.map((locale) => locale?.code);

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.info('No entries found in Contentful export');
      return {};
    }

    const entriesByContentType = {};

    for (const entry of entries) {
      const contentTypeId = entry?.sys?.contentType?.sys?.id;
      const entryId = entry?.sys?.id;
      for (const locale of locales) {
        let entryTitle = entry?.fields?.title?.[locale];
        entryTitle = !entryTitle ? entry?.fields?.name?.[locale] : entryTitle;
        if (!entryTitle) continue;
        if (!entriesByContentType[contentTypeId]) {
          entriesByContentType[contentTypeId] = [];
        }

        entriesByContentType[contentTypeId].push({
          contentTypeUid: contentTypeId,
          entryName: entryTitle,
          otherCmsEntryUid: entryId,
          isUpdate: false,
          language: locale,
        });
      }
    }

    console.info(
      `extractEntries: Extracted entries for ${Object.keys(entriesByContentType).length} content types`
    );

    return entriesByContentType;
  } catch (err) {
    console.error('Error extracting Contentful entries:', err);
    return {};
  }
};

module.exports = extractEntries;
