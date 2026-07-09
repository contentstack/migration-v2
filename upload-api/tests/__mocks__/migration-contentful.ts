import { vi } from 'vitest';

export const extractLocale = vi.fn().mockResolvedValue([]);
export const extractContentTypes = vi.fn().mockResolvedValue(undefined);
export const createInitialMapper = vi.fn().mockResolvedValue({ contentTypes: [] });
export const extractTaxonomy = vi.fn().mockResolvedValue(undefined);
export const extractAssets = vi.fn().mockReturnValue([]);
