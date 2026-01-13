'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const { dbConnection } = require('../utils/helper');

/**
 * Apply locale transformation rules (same logic as API side)
 * - "und" alone → "en-us"
 * - "und" + "en-us" → "und" become "en", "en-us" stays
 * - "en" + "und" → "und" becomes "en-us", "en" stays
 * - All three "en" + "und" + "en-us" → all three stays
 * - Apart from these, all other locales stay as is
 */
function applyLocaleTransformations(originalLocales) {
  const locales = [...originalLocales]; // Copy to avoid mutation
  const hasUnd = locales.includes('und');
  const hasEn = locales.includes('en');
  const hasEnUs = locales.includes('en-us');

  // Start with all non-special locales (not und, en, en-us)
  const result = locales.filter((locale) => !['und', 'en', 'en-us'].includes(locale));

  // Apply transformation rules based on combinations
  if (hasEn && hasUnd && hasEnUs) {
    // Rule 4: All three "en" + "und" + "en-us" → all three stays
    result.push('en', 'und', 'en-us');
  } else if (hasUnd && hasEnUs && !hasEn) {
    // Rule 2: "und" + "en-us" → "und" become "en", "en-us" stays
    result.push('en', 'en-us');
  } else if (hasEn && hasUnd && !hasEnUs) {
    // Rule 3: "en" + "und" → "und" becomes "en-us", "en" stays
    result.push('en', 'en-us');
  } else if (hasUnd && !hasEn && !hasEnUs) {
    // Rule 1: "und" alone → "en-us"
    result.push('en-us');
  } else {
    // For any other combinations, keep locales as they are
    if (hasEn) result.push('en');
    if (hasUnd) result.push('und');
    if (hasEnUs) result.push('en-us');
  }

  return Array.from(new Set(result)).sort();
}

const extractLocale = async (systemConfig) => {
  let connection;
  try {
    // Get database connection - pass your MySQL config
    connection = await dbConnection(systemConfig);

    // Simple query to get all unique language codes from content
    const localeQuery =
      "SELECT DISTINCT langcode FROM node_field_data WHERE langcode IS NOT NULL AND langcode != '' ORDER BY langcode";

    const [localeRows] = await connection.promise().query(localeQuery);
    const originalLocales = localeRows
      .map((row) => row.langcode)
      .filter((locale) => locale && locale.trim());

    // Apply locale transformation rules for UI consistency
    const transformedLocales = applyLocaleTransformations(originalLocales);

    return transformedLocales;
  } catch (error) {
    console.error(`Error reading JSON file:`, error);
    return [];
  }
};

module.exports = extractLocale;
