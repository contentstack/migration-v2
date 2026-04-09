import { vi } from 'vitest';

export const ExtractFiles = vi.fn().mockResolvedValue(undefined);
export const extractLocales = vi.fn().mockResolvedValue([]);
export const ExtractConfiguration = vi.fn().mockResolvedValue(undefined);
export const contentTypes = vi.fn().mockResolvedValue(undefined);
export const reference = vi.fn().mockResolvedValue({ contentTypeUids: [], path: '' });
export const extractEntries = vi.fn().mockResolvedValue([]);

export default {
  ExtractFiles,
  extractLocales,
  ExtractConfiguration,
  contentTypes,
  reference,
  extractEntries
};
