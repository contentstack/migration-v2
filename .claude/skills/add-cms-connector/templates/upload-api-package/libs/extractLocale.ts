import fs from 'fs';

/**
 * Return the distinct locale codes present in the source export.
 *
 * ADAPT to the real export shape. Examples:
 *  - WordPress (XML→JSON): rss.channel.language + wp:postmeta language keys
 *  - Sanity / JSON: a top-level `_lang`, `locale`, or `__i18n_lang` on each document
 *  - If the CMS is single-locale, return the master locale (e.g. ['en-us']).
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const locales = new Set<string>();

    // TODO: replace with the real locale-bearing field(s) from the sample export.
    const documents: any[] = Array.isArray(data) ? data : data?.documents ?? [];
    documents.forEach((doc: any) => {
      const lang = doc?.locale ?? doc?._lang ?? doc?.__i18n_lang;
      if (lang) locales.add(lang);
    });

    if (locales.size === 0) locales.add('en-us'); // fallback master locale
    return [...locales];
  } catch (err: any) {
    throw new Error(`Error reading source export: ${err.message}`);
  }
};

export default extractLocale;
