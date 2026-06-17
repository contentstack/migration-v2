import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the delta-AEM config-enrichment helpers that the existing
// entry-update.utils.test.ts does not exercise: ensureUpdateConfigFile and
// enrichConfigWithAssetUpdates (plus an extra enrichConfigWithAssetUpdates
// failure branch). These functions only touch the filesystem.

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockAppendFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
}));

// entry-update.utils imports these at module scope; mock them so the module
// loads cleanly even though the enrich helpers don't use them.
vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: { read: vi.fn(), chain: { get: vi.fn() } },
}));
vi.mock('../../../src/models/EntryMapper.js', () => ({
  default: vi.fn(() => ({ read: vi.fn(), chain: { get: vi.fn() } })),
}));
vi.mock('../../../src/utils/sanitize-path.utils.js', () => ({
  sanitizeStackId: (id: string) => id,
  assertResolvedPathUnderBase: vi.fn(),
  getSafePath: (p: string) => p,
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    appendFileSync: mockAppendFileSync,
  },
}));

describe('entry-update.utils — ensureUpdateConfigFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the iteration dir and an empty config when none exists', async () => {
    mockExistsSync.mockReturnValue(false);
    const { ensureUpdateConfigFile } = await import('../../../src/utils/entry-update.utils.js');
    const p = ensureUpdateConfigFile('p1', 2);

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === p);
    expect(write).toBeDefined();
    expect(String(write?.[1])).toBe('{}');
    expect(p).toContain('p1');
  });

  it('does not overwrite an existing config file', async () => {
    mockExistsSync.mockReturnValue(true);
    const { ensureUpdateConfigFile } = await import('../../../src/utils/entry-update.utils.js');
    const p = ensureUpdateConfigFile('p1', 2);

    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(typeof p).toBe('string');
  });
});

describe('entry-update.utils — enrichConfigWithAssetUpdates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when there are no asset updates', async () => {
    const { enrichConfigWithAssetUpdates } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetUpdates('/tmp/config.json', []);
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('injects __assetUpdates__ into the existing config', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ page: { 'cs-1': { title: 'T' } } }));
    const updates = [{ uid: 'cs-uid-1', filePath: '/f/a1/p.jpg', filename: 'p.jpg', title: 'P' }];

    const { enrichConfigWithAssetUpdates } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetUpdates('/tmp/config.json', updates, '/tmp/x.log');

    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === '/tmp/config.json');
    expect(write).toBeDefined();
    const written = JSON.parse(String(write?.[1]));
    expect(written.__assetUpdates__).toEqual(updates);
    // existing entry data is preserved
    expect(written.page).toEqual({ 'cs-1': { title: 'T' } });
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('swallows a read/parse error without writing', async () => {
    mockReadFileSync.mockReturnValue('{ not json');
    const updates = [{ uid: 'cs-uid-1', filePath: '/f', filename: 'p.jpg', title: 'P' }];

    const { enrichConfigWithAssetUpdates } = await import('../../../src/utils/entry-update.utils.js');
    expect(() => enrichConfigWithAssetUpdates('/tmp/config.json', updates)).not.toThrow();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe('entry-update.utils — enrichConfigWithAssetMapping (extra branches)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes empty old/new mappings when no uid-mapper files exist', async () => {
    mockExistsSync.mockReturnValue(false); // no old or new uid-mapper
    mockReadFileSync.mockReturnValue(JSON.stringify({ page: {} }));

    const { enrichConfigWithAssetMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetMapping('/tmp/config.json', 'p1', 2, '/tmp/x.log');

    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === '/tmp/config.json');
    const written = JSON.parse(String(write?.[1]));
    expect(written.__assetMapping__).toEqual({ old: {}, new: {} });
  });
});
