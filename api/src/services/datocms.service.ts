import { createAssets } from './datocms/assets.service.js';
import { createEntry } from './datocms/entries.service.js';
import { createLocale } from './datocms/locales.service.js';
import { createVersionFile } from './datocms/version.service.js';
import { mapFieldTypeToDataType } from './datocms/content-types.service.js';

export const datocmsService = {
  createAssets,
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
