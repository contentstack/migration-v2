import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { orgService } from '../org.service.js';

const { DATA, LOCALE_DIR_NAME, LOCALE_MASTER_LOCALE, LOCALE_FILE_NAME } = MIGRATION_DATA_CONFIG;

const newUid = (): string => randomBytes(16).toString('hex');

export async function createLocale(
  req: any,
  destinationStackId: string,
  _projectId: string,
  project: any,
): Promise<void> {
  const masterCode: string = project?.stackDetails?.master_locale || 'en-us';
  const localeDir = path.join(DATA, destinationStackId, LOCALE_DIR_NAME);
  await fs.promises.mkdir(localeDir, { recursive: true });

  // Fetch all locale names from CS so we write "English - United States" instead of
  // bare "en-us" — the CS CLI import warns and prompts interactively when the name differs.
  const localesResp = await orgService.getLocales(req);
  const localeNames: Record<string, string> = localesResp?.data?.locales ?? {};

  const masterUid = newUid();
  const masterLocaleObj = {
    [masterUid]: {
      code: masterCode,
      fallback_locale: null,
      uid: masterUid,
      name: localeNames[masterCode] ?? masterCode,
    },
  };

  // Build additional locales from the language mappings the user set up in the UI.
  // project.locales has the shape { masterLocale: { <csCode>: <datoCode> }, <csCode>: <datoCode>, ... }
  const additionalLocales: Record<string, any> = {};
  const localesObj = project?.locales ?? {};
  for (const [key, value] of Object.entries(localesObj)) {
    if (key === 'masterLocale' || typeof value !== 'string') continue;
    const uid = newUid();
    additionalLocales[uid] = {
      code: key,
      fallback_locale: masterCode,
      uid,
      name: localeNames[key] ?? key,
    };
  }

  await fs.promises.writeFile(
    path.join(localeDir, LOCALE_MASTER_LOCALE),
    JSON.stringify(masterLocaleObj, null, 4),
    'utf-8',
  );
  await fs.promises.writeFile(
    path.join(localeDir, LOCALE_FILE_NAME),
    JSON.stringify(additionalLocales, null, 4),
    'utf-8',
  );
}
