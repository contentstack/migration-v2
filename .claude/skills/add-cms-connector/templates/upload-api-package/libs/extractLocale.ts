import { findDataFile, readNdjson } from '../utils/helper';
import fs from 'fs';

/**
 * Return the distinct locale codes present in the source export.
 *
 * STEP 1 — identify your export SHAPE and read accordingly:
 *   - JSON array / object  → `JSON.parse(fs.readFileSync(file, 'utf8'))`
 *   - NDJSON (one doc/line) → `readNdjson(file)`   (e.g. Sanity data.ndjson)
 *   - folder of files       → walk the dir, read each (see findDataFile)
 *   - database (e.g. Drupal)→ run a query instead of reading a file
 *
 * `filePath` may be a FILE or a DIRECTORY (archive/folder uploads pass the
 * extracted directory — see reference/upload-flow.md). `findDataFile` resolves
 * the directory to the actual data file; change its `targetName`/`targetExt`
 * to match your CMS, or read the file directly if you always get one.
 *
 * STEP 2 — pull the locale-bearing field(s). Examples:
 *   - WordPress (XML→JSON): rss.channel.language
 *   - Sanity / NDJSON: doc.__i18n_lang / doc.language (document i18n plugin)
 *   - single-locale CMS: return the master locale (e.g. ['en-us']).
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const dataFile = findDataFile(filePath); // adapt targetName for your CMS

    // Choose ONE read strategy for your export shape:
    const documents: any[] = readNdjson(dataFile);
    // const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    // const documents: any[] = Array.isArray(parsed) ? parsed : parsed?.documents ?? [];

    const locales = new Set<string>();
    documents.forEach((doc: any) => {
      const lang = doc?.language ?? doc?.__i18n_lang ?? doc?.locale;
      if (lang && typeof lang === 'string') locales.add(lang);
    });

    if (locales.size === 0) locales.add('en-us'); // fallback master locale
    return [...locales];
  } catch (err: any) {
    throw new Error(`Error reading source export: ${err.message}`);
  }
};

export default extractLocale;
