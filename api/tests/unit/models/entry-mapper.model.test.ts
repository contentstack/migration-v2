import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  default: { mkdirSync: mockMkdirSync },
}));

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn(function JSONFile(this: { path: unknown }, p: unknown) {
    this.path = p;
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: class LowWithLodash {
    adapter: unknown;
    data: unknown;
    constructor(adapter: unknown, data: unknown) {
      this.adapter = adapter;
      this.data = data;
    }
  },
}));

describe('EntryMapper factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getEntryMapperDb creates db under database/{projectId}/{iteration}', async () => {
    const getEntryMapperDb = (await import('../../../src/models/EntryMapper.js')).default;
    const db = getEntryMapperDb('proj-a', 3);
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(db).toBeDefined();
  });
});
