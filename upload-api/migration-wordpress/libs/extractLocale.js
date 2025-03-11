/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');

/**
 * Extracts unique languages/locales from a WordPress exported JSON file.
 * 
 * @param {string} path - The file path to the WordPress JSON export.
 * @returns {string[]} - An array of unique language codes found in the JSON data.
 * @throws {Error} - Throws an error if the file cannot be read or parsed.
 */
const extractLocale = (path) => {
  try {
    const rawData = fs.readFileSync(path, 'utf8');
    const jsonData = JSON.parse(rawData);
    const uniqueLanguages = new Set();

    // Extract global language (if exists)
    if (jsonData.rss?.channel?.language) {
      uniqueLanguages.add(jsonData.rss.channel.language);
    }

    // Extract entry-level languages (if available)
    const items = jsonData?.rss?.channel?.item || [];
    items.forEach((item) => {
      if (item['wp:postmeta']) {
        const postMeta = Array.isArray(item['wp:postmeta']) ? item['wp:postmeta'] : [item['wp:postmeta']];
        postMeta.forEach((meta) => {
          if (meta['wp:meta_key']?.toLowerCase() === 'language' && meta['wp:meta_value']) {
            uniqueLanguages.add(meta['wp:meta_value']);
          }
        });
      }
    });

    return [...uniqueLanguages]; 
  } catch (err) {
    throw new Error(`Error reading JSON file: ${err.message}`);
  }
};


module.exports = extractLocale;
