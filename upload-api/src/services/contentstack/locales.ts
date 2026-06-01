import fs from 'fs';
import path from 'path';

const requiredExportPaths = [
  'content_types/schema.json',
  'entries',
  'assets',
  'global_fields',
  'locales/locales.json'
];

const hasAllRequired = (base: string): boolean =>
  requiredExportPaths.every((rel) => fs.existsSync(path.join(base, rel)));

export const resolveContentstackExportRoot = (exportPath: string): string | null => {
  if (!exportPath || !fs.existsSync(exportPath)) {
    return null;
  }

  if (hasAllRequired(exportPath)) {
    return exportPath;
  }

  try {
    const dirents = fs.readdirSync(exportPath, { withFileTypes: true });
    const dirNames = dirents?.filter((d) => d?.isDirectory())?.map((d) => d?.name);
    const preferredOrder = ['main', 'master', 'production', 'develop'];
    const ordered = [
      ...preferredOrder.filter((n) => dirNames.includes(n)),
      ...dirNames.filter((n) => !preferredOrder.includes(n)).sort()
    ];

    for (const name of ordered) {
      const candidate = path.join(exportPath, name);
      if (hasAllRequired(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const extractContentstackLocales = async (exportPath: string) => {
  try {
    const masterLocalePath = path.join(exportPath, 'locales', 'master-locale.json');
    const localesPath = path.join(exportPath, 'locales', 'locales.json');

    const masterLocaleRaw = await fs.promises.readFile(masterLocalePath, 'utf8');
    const masterLocales = JSON.parse(masterLocaleRaw || '{}');

    let additionalLocales = {};
    try {
      const localesRaw = await fs.promises.readFile(localesPath, 'utf8');
      additionalLocales = JSON.parse(localesRaw || '{}');
    } catch {
      // locales.json may be missing
    }

    const allLocales = { ...masterLocales, ...additionalLocales };

    return Object.values(allLocales)?.map((locale: any) => ({
      label: `${locale?.name} (${locale?.code})`,
      value: locale?.code,
      uid: locale?.uid,
      code: locale?.code,
      name: locale?.name
    }));
  } catch (error) {
    console.error('Error extracting Contentstack locales:', error);
    return [
      {
        label: 'English - United States (en-us)',
        value: 'en-us',
        uid: 'default',
        code: 'en-us',
        name: 'English - United States'
      }
    ];
  }
};
