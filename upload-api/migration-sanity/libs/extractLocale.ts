import { findDataFile, readNdjson } from '../utils/helper';

/**
 * Return the distinct locale codes present in the Sanity export.
 *
 * Sanity encodes localization either at the document level (`language` /
 * `__i18n_lang` from @sanity/document-internationalization) or per field.
 * If no locale markers are present the dataset is single-locale, so we fall
 * back to the master locale.
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const dataFile = findDataFile(filePath);
    const documents = readNdjson(dataFile);
    const locales = new Set<string>();

    documents.forEach((doc: any) => {
      const lang = doc?.language ?? doc?.__i18n_lang ?? doc?.locale;
      if (lang && typeof lang === 'string') locales.add(lang);
    });

    if (locales.size === 0) locales.add('en-us'); // fallback master locale
    return [...locales];
  } catch (err: any) {
    throw new Error(`Error reading Sanity export: ${err.message}`);
  }
};

export default extractLocale;
