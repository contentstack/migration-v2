import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: vi.fn().mockImplementation(function (
    _adapter: unknown,
    defaultData: { users: unknown[] }
  ) {
    return {
      data: defaultData,
      chain: {},
    };
  }),
}));

describe('authentication model', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export db with users array in default data', async () => {
    const authDb = (await import('../../../src/models/authentication.js')).default;

    expect(authDb).toBeDefined();
    expect(authDb.data).toBeDefined();
    expect(authDb.data).toHaveProperty('users');
    expect(Array.isArray(authDb.data.users)).toBe(true);
    expect(authDb.data.users).toEqual([]);
  });

  it('should have correct default structure for AuthenticationDocument', async () => {
    const authDb = (await import('../../../src/models/authentication.js')).default;

    expect(authDb.data).toMatchObject({
      users: [],
    });
  });
});
