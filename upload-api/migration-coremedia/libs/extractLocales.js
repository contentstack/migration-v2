/**
 * Locale Extraction Module for CoreMedia
 * 
 * Extracts unique locales from CoreMedia JSON export files.
 * CoreMedia stores locale information in the "locale" property of content data.
 */

const fs = require('fs');
const path = require('path');
const readdirRecursive = require('fs-readdir-recursive');

/**
 * Extracts unique locales from a directory of CoreMedia export files
 * 
 * @param {string} dir - Directory path to scan for locale data
 * @returns {Set<string>} Set of unique locale codes found
 */
const extractLocales = (dir) => {
  console.info('🔍 [CoreMedia] Starting locale extraction from:', dir);
  console.time('🔍 [CoreMedia] Locale extraction time');

  const uniqueLocales = new Set();
  let fileCount = 0;
  let processedFiles = 0;

  try {
    // Get all files recursively
    const allFiles = readdirRecursive(dir);

    for (const file of allFiles) {
      const fullPath = path.join(dir, file);
      const ext = path.extname(file).toLowerCase();

      // Only process JSON files
      if (ext === '.json') {
        fileCount++;

        try {
          const rawData = fs.readFileSync(fullPath, 'utf8');
          const jsonData = JSON.parse(rawData);

          // CoreMedia stores locale in data.locale or at root level
          const locale = jsonData?.data?.locale || jsonData?.locale;

          if (locale) {
            uniqueLocales.add(locale);
            processedFiles++;
            console.info(`🔍 [CoreMedia] Found locale: "${locale}" in ${file}`);
          }

          // Also check for language property (alternative naming)
          const language = jsonData?.data?.language || jsonData?.language;
          if (language && !locale) {
            uniqueLocales.add(language);
            processedFiles++;
            console.info(`🔍 [CoreMedia] Found language: "${language}" in ${file}`);
          }
        } catch (err) {
          // Skip files that can't be parsed
        }

        // Progress logging every 50 files
        if (fileCount % 50 === 0) {
          console.info(
            `🔍 [CoreMedia] Progress: ${fileCount} files scanned, ${uniqueLocales.size} unique locales`
          );
        }
      }
    }
  } catch (error) {
    console.error('🔍 [CoreMedia] Error during locale extraction:', error?.message);
  }

  console.timeEnd('🔍 [CoreMedia] Locale extraction time');
  console.info(
    `🔍 [CoreMedia] Results: ${fileCount} files scanned, ${processedFiles} with locale data, ${uniqueLocales.size} unique locales`
  );
  console.info('🔍 [CoreMedia] Unique locales:', Array.from(uniqueLocales));

  // If no locales found, add default 'en-us'
  if (uniqueLocales.size === 0) {
    console.info('🔍 [CoreMedia] No locales found, adding default: en-us');
    uniqueLocales.add('en-us');
  }

  return uniqueLocales;
};

module.exports = extractLocales;
