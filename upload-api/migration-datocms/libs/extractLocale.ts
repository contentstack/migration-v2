import fs from 'fs';
import path from 'path';
import { resolveExportRoot, readJson } from '../utils/helper';

/**
 * Return the distinct locale codes present in the DatoCMS export.
 *
 * DatoCMS's export has no top-level `locales[]` array (unlike Contentful). Two
 * signals are combined:
 *  1. `assets.json`'s `default_field_metadata` keys — every asset carries a
 *     per-locale metadata object even when most locales are empty.
 *  2. Any record field value shaped as `{ <locale>: value, ... }` in
 *     `records.json` — catches a locale that has zero localized assets but real
 *     localized field values (a locale-extraction gap flagged in the TRD).
 */
const LOCALE_KEY = /^[a-z]{2}(-[A-Z]{2})?$/;

const extractLocale = async (filePath: string): Promise<string[]> => {
  try {
    const root = resolveExportRoot(filePath);
    const locales = new Set<string>();

    const assetsPath = path.join(root, 'assets.json');
    if (fs.existsSync(assetsPath)) {
      const assets: any[] = readJson(assetsPath);
      assets.forEach((asset) => {
        // default_field_metadata is keyed by field name (alt, title, custom_data, …),
        // with locale codes one level deeper: { alt: { en: null, de: null }, … }
        Object.values(asset?.default_field_metadata ?? {}).forEach((fieldMeta) => {
          if (fieldMeta && typeof fieldMeta === 'object' && !Array.isArray(fieldMeta)) {
            Object.keys(fieldMeta).filter((k) => LOCALE_KEY.test(k)).forEach((k) => locales.add(k));
          }
        });
      });
    }

    const recordsPath = path.join(root, 'records.json');
    if (fs.existsSync(recordsPath)) {
      const records: any[] = readJson(recordsPath);
      records.forEach((record) => {
        Object.values(record).forEach((value) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const keys = Object.keys(value);
            if (keys.length && keys.every((k) => LOCALE_KEY.test(k))) {
              keys.forEach((k) => locales.add(k));
            }
          }
        });
      });
    }

    if (locales.size === 0) locales.add('en'); // fallback master locale
    return [...locales];
  } catch (err: any) {
    throw new Error(`Error reading DatoCMS export: ${err.message}`);
  }
};

export default extractLocale;
