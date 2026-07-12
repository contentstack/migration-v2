import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';

const { DATA, LOCALE_DIR_NAME, LOCALE_MASTER_LOCALE, LOCALE_FILE_NAME } = MIGRATION_DATA_CONFIG;

const newUid = (): string => randomBytes(16).toString('hex');

export async function createLocale(
  _req: any,
  destinationStackId: string,
  _projectId: string,
  project: any,
): Promise<void> {
  const masterCode: string = project?.stackDetails?.master_locale || 'en-us';
  const localeDir = path.join(DATA, destinationStackId, LOCALE_DIR_NAME);
  await fs.promises.mkdir(localeDir, { recursive: true });
  const uid = newUid();
  await fs.promises.writeFile(
    path.join(localeDir, LOCALE_MASTER_LOCALE),
    JSON.stringify({ [uid]: { code: masterCode, fallback_locale: null, uid, name: masterCode } }, null, 4),
    'utf-8',
  );
  await fs.promises.writeFile(path.join(localeDir, LOCALE_FILE_NAME), JSON.stringify({}, null, 4), 'utf-8');
}
