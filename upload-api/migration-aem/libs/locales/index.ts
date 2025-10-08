import path from 'path';
import read from 'fs-readdir-recursive';
import { readFiles } from '../../helper';
import { CONSTANTS } from '../../constant';

const processLocales = async (dirPath: string) => {
  const localesDir = path.resolve(dirPath);
  const localeFiles = read(localesDir);
  const damPath = path?.resolve?.(path?.join?.(localesDir, CONSTANTS.AEM_DAM_DIR));
  const allLocales: Record<string, any>[] = [];
  for await (const fileName of localeFiles) {
    const filePath = path.join(localesDir, fileName);
    if (filePath.startsWith(damPath)) {
      continue;
    }
    const localeData: any = await readFiles(filePath);
    if (localeData?.language) {
      allLocales.push(localeData?.language);
    } else if (localeData?.[":path"]) {
      const segments = localeData[":path"].split("/");
      const locale = segments[segments.length - 1];
      allLocales.push(locale);
    }
  }
  return Array.from(new Set(allLocales));
};

const locales = () => {
  return {
    processAndSave: async (dirPath: string) => {
      return await processLocales(dirPath);
    }
  };
};

export default locales;