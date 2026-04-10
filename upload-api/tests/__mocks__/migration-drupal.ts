import { vi } from 'vitest';

export const extractLocale = vi.fn().mockResolvedValue(new Set());
export const extractTaxonomy = vi.fn().mockResolvedValue(undefined);
export const createInitialMapper = vi.fn().mockResolvedValue({ contentTypes: [] });

export default {
  extractLocale,
  extractTaxonomy,
  createInitialMapper
};
