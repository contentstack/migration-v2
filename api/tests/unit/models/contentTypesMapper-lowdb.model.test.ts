import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: vi.fn().mockImplementation(function (
    _adapter: unknown,
    defaultData: { ContentTypesMappers: unknown[] }
  ) {
    return {
      data: defaultData,
      chain: {},
    };
  }),
}));

describe('contentTypesMapper-lowdb model', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export db with ContentTypesMappers array in default data', async () => {
    const contentTypesDb = (await import('../../../src/models/contentTypesMapper-lowdb.js')).default;

    expect(contentTypesDb).toBeDefined();
    expect(contentTypesDb.data).toBeDefined();
    expect(contentTypesDb.data).toHaveProperty('ContentTypesMappers');
    expect(Array.isArray(contentTypesDb.data.ContentTypesMappers)).toBe(true);
    expect(contentTypesDb.data.ContentTypesMappers).toEqual([]);
  });

  it('should have correct default structure for ContentTypeMapperDocument', async () => {
    const contentTypesDb = (await import('../../../src/models/contentTypesMapper-lowdb.js')).default;

    expect(contentTypesDb.data).toMatchObject({
      ContentTypesMappers: [],
    });
  });
});
