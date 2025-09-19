import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { LOCALE_MAPPER, MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { Locale } from '../../models/types.js';
import { getAllLocales, getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { createDbConnection } from '../../helper/index.js';

const {
  DATA: MIGRATION_DATA_PATH,
  LOCALE_DIR_NAME,
  LOCALE_FILE_NAME,
  LOCALE_MASTER_LOCALE,
  LOCALE_CF_LANGUAGE,
} = MIGRATION_DATA_CONFIG;

/**
 * Writes data to a specified file, ensuring the target directory exists.
 */
async function writeFile(dirPath: string, filename: string, data: any) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error(`Error writing ${dirPath}/${filename}::`, err);
  }
}

/**
 * Helper function to get key by value from an object
 */
function getKeyByValue(
  obj: Record<string, string>,
  targetValue: string
): string | undefined {
  return Object.entries(obj).find(([_, value]) => value === targetValue)?.[0];
}

/**
 * Fetches locale names from Contentstack API
 */
async function fetchContentstackLocales(): Promise<Record<string, string>> {
  try {
    const response = await axios.get(
      'https://app.contentstack.com/api/v3/locales?include_all=true'
    );
    return response.data?.locales || {};
  } catch (error) {
    console.error('Error fetching Contentstack locales:', error);
    return {};
  }
}

/**
 * Applies special locale code transformations based on business rules
 * - "und" alone → "en-us"
 * - "und" + "en-us" → "und" become "en", "en-us" stays
 * - "en" + "und" → "und" becomes "en-us", "en" stays
 * - All three "en" + "und" + "en-us" → all three stays
 * - Apart from these, all other locales stay as is
 */
function applyLocaleTransformations(
  locales: string[],
  masterLocale: string
): { code: string; name: string; isMaster: boolean }[] {
  const hasUnd = locales.includes('und');
  const hasEn = locales.includes('en');
  const hasEnUs = locales.includes('en-us');

  // First, apply the transformation rules to get the correct locale codes
  const transformedCodes: string[] = [];

  // Start with all non-special locales (not und, en, en-us)
  const nonSpecialLocales = locales.filter(
    (locale) => !['und', 'en', 'en-us'].includes(locale)
  );
  transformedCodes.push(...nonSpecialLocales);

  // Apply transformation rules based on combinations
  if (hasEn && hasUnd && hasEnUs) {
    // Rule 4: All three "en" + "und" + "en-us" → all three stays
    transformedCodes.push('en', 'und', 'en-us');
  } else if (hasUnd && hasEnUs && !hasEn) {
    // Rule 2: "und" + "en-us" → "und" become "en", "en-us" stays
    transformedCodes.push('en', 'en-us');
  } else if (hasEn && hasUnd && !hasEnUs) {
    // Rule 3: "en" + "und" → "und" becomes "en-us", "en" stays
    transformedCodes.push('en', 'en-us');
  } else if (hasUnd && !hasEn && !hasEnUs) {
    // Rule 1: "und" alone → "en-us"
    transformedCodes.push('en-us');
  } else {
    // For any other combinations, keep locales as they are
    if (hasEn) transformedCodes.push('en');
    if (hasUnd) transformedCodes.push('und');
    if (hasEnUs) transformedCodes.push('en-us');
  }

  // Remove duplicates and sort
  const uniqueTransformedCodes = Array.from(new Set(transformedCodes)).sort();

  // Now map each transformed code to the proper format with names
  return uniqueTransformedCodes.map((code) => {
    let name = '';
    let isMaster = false;

    // Determine if this is the master locale (check against original and transformed)
    isMaster =
      code === masterLocale ||
      (masterLocale === 'und' && code === 'en-us') || // Rule 1 transformation
      (masterLocale === 'und' && hasEnUs && code === 'en') || // Rule 2 transformation
      (masterLocale === 'und' && hasEn && code === 'en-us'); // Rule 3 transformation

    // Set appropriate names
    switch (code) {
      case 'en':
        name = 'English';
        break;
      case 'en-us':
        name = 'English - United States';
        break;
      case 'und':
        name = 'Language Neutral';
        break;
      default:
        name = ''; // Will be filled from Contentstack API later
        break;
    }

    return { code: code.toLowerCase(), name, isMaster };
  });
}

/**
 * Processes and creates locale configurations from Drupal database for migration to Contentstack.
 *
 * This function:
 * 1. Fetches master locale from Drupal system.site config
 * 2. Fetches all locales from node_field_data
 * 3. Fetches non-master locales separately
 * 4. Gets locale names from Contentstack API
 * 5. Applies special transformation rules for "und", "en", "en-us"
 * 6. Creates 3 JSON files: master-locale.json, locales.json, language.json
 */
