import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const {
  mockExistsSync,
  mockReadFile,
  mockReaddir,
  mockUpsertAudit,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockUpsertAudit: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    promises: { readFile: mockReadFile, readdir: mockReaddir },
  },
  existsSync: mockExistsSync,
  promises: { readFile: mockReadFile, readdir: mockReaddir },
}));

vi.mock('../../../src/models/audit-lowdb.js', () => ({
  default: { upsertAudit: mockUpsertAudit },
}));

describe('audit.service', () => {
  // Path inside the allowlist used by assertExportPathInAllowedRoot.
  const base = path.join(process.cwd(), 'export-stack', 'test-audit');
  const assetsDir = path.join(base, 'assets');
  const assetsJson = path.join(assetsDir, 'assets.json');
  const entriesDir = path.join(base, 'entries');
  const ctDir = path.join(base, 'content_types');
  const gfDir = path.join(base, 'global_fields');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertAudit.mockResolvedValue({});
  });

  it('generates audit data covering all detection paths', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      // shard files & global_fields dir
      return p === path.join(assetsDir, 'shard-1.json') || p === gfDir;
    });

    mockReadFile.mockImplementation((p: string) => {
      if (p === assetsJson) {
        return Promise.resolve(JSON.stringify({ '0': 'shard-1.json' }));
      }
      if (p === path.join(assetsDir, 'shard-1.json')) {
        return Promise.resolve(
          JSON.stringify([
            {
              uid: 'asset_used',
              filename: 'a.jpg',
              publish_details: [{ env: 'p' }],
            },
            { uid: 'asset_unused', filename: 'b.jpg' },
          ])
        );
      }
      if (p === path.join(entriesDir, 'ct_with_entry', 'en-us', 'en-us-entries.json')) {
        return Promise.resolve(
          JSON.stringify({
            entry1: {
              title: 'Hello',
              publish_details: [{ env: 'p' }],
              body: 'refers to asset_used',
              gf_ref: '"reference_to":"gf_used"',
            },
            entry2: {
              name: 'Draft',
              // unpublished
            },
          })
        );
      }
      if (p === path.join(ctDir, 'ct_with_entry.json')) {
        return Promise.resolve(JSON.stringify({ uid: 'ct_with_entry', title: 'CT With' }));
      }
      if (p === path.join(ctDir, 'ct_empty.json')) {
        return Promise.resolve(JSON.stringify({ uid: 'ct_empty', title: 'CT Empty' }));
      }
      if (p === path.join(gfDir, 'globals.json')) {
        return Promise.resolve(
          JSON.stringify([
            { uid: 'gf_used', title: 'Used', schema: [{ uid: 'x' }] },
            { uid: 'gf_unused', title: 'Unused', schema: [] },
          ])
        );
      }
      if (p === path.join(gfDir, 'single.json')) {
        return Promise.resolve(JSON.stringify({ uid: 'gf_single', title: 'Single' }));
      }
      return Promise.resolve('{}');
    });

    mockReaddir.mockImplementation((p: string, opts?: any) => {
      if (p === entriesDir && opts?.withFileTypes) {
        return Promise.resolve([
          { name: 'ct_with_entry', isDirectory: () => true },
          { name: 'file.txt', isDirectory: () => false },
        ]);
      }
      if (p === path.join(entriesDir, 'ct_with_entry') && opts?.withFileTypes) {
        return Promise.resolve([
          { name: 'en-us', isDirectory: () => true },
          { name: 'not-a-dir', isDirectory: () => false },
        ]);
      }
      if (p === path.join(entriesDir, 'ct_with_entry', 'en-us')) {
        return Promise.resolve(['en-us-entries.json', 'index.json', 'skip.txt']);
      }
      if (p === ctDir) {
        return Promise.resolve(['schema.json', 'ct_with_entry.json', 'ct_empty.json']);
      }
      if (p === gfDir) {
        return Promise.resolve(['globals.json', 'single.json', 'skip.txt']);
      }
      return Promise.resolve([]);
    });

    const { generateAuditData } = await import(
      '../../../src/services/audit.service.js'
    );
    const result = await generateAuditData({
      projectId: 'p1',
      orgId: 'o1',
      stackId: 's1',
      exportPath: base,
      region: 'US',
    });

    expect(result.summary).toBeDefined();
    expect(result.summary.unused_assets).toBe(1); // asset_unused
    expect(result.summary.unpublished_entries).toBe(1); // entry2
    expect(result.summary.empty_content_types).toBe(1); // ct_empty
    // gf_unused + gf_single (gf_single never referenced)
    expect(result.summary.unused_global_fields).toBeGreaterThanOrEqual(1);
    expect(mockUpsertAudit).toHaveBeenCalledTimes(1);
    const arg = mockUpsertAudit.mock.calls[0][0];
    expect(arg.project_id).toBe('p1');
    expect(arg.org_id).toBe('o1');
    expect(arg.stack_id).toBe('s1');
  });

  it('handles missing global_fields dir gracefully', async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFile.mockImplementation((p: string) => {
      if (p === assetsJson) return Promise.resolve('{}');
      return Promise.resolve('{}');
    });
    mockReaddir.mockImplementation((p: string, opts?: any) => {
      if (p === entriesDir && opts?.withFileTypes) return Promise.resolve([]);
      if (p === ctDir) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const { generateAuditData } = await import(
      '../../../src/services/audit.service.js'
    );
    const result = await generateAuditData({
      projectId: 'p2',
      orgId: 'o',
      stackId: 's',
      exportPath: base,
    });
    expect(result.summary.unused_global_fields).toBe(0);
    expect(result.summary.unused_assets).toBe(0);
    expect(result.summary.unpublished_entries).toBe(0);
    expect(result.summary.empty_content_types).toBe(0);
  });

  it('uses EU region URL when region is EU', async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(assetsDir, 'sh.json')
    );
    mockReadFile.mockImplementation((p: string) => {
      if (p === assetsJson) return Promise.resolve(JSON.stringify({ '0': 'sh.json' }));
      if (p === path.join(assetsDir, 'sh.json'))
        return Promise.resolve(JSON.stringify({ k: { uid: 'aEU', filename: 'x' } }));
      return Promise.resolve('{}');
    });
    mockReaddir.mockImplementation((p: string, opts?: any) => {
      if (p === entriesDir && opts?.withFileTypes) return Promise.resolve([]);
      if (p === ctDir) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { generateAuditData } = await import(
      '../../../src/services/audit.service.js'
    );
    const result = await generateAuditData({
      projectId: 'p3',
      orgId: 'o',
      stackId: 'stackEU',
      exportPath: base,
      region: 'EU',
    });
    expect(result.assets[0].url).toContain('eu-app.contentstack.com');
  });

  it('skips asset shards that do not exist on disk', async () => {
    mockExistsSync.mockReturnValue(false); // shard not found
    mockReadFile.mockImplementation((p: string) => {
      if (p === assetsJson)
        return Promise.resolve(JSON.stringify({ '0': 'missing.json' }));
      return Promise.resolve('{}');
    });
    mockReaddir.mockImplementation((p: string, opts?: any) => {
      if (p === entriesDir && opts?.withFileTypes) return Promise.resolve([]);
      if (p === ctDir) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { generateAuditData } = await import(
      '../../../src/services/audit.service.js'
    );
    const result = await generateAuditData({
      projectId: 'p4',
      orgId: 'o',
      stackId: 's',
      exportPath: base,
    });
    expect(result.assets).toEqual([]);
  });

  it('handles array asset container, single-object global field, and entry with no title fields', async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === path.join(assetsDir, 'sh.json') || p === gfDir
    );
    mockReadFile.mockImplementation((p: string) => {
      if (p === assetsJson)
        return Promise.resolve(JSON.stringify({ '0': 'sh.json' }));
      if (p === path.join(assetsDir, 'sh.json'))
        return Promise.resolve(
          JSON.stringify([{ uid: 'a1', filename: 'a.jpg' }])
        );
      if (p === path.join(entriesDir, 'ct1', 'en-us', 'en-us-entries.json')) {
        return Promise.resolve(
          JSON.stringify({ longuiduid12345678: { foo: 'bar' } })
        );
      }
      if (p === path.join(ctDir, 'ct1.json'))
        return Promise.resolve(JSON.stringify({ title: 'CT1' })); // no uid → fallback
      if (p === path.join(gfDir, 'one.json'))
        return Promise.resolve(JSON.stringify({ uid: 'gf_one' })); // single object branch
      return Promise.resolve('{}');
    });
    mockReaddir.mockImplementation((p: string, opts?: any) => {
      if (p === entriesDir && opts?.withFileTypes)
        return Promise.resolve([{ name: 'ct1', isDirectory: () => true }]);
      if (p === path.join(entriesDir, 'ct1') && opts?.withFileTypes)
        return Promise.resolve([{ name: 'en-us', isDirectory: () => true }]);
      if (p === path.join(entriesDir, 'ct1', 'en-us'))
        return Promise.resolve(['en-us-entries.json']);
      if (p === ctDir) return Promise.resolve(['ct1.json']);
      if (p === gfDir) return Promise.resolve(['one.json']);
      return Promise.resolve([]);
    });
    const { generateAuditData } = await import(
      '../../../src/services/audit.service.js'
    );
    const result = await generateAuditData({
      projectId: 'p5',
      orgId: 'o',
      stackId: 's',
      exportPath: base,
    });
    // entry has no title/name/label → fallback title used
    expect(result.entries[0].title).toContain('ct1_');
    // single object global field included
    expect(result.global_fields.some((g) => g.uid === 'gf_one')).toBe(true);
    // ct1 had 1 entry → not in unused list (which is what we surface)
    expect(result.content_types.some((c) => c.uid === 'ct1')).toBe(false);
    expect(result.entries[0].contentType).toBe('ct1');
  });
});
