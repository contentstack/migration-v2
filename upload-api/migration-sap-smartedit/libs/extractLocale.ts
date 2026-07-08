import fs from 'fs';
import { parseMacros } from '../utils/helper';

/**
 * Return the distinct locale codes present in the ImpEx export.
 *
 * SAP ImpEx declares the working language via a `$lang = <code>` macro, and
 * localized columns use a `[lang=xx]` modifier. v1 reads the `$lang` macro and
 * maps it to a Contentstack master locale (`en` -> `en-us`), falling back to
 * `en-us`. Per-column `[lang=xx]` localization is a documented follow-up.
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const macros = parseMacros(raw);
    const lang = macros['lang'];
    if (!lang) return ['en-us'];
    return [lang.toLowerCase() === 'en' ? 'en-us' : lang.toLowerCase()];
  } catch (err: any) {
    throw new Error(`Error reading source export: ${err.message}`);
  }
};

export default extractLocale;
