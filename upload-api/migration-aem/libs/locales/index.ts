import path from 'path';
import read from 'fs-readdir-recursive';
import { readFiles } from '../../helper';

const processLocales = async (dirPath: string) => {
  const localesDir = path.resolve(dirPath);
  const localeFiles = read(localesDir);
  const allLocales: Record<string, any>[] = [];
  for await (const fileName of localeFiles) {
    const filePath = path.join(localesDir, fileName);
    const localeData: any = await readFiles(filePath);
    if (localeData?.language) {
      allLocales.push(localeData?.language);
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