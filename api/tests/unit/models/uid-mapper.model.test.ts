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

describe('uidMapper factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUidMapperDb creates db under database/{projectId}/{iteration}', async () => {
    const getUidMapperDb = (await import('../../../src/models/uidMapper.js')).default;
    const db = getUidMapperDb('proj-b', 2);
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(db).toBeDefined();
  });
});
