import { vi } from 'vitest';

export const extractLocale = vi.fn().mockResolvedValue([]);
export const extractContentTypes = vi.fn().mockResolvedValue(undefined);
export const createInitialMapper = vi.fn().mockResolvedValue({ contentTypes: [] });
export const extractEntries = vi.fn().mockResolvedValue([]);

export default {
  extractLocale,
  extractContentTypes,
  createInitialMapper,
  extractEntries
};
