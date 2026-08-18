import { parseImpexPath } from '../utils/helper';

/**
 * Map a SAP ImpEx language code (`$lang = xx` or a `[lang=xx]` column modifier)
 * to a Contentstack locale code. SAP codes are bare ISO 639-1 (`en`, `de`, `fr`);
 * Contentstack needs a language-region code. Common languages are mapped
 * explicitly; anything else falls back to `<code>-<code>` — a documented guess,
 * not authoritative (wrong for e.g. `zh` -> `zh-cn`, `ja` -> `ja-jp`).
 * Duplicated in api/src/services/sap-smartedit.service.ts — that side has no
 * cross-package dependency on upload-api, by existing convention.
 */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-us', de: 'de-de', fr: 'fr-fr', es: 'es-es', it: 'it-it',
  pt: 'pt-pt', nl: 'nl-nl', ja: 'ja-jp', zh: 'zh-cn', ko: 'ko-kr',
  ru: 'ru-ru', pl: 'pl-pl', sv: 'sv-se', da: 'da-dk', fi: 'fi-fi',
  nb: 'nb-no', tr: 'tr-tr', ar: 'ar-sa', hi: 'hi-in', th: 'th-th',
};
const toContentstackLocale = (code: string): string => {
  const c = code.trim().toLowerCase();
  return LOCALE_MAP[c] ?? `${c}-${c}`;
};

/**
 * Return every distinct locale genuinely present in the ImpEx export.
 *
 * `filePath` may be a single `.impex` file OR an export folder. The catalog's
 * declared working language (`$lang = <code>`) is always first — the master/
 * default locale, falling back to `en-us` if undeclared. Any additional
 * languages found on real per-field-localized columns (`title[lang=de]`, etc.)
 * follow, so genuinely localized content gets its own destination locale
 * created for it rather than being collapsed into the master locale.
 */
const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const { macros, blocks } = parseImpexPath(filePath);

    const primary = macros['lang'] ? toContentstackLocale(macros['lang']) : 'en-us';

    const others = new Set<string>();
    for (const block of blocks.values()) {
      for (const col of block.columns.values()) {
        for (const l of col.locales) others.add(toContentstackLocale(l));
      }
    }
    others.delete(primary);

    return [primary, ...[...others].sort()];
  } catch (err: any) {
    throw new Error(`Error reading source export: ${err.message}`);
  }
};

export default extractLocale;