export const createLocale = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string,
  project: any
) => {
  const srcFunc = 'createLocale';
  const localeSave = path.join(
    MIGRATION_DATA_PATH,
    destination_stack_id,
    LOCALE_DIR_NAME
  );

  try {
    const msLocale: Record<string, Locale> = {};
    const allLocales: Record<string, Locale> = {};
    const localeList: Record<string, Locale> = {};

    if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
      throw new Error(
        'Invalid database configuration provided to createLocale'
      );
    }

    const connection = await createDbConnection(dbConfig);

    if (!connection) {
      throw new Error('Failed to create database connection');
    }

    // Helper function to execute queries (same pattern as entries.service.ts)
    const executeQuery = (query: string): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results as any[]);
          }
        });
      });
    };

    // 1. Get master locale from Drupal system.site config
    const masterLocaleQuery = `
      SELECT SUBSTRING_INDEX( 
        SUBSTRING_INDEX(CONVERT(data USING utf8), 'default_langcode";s:2:"', -1), 
        '"', 1 
      ) as master_locale 
      FROM config 
      WHERE name = 'system.site'
    `;

    const masterRows: any = await executeQuery(masterLocaleQuery);
    const masterLocaleCode = masterRows[0]?.master_locale || 'en';

    // 2. Get all locales from node_field_data
    const allLocalesQuery = `
      SELECT DISTINCT langcode 
      FROM node_field_data 
      WHERE langcode IS NOT NULL AND langcode != '' 
      ORDER BY langcode
    `;

    const allLocaleRows: any = await executeQuery(allLocalesQuery);
    const allLocaleCodes = allLocaleRows.map((row: any) => row.langcode);

    // 3. Get non-master locales
    const nonMasterLocalesQuery = `
      SELECT DISTINCT n.langcode
      FROM node_field_data n
      WHERE n.langcode IS NOT NULL
        AND n.langcode != ''
        AND n.langcode != (
          SELECT 
             SUBSTRING_INDEX(
                SUBSTRING_INDEX(CONVERT(data USING utf8), 'default_langcode";s:2:"', -1),
                '"',
                1
             )
          FROM config 
          WHERE name = 'system.site'
          LIMIT 1
        )
      ORDER BY n.langcode
    `;

    const nonMasterRows: any = await executeQuery(nonMasterLocalesQuery);
    const nonMasterLocaleCodes = nonMasterRows.map((row: any) => row.langcode);

    // Close database connection
    connection.end();

    // 4. Fetch locale names from Contentstack API
    const contentstackLocales = await fetchContentstackLocales();

    // 5. Apply special transformation rules
    const transformedLocales = applyLocaleTransformations(
      allLocaleCodes,
      masterLocaleCode
    );

    // 6. Process each locale
    transformedLocales.forEach((localeInfo, index) => {
      const { code, name, isMaster } = localeInfo;

      // Create UID using original langcode from database
      const originalLangcode = allLocaleCodes[index]; // Get original langcode from database
      const uid = `drupallocale_${originalLangcode
        .toLowerCase()
        .replace(/-/g, '_')}`;

      // Get name from Contentstack API or use transformed name
      const localeName =
        name ||
        contentstackLocales[code] ||
        contentstackLocales[code.toLowerCase()] ||
        'Unknown Language';

      const newLocale: Locale = {
        code: code.toLowerCase(),
        name: localeName,
        fallback_locale: isMaster ? null : masterLocaleCode.toLowerCase(),
        uid: uid,
      };

      // Add to appropriate collections using UID as key
      if (isMaster) {
        msLocale[uid] = newLocale;
      } else {
        allLocales[uid] = newLocale;
      }

      localeList[uid] = newLocale;
    });

    // Handle case where no non-master locales exist
    const finalAllLocales =
      Object.keys(allLocales).length > 0 ? allLocales : {};

    // 7. Write locale files (same structure as Contentful)
    await writeFile(localeSave, LOCALE_FILE_NAME, finalAllLocales); // locales.json (non-master only)
    await writeFile(localeSave, LOCALE_MASTER_LOCALE, msLocale); // master-locale.json (master only)
    await writeFile(localeSave, LOCALE_CF_LANGUAGE, localeList); // language.json (all locales)

    const message = getLogMessage(
      srcFunc,
      `Drupal locales have been successfully transformed. Master: ${masterLocaleCode}, Total: ${allLocaleCodes.length}, Non-master: ${nonMasterLocaleCodes.length}`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error while creating Drupal locales.`,
      {},
      err
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw err;
  }
};
