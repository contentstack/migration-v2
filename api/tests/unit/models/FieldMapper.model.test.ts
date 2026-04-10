import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  default: { mkdirSync: vi.fn() },
  mkdirSync: vi.fn(),
}));

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: vi.fn().mockImplementation(function (
    _adapter: unknown,
    defaultData: { field_mapper: unknown[] }
  ) {
    return {
      data: defaultData,
      chain: {},
    };
  }),
}));

describe('FieldMapper model', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export db with field_mapper array in default data', async () => {
    const getFieldMapperDb = (await import('../../../src/models/FieldMapper.js')).default;
    const fieldMapperDb = getFieldMapperDb('test-project', 1);

    expect(fieldMapperDb).toBeDefined();
    expect(fieldMapperDb.data).toBeDefined();
    expect(fieldMapperDb.data).toHaveProperty('field_mapper');
    expect(Array.isArray(fieldMapperDb.data.field_mapper)).toBe(true);
    expect(fieldMapperDb.data.field_mapper).toEqual([]);
  });

  it('should have correct default structure for FieldMapper', async () => {
    const getFieldMapperDb = (await import('../../../src/models/FieldMapper.js')).default;
    const fieldMapperDb = getFieldMapperDb('test-project', 1);

    expect(fieldMapperDb.data).toMatchObject({
      field_mapper: [],
    });
  });
});
