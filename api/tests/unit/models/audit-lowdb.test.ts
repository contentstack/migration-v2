import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockExistsSync,
  mockMkdirSync,
  mockWriteFileSync,
  mockRmSync,
  mockReadFile,
  mockWriteFile,
  mockLowRead,
  mockLowWrite,
  lowInstance,
} = vi.hoisted(() => {
  const lowInstance: any = { data: { projects: [] }, read: vi.fn(), write: vi.fn() };
  return {
    mockExistsSync: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockRmSync: vi.fn(),
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn(),
    mockLowRead: lowInstance.read,
    mockLowWrite: lowInstance.write,
    lowInstance,
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    rmSync: mockRmSync,
    promises: { readFile: mockReadFile, writeFile: mockWriteFile },
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  rmSync: mockRmSync,
  promises: { readFile: mockReadFile, writeFile: mockWriteFile },
}));

vi.mock('lowdb/node', () => ({
  JSONFile: vi.fn().mockImplementation(function (this: unknown) {
    return {};
  }),
}));

vi.mock('../../../src/utils/lowdb-lodash.utils.js', () => ({
  default: vi.fn().mockImplementation(function (_adapter: unknown, defaultData: any) {
    lowInstance.data = defaultData;
    return lowInstance;
  }),
}));

describe('audit-lowdb model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lowInstance.data = { projects: [] };
    mockLowRead.mockResolvedValue(undefined);
    mockLowWrite.mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(false);
    mockReadFile.mockResolvedValue('{}');
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('upsertAudit creates a new project entry with data_counts', async () => {
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.upsertAudit({
      project_id: 'p1',
      org_id: 'o1',
      stack_id: 's1',
      assets: [{ uid: 'a1' }, { uid: 'a2' }],
      content_types: [{ uid: 'ct1' }],
      entries: [{ uid: 'e1' }],
      global_fields: [{ uid: 'gf1' }],
    });

    expect(result.project_id).toBe('p1');
    expect(result.org_id).toBe('o1');
    expect(result.stack_id).toBe('s1');
    expect(result.data_counts.assets).toBe(2);
    expect(result.data_counts.content_types).toBe(1);
    expect(result.data_counts.entries).toBe(1);
    expect(result.data_counts.global_fields).toBe(1);
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockLowWrite).toHaveBeenCalled();
  });

  it('upsertAudit updates an existing project (no duplicate creation)', async () => {
    lowInstance.data = {
      projects: [
        {
          project_id: 'p1',
          org_id: 'old-org',
          stack_id: 'old-stack',
          created_at: 'past',
          updated_at: 'past',
          data_counts: { assets: 0, content_types: 0, entries: 0, global_fields: 0 },
        },
      ],
    };
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.upsertAudit({
      project_id: 'p1',
      org_id: 'new-org',
      stack_id: 'new-stack',
      assets: [],
    });
    expect(result.org_id).toBe('new-org');
    expect(result.stack_id).toBe('new-stack');
    expect(lowInstance.data.projects.length).toBe(1);
  });

  it('upsertAudit retains existing org/stack if new values empty', async () => {
    lowInstance.data = {
      projects: [
        {
          project_id: 'p1',
          org_id: 'keep-org',
          stack_id: 'keep-stack',
          created_at: 'past',
          updated_at: 'past',
          data_counts: { assets: 0, content_types: 0, entries: 0, global_fields: 0 },
        },
      ],
    };
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.upsertAudit({
      project_id: 'p1',
      org_id: '',
      stack_id: '',
    });
    expect(result.org_id).toBe('keep-org');
    expect(result.stack_id).toBe('keep-stack');
  });

  it('writeSharded removes prior shard files when existing index has entries', async () => {
    // Provide existing index for assets so removal branch fires
    mockExistsSync.mockImplementation((p: string) => {
      // First call: index.json exists check in ensureProjectDir (we want to skip writes)
      // We want existing index for type "assets" to return content
      return p.endsWith('index.json') || p.endsWith('assets-1.json');
    });
    mockReadFile.mockImplementation((p: string) => {
      if (p.includes('assets') && p.endsWith('index.json')) {
        return Promise.resolve(
          JSON.stringify({ '0': { file: 'assets-1.json', uids: ['old'] } })
        );
      }
      return Promise.resolve('{}');
    });
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    await auditDb.upsertAudit({
      project_id: 'p2',
      org_id: 'o',
      stack_id: 's',
      assets: [{ uid: 'a1' }],
    });
    expect(mockRmSync).toHaveBeenCalled();
  });

  it('getAuditByProjectId returns null when project not found', async () => {
    lowInstance.data = { projects: [] };
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.getAuditByProjectId('missing');
    expect(result).toBeNull();
  });

  it('getAuditByProjectId returns metadata plus arrays when found', async () => {
    lowInstance.data = {
      projects: [
        {
          project_id: 'p1',
          org_id: 'o',
          stack_id: 's',
          created_at: 'x',
          updated_at: 'x',
          data_counts: { assets: 1, content_types: 0, entries: 0, global_fields: 0 },
        },
      ],
    };
    mockExistsSync.mockImplementation((p: string) =>
      p.endsWith('index.json') || p.endsWith('assets-1.json')
    );
    mockReadFile.mockImplementation((p: string) => {
      if (p.includes('assets') && p.endsWith('index.json')) {
        return Promise.resolve(
          JSON.stringify({ '0': { file: 'assets-1.json', uids: ['a1'] } })
        );
      }
      if (p.endsWith('assets-1.json')) {
        return Promise.resolve(JSON.stringify([{ uid: 'a1' }]));
      }
      return Promise.resolve('{}');
    });
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.getAuditByProjectId('p1');
    expect(result?.metadata.project_id).toBe('p1');
    expect(result?.assets).toEqual([{ uid: 'a1' }]);
    expect(result?.content_types).toEqual([]);
  });

  it('getDataByType handles missing index (returns empty)', async () => {
    mockExistsSync.mockReturnValue(false);
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    const result = await auditDb.getDataByType('nope', 'assets' as any);
    expect(result).toEqual([]);
  });

  it('getDataByType handles items that are strings or have entryUid/id', async () => {
    // Exercises getUid branches through writeSharded when constructing uids
    const auditDb = (await import('../../../src/models/audit-lowdb.js')).default;
    await auditDb.upsertAudit({
      project_id: 'pBranches',
      org_id: 'o',
      stack_id: 's',
      assets: ['str-uid' as any, { entryUid: 'e1' }, { id: 'i1' }, { other: true }],
    });
    // The writeFile call for the index should contain those uids
    const indexWriteCall = mockWriteFile.mock.calls.find(
      (c) => String(c[0]).includes('assets') && String(c[0]).endsWith('index.json')
    );
    expect(indexWriteCall).toBeDefined();
    const indexJson = JSON.parse(String(indexWriteCall![1]));
    expect(indexJson['0'].uids).toContain('str-uid');
    expect(indexJson['0'].uids).toContain('e1');
    expect(indexJson['0'].uids).toContain('i1');
  });
});
