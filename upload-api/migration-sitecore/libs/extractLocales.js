/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const uniqueLanguages = new Set(); // Define uniqueLanguages globally or pass it as a parameter

const extractLocales = (dir) => {
  const items = fs?.readdirSync?.(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path?.join?.(dir, item?.name);

    if (item?.isDirectory()) {
      extractLocales?.(fullPath); // Proper recursion
    } else if (item?.isFile() && item?.name === 'data.json') {
      try {
        const rawData = fs?.readFileSync?.(fullPath, 'utf8');
        const jsonData = JSON?.parse?.(rawData);
        const language = jsonData?.item?.$?.language;

        if (language) {
          uniqueLanguages?.add?.(language);
        }
      } catch (error) {
        console.error(`Error reading ${fullPath}:`, error?.message);
      }
    }
  }
  return uniqueLanguages;
};

module.exports = extractLocales;
