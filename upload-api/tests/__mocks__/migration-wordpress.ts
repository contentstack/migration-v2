import { vi } from 'vitest';

export const extractLocale = vi.fn().mockResolvedValue([]);
export const extractContentTypes = vi.fn().mockResolvedValue(null);
export const extractEntries = vi.fn().mockResolvedValue([]);

export default {
  extractLocale,
  extractContentTypes,
  extractEntries
};
