import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { Locale } from '../../models/types.js';
import { getAllLocales, getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { createDbConnection } from '../../helper/index.js';
import { v4 as uuidv4 } from 'uuid';

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
 * Maps source locale to destination locale based on user-selected mapping from UI.
 * Similar to WordPress/Contentful/Sitecore mapLocales function.
 *
 * @param masterLocale - The master locale code from the stack
 * @param locale - The source locale code from Drupal
 * @param locales - The locale mapping object from project (contains master_locale and locales)
 * @param localeMapping - The direct locale mapping from UI (optional, takes precedence)
 * @returns The mapped destination locale code
 */
export function mapDrupalLocales({
  masterLocale,
  locale,
  locales,
  localeMapping,
  sourceMasterLocale,
  destinationMasterLocale,
}: {
  masterLocale: string;
  locale: string;
  locales?: any;
  localeMapping?: Record<string, string>;
  sourceMasterLocale?: string;
  destinationMasterLocale?: string;
}): string {
  // Priority 1: Check direct locale mapping from UI (format: { "en-master_locale": "fr-fr", "es": "es-es" })
  if (localeMapping) {
    // Check if this is a master locale mapping
    const masterKey = `${locale}-master_locale`;
    if (localeMapping[masterKey]) {
      return localeMapping[masterKey];
    }

    // Check direct mapping
    if (localeMapping[locale]) {
      return localeMapping[locale];
    }
  }

  // Priority 2: Check if source locale matches master locale in mapping
  if (locales?.masterLocale?.[masterLocale] === locale) {
    return Object.keys(locales.masterLocale)?.[0] || masterLocale;
  }

  // Priority 3: Check regular locales mapping
  if (locales) {
    for (const [key, value] of Object.entries(locales)) {
      if (typeof value !== 'object' && value === locale) {
        return key;
      }
    }
  }

  // Priority 4: If this is the source master locale, map to destination master locale
  // This handles the case where user selected a custom master locale (e.g., "div-mv") in UI
  // but locale mapping wasn't saved in project.master_locale/locales
  if (
    sourceMasterLocale &&
    destinationMasterLocale &&
    locale === sourceMasterLocale
  ) {
    return destinationMasterLocale?.toLowerCase?.();
  }

  // Priority 5: Check if locale matches the destination master locale (already in correct format)
  if (
    destinationMasterLocale &&
    locale?.toLowerCase?.() === destinationMasterLocale?.toLowerCase?.()
  ) {
    return destinationMasterLocale?.toLowerCase?.();
  }

  // Priority 6: Return locale as-is (lowercase)
  return locale?.toLowerCase?.() || locale;
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
 * 3. Uses user-selected locale mapping from UI (project.localeMapping)
 * 4. Maps source locales to destination locales based on user selection
 * 5. Sets master locale based on user selection
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
    const sourceMasterLocale = masterRows[0]?.master_locale || 'en';

    // 2. Get all locales from node_field_data
    const allLocalesQuery = `
      SELECT DISTINCT langcode 
      FROM node_field_data 
      WHERE langcode IS NOT NULL AND langcode != '' 
      ORDER BY langcode
    `;

    const allLocaleRows: any = await executeQuery(allLocalesQuery);
    const sourceLocaleCodes = allLocaleRows.map((row: any) => row.langcode);

    // Close database connection
    connection.end();

    // 3. Get user-selected locale mapping from UI (project.localeMapping or project.locales/master_locale)
    // localeMapping format: { "en-master_locale": "fr-fr", "es": "es-es", ... }
    const localeMapping = project?.localeMapping || {};
    // ✅ FIX: Use LOCALE_MAPPER as fallback like WordPress does (but stackDetails.master_locale takes precedence)
    const masterLocaleFromProject = project?.master_locale || {};
    const localesFromProject = project?.locales || {};

    // 4. Fetch locale names from Contentstack API
    const [err, localesApiResponse] = await getAllLocales();
    const contentstackLocales = localesApiResponse || {}; // ✅ FIX: getAllLocales already returns the locales object

    // 5. Map source locales to destination locales using user selection
    // Find the destination master locale based on source master locale
    const masterLocaleKey = `${sourceMasterLocale}-master_locale`;
    let destinationMasterLocale =
      localeMapping[masterLocaleKey] ||
      Object.values(masterLocaleFromProject)?.[0] || // ✅ FIX: Use VALUES not KEYS!
      project?.stackDetails?.master_locale ||
      'en-us';

    // Process transformed locales first (handle und, en, en-us)
    const transformedLocales = applyLocaleTransformations(
      sourceLocaleCodes,
      sourceMasterLocale
    );

    // Map each transformed source locale to destination locale
    transformedLocales.forEach((localeInfo) => {
      const { code: sourceCode, isMaster } = localeInfo;

      // Find destination locale from mapping
      let destinationCode: string;

      if (isMaster) {
        // For master locale, use the mapped master locale
        destinationCode = destinationMasterLocale;
      } else {
        // For non-master locales, check mapping or use as-is
        destinationCode =
          localeMapping[sourceCode] ||
          localesFromProject[sourceCode] ||
          sourceCode;
      }

      // Create UID
      const uid = uuidv4();

      // Get name from Contentstack API
      const localeName =
        contentstackLocales[destinationCode] ||
        contentstackLocales[destinationCode.toLowerCase()] ||
        contentstackLocales[sourceCode] ||
        'Unknown Language';

      const newLocale: Locale = {
        code: destinationCode.toLowerCase(),
        name: localeName,
        fallback_locale: isMaster
          ? null
          : destinationMasterLocale.toLowerCase(),
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

    // 6. Write locale files (same structure as Contentful/WordPress)
    await writeFile(localeSave, LOCALE_FILE_NAME, finalAllLocales); // locales.json (non-master only)
    await writeFile(localeSave, LOCALE_MASTER_LOCALE, msLocale); // master-locale.json (master only)
    await writeFile(localeSave, LOCALE_CF_LANGUAGE, localeList); // language.json (all locales)

    const message = getLogMessage(
      srcFunc,
      `Drupal locales have been successfully transformed. Source Master: ${sourceMasterLocale}, Destination Master: ${destinationMasterLocale}, Total: ${sourceLocaleCodes.length}`,
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
