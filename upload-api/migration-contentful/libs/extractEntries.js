'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const { readFile } = require('../utils/helper');

/**
 * Extracts entries from a Contentful export and groups them by content type ID.
 *
 * @param {string} cleanLocalPath - Path to the Contentful export JSON file.
 * @returns {Record<string, Array>} A map of contentTypeId to array of entry mapping objects.
 */
/**
 * Returns a human-readable title for an (entry, locale). Priority:
 *   1. The content type's declared `displayField` value at this locale.
 *   2. `title` or `name` at this locale (legacy fallback for CTs without a displayField).
 *   3. First non-empty string field at this locale.
 *   4. `sys.id` if the entry has SOME non-empty content at this locale but nothing readable.
 * Returns null when the entry has no content at this locale at all — callers skip those,
 * so we don't emit rows for locales an entry isn't actually localized to.
 */
const pickEntryTitle = (entry, locale, displayField) => {
  const fields = entry?.fields || {};
  const candidates = [displayField, 'title', 'name'].filter(Boolean);
  for (const key of candidates) {
    const val = fields?.[key]?.[locale];
    if (typeof val === 'string' && val.trim()) return val;
  }
  let hasAnyLocaleContent = false;
  for (const val of Object.values(fields)) {
    if (val == null || typeof val !== 'object') continue;
    if (!(locale in val)) continue;
    hasAnyLocaleContent = true;
    const localized = val[locale];
    if (typeof localized === 'string' && localized.trim()) return localized;
  }
  return hasAnyLocaleContent ? entry?.sys?.id : null;
};

const extractEntries = (cleanLocalPath) => {
  try {
    const alldata = readFile(cleanLocalPath);
    const { entries } = alldata;
    const locales = alldata?.locales?.map((locale) => locale?.code);

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.info('No entries found in Contentful export');
      return {};
    }

    const displayFieldByCT = {};
    for (const ct of alldata?.contentTypes ?? []) {
      const id = ct?.sys?.id;
      if (id) displayFieldByCT[id] = ct?.displayField;
    }

    const entriesByContentType = {};

    for (const entry of entries) {
      const contentTypeId = entry?.sys?.contentType?.sys?.id;
      const entryId = entry?.sys?.id;
      const displayField = displayFieldByCT[contentTypeId];
      for (const locale of locales) {
        const entryTitle = pickEntryTitle(entry, locale, displayField);
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
