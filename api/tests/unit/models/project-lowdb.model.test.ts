import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: vi.fn().mockImplementation(function (
    _adapter: unknown,
    defaultData: { projects: unknown[] }
  ) {
    return {
      data: defaultData,
      chain: {},
    };
  }),
}));

describe('project-lowdb model', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export db with projects array in default data', async () => {
    const projectDb = (await import('../../../src/models/project-lowdb.js')).default;

    expect(projectDb).toBeDefined();
    expect(projectDb.data).toBeDefined();
    expect(projectDb.data).toHaveProperty('projects');
    expect(Array.isArray(projectDb.data.projects)).toBe(true);
    expect(projectDb.data.projects).toEqual([]);
  });

  it('should have correct default structure for ProjectDocument', async () => {
    const projectDb = (await import('../../../src/models/project-lowdb.js')).default;

    expect(projectDb.data).toMatchObject({
      projects: [],
    });
  });
});
