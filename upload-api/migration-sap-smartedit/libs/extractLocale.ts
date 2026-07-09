import { readMacrosFromPath } from '../utils/helper';

/**
 * Return the distinct locale codes present in the ImpEx export.
 *
 * `filePath` may be a single `.impex` file OR an export folder. SAP ImpEx
 * declares the working language via a `$lang = <code>` macro; v1 reads it and
 * maps it to a Contentstack master locale (`en` -> `en-us`), falling back to
 * `en-us`. Per-column `[lang=xx]` localization is a documented follow-up.
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const macros = readMacrosFromPath(filePath);
    const lang = macros['lang'];
    if (!lang) return ['en-us'];
    return [lang.toLowerCase() === 'en' ? 'en-us' : lang.toLowerCase()];
  } catch (err: any) {
    throw new Error(`Error reading source export: ${err.message}`);
  }
};

export default extractLocale;
