/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const extractLocales = (dir) => {
  console.info('🔍 [DEBUG] extractLocales - Starting locale extraction from:', dir);
  console.time('🔍 [DEBUG] extractLocales - Total extraction time');

  // ✅ Create a new Set for each function call instead of using global
  const uniqueLanguages = new Set();
  let fileCount = 0;
  let processedFiles = 0;

  const extractRecursive = (currentDir) => {
    try {
      const items = fs?.readdirSync?.(currentDir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path?.join?.(currentDir, item?.name);

        if (item?.isDirectory()) {
          // ✅ Skip certain directories that are unlikely to contain locale data
          const skipDirs = [
            '__Standard Values',
            '__Prototypes',
            '__Masters',
            'blob',
            'media library'
          ];
          if (!skipDirs.some((skipDir) => item.name.includes(skipDir))) {
            extractRecursive(fullPath);
          }
        } else if (item?.isFile() && item?.name === 'data.json') {
          fileCount++;
          try {
            const rawData = fs?.readFileSync?.(fullPath, 'utf8');
            const jsonData = JSON?.parse?.(rawData);
            const language = jsonData?.item?.$?.language;

            if (language) {
              // 🔧 CRITICAL: Always normalize to lowercase for consistent mapping across all CMS types
              const normalizedLanguage = (language || '').toLowerCase();
              uniqueLanguages?.add?.(normalizedLanguage);
              processedFiles++;
              console.info(
                `🔍 [DEBUG] extractLocales - Found locale: "${language}" -> normalized to "${normalizedLanguage}" in ${fullPath}`
              );
            }
          } catch (error) {
            console.error(`🔍 [DEBUG] extractLocales - Error reading ${fullPath}:`, error?.message);
          }

          // ✅ Progress logging every 100 files
          if (fileCount % 100 === 0) {
            console.info(
              `🔍 [DEBUG] extractLocales - Progress: ${fileCount} files scanned, ${uniqueLanguages.size} unique locales found`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `🔍 [DEBUG] extractLocales - Error reading directory ${currentDir}:`,
        error?.message
      );
    }
  };

  extractRecursive(dir);

  console.timeEnd('🔍 [DEBUG] extractLocales - Total extraction time');
  console.info(
    `🔍 [DEBUG] extractLocales - Final results: ${fileCount} total files scanned, ${processedFiles} files with locale data, ${uniqueLanguages.size} unique locales found`
  );
  console.info('🔍 [DEBUG] extractLocales - Unique locales:', Array.from(uniqueLanguages));

  return uniqueLanguages;
};

module.exports = extractLocales;
