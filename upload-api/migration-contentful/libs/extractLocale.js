'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const fs = require('fs');

/**
 * @description
 * Function to retrieve the unique source locales from the legacy CMS (Contentful)
 * Master locale (default: true) is ALWAYS placed as the FIRST element
 * @param {*} jsonFilePath - Local file path of the exported data
 * @returns {Array} - Array of unique locales with master locale as first element
 */
const extractLocale = async (jsonFilePath) => {
  console.log('================================================================================');
  console.log('🔍 [Contentful extractLocale] STARTING LOCALE EXTRACTION');
  console.log('🔍 [Contentful extractLocale] File path:', jsonFilePath);
  console.log('================================================================================');

  try {
    const rawData = fs?.readFileSync?.(jsonFilePath, 'utf8');
    console.log(
      '🔍 [Contentful extractLocale] ✅ File read successfully, length:',
      rawData?.length
    );

    const jsonData = JSON?.parse?.(rawData);
    console.log('🔍 [Contentful extractLocale] ✅ JSON parsed successfully');

    console.log('🔍 [Contentful extractLocale] Raw JSON data:', {
      hasLocalesArray: Array?.isArray?.(jsonData?.locales),
      localesCount: jsonData?.locales?.length || 0,
      locales: jsonData?.locales?.map?.((l) => ({
        code: l?.code,
        name: l?.name,
        default: l?.default,
        fallbackCode: l?.fallbackCode
      }))
    });

    // Extract unique language codes from locales array
    // 🔧 CRITICAL: Always normalize to lowercase for consistent mapping across all CMS types
    const uniqueLanguages = new Set();
    let masterLocale = null; // Track the master locale (where default: true)

    if (Array?.isArray?.(jsonData?.locales)) {
      console.log(
        '🔍 [Contentful extractLocale] Processing',
        jsonData?.locales?.length,
        'locales...'
      );
      jsonData?.locales?.forEach?.((locale, index) => {
        if (locale?.code) {
          const originalCode = locale.code;
          // Normalize to lowercase: "en-US" -> "en-us", "hi-IN" -> "hi-in"
          const normalizedCode = (locale.code || '').toLowerCase();

          // 🔧 CRITICAL: Identify the master locale (where default: true)
          if (locale.default === true) {
            masterLocale = normalizedCode;
            console.log(
              `🔍 [Contentful extractLocale] [${index + 1}/${jsonData.locales.length}] 🌟 MASTER LOCALE: "${originalCode}" -> "${normalizedCode}"`
            );
          } else {
            console.log(
              `🔍 [Contentful extractLocale] [${index + 1}/${jsonData.locales.length}] Locale: "${originalCode}" -> "${normalizedCode}"`
            );
          }

          uniqueLanguages.add(normalizedCode);
        }
      });
    } else {
      console.log('⚠️ [Contentful extractLocale] WARNING: No locales array found or not an array!');
    }

    // 🔧 CRITICAL: Ensure master locale is ALWAYS FIRST in the array
    let allLocales = [...uniqueLanguages];

    if (masterLocale && allLocales.includes(masterLocale)) {
      // Remove master locale from its current position
      allLocales = allLocales.filter((locale) => locale !== masterLocale);
      // Add it as the first element
      allLocales.unshift(masterLocale);
    }

    console.log('================================================================================');
    console.log('✅ [Contentful extractLocale] EXTRACTION COMPLETE');
    console.log(
      '✅ [Contentful extractLocale] Master Locale (default: true):',
      masterLocale || 'NOT FOUND'
    );
    console.log('✅ [Contentful extractLocale] All Locales (master first):', allLocales);
    console.log(
      '✅ [Contentful extractLocale] First element is master?',
      allLocales[0] === masterLocale
    );
    console.log('✅ [Contentful extractLocale] Total count:', allLocales.length);
    console.log('================================================================================');

    // Return array with master locale as FIRST element
    return allLocales;
  } catch (error) {
    console.error(
      '================================================================================'
    );
    console.error('❌ [Contentful extractLocale] ERROR reading JSON file:', error.message);
    console.error('❌ [Contentful extractLocale] Stack:', error.stack);
    console.error(
      '================================================================================'
    );
    return [];
  }
};

module.exports = extractLocale;
