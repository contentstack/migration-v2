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

// Covers the fix for the "reference fields blank on localized entries" bug:
// entry-update-script.cjs needs entry uid-mapper data (flat + per-locale)
// threaded into the config under __entryMapping__, the same way asset uids
// already are under __assetMapping__.
describe('entry-update.utils — enrichConfigWithEntryMapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes empty old/new entry mappings when no uid-mapper files exist', async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(JSON.stringify({ page: {} }));

    const { enrichConfigWithEntryMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithEntryMapping('/tmp/config.json', 'p1', 1, '/tmp/x.log');

    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === '/tmp/config.json');
    const written = JSON.parse(String(write?.[1]));
    expect(written.__entryMapping__).toEqual({
      old: { flat: {}, byLocale: {} },
      new: { flat: {}, byLocale: {} },
    });
  });

  it('reads new-iteration entry + entryByLocale maps from uid-mapper.json', async () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('/2/uid-mapper.json'));
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('/2/uid-mapper.json')) {
        return JSON.stringify({
          entry: { 'src-a': 'cs-a' },
          entryByLocale: { 'en-in': { 'src-a': 'cs-a-in' } },
        });
      }
      return JSON.stringify({ page: {} }); // config file
    });

    const { enrichConfigWithEntryMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithEntryMapping('/tmp/config.json', 'p1', 2, '/tmp/x.log');

    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === '/tmp/config.json');
    const written = JSON.parse(String(write?.[1]));
    expect(written.__entryMapping__.new).toEqual({
      flat: { 'src-a': 'cs-a' },
      byLocale: { 'en-in': { 'src-a': 'cs-a-in' } },
    });
    expect(written.__entryMapping__.old).toEqual({ flat: {}, byLocale: {} });
  });

  it('reads both old (iteration-1) and new mappings when iteration > 1', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('/1/uid-mapper.json')) {
        return JSON.stringify({ entry: { 'src-old': 'cs-old' }, entryByLocale: {} });
      }
      if (p.includes('/2/uid-mapper.json')) {
        return JSON.stringify({ entry: { 'src-new': 'cs-new' }, entryByLocale: {} });
      }
      return JSON.stringify({ page: {} });
    });

    const { enrichConfigWithEntryMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithEntryMapping('/tmp/config.json', 'p1', 2, '/tmp/x.log');

    const write = mockWriteFileSync.mock.calls.find((c) => c[0] === '/tmp/config.json');
    const written = JSON.parse(String(write?.[1]));
    expect(written.__entryMapping__.old.flat).toEqual({ 'src-old': 'cs-old' });
    expect(written.__entryMapping__.new.flat).toEqual({ 'src-new': 'cs-new' });
  });

  it('swallows a read/parse error on the config file without throwing', async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{ not json');

    const { enrichConfigWithEntryMapping } = await import('../../../src/utils/entry-update.utils.js');
    expect(() => enrichConfigWithEntryMapping('/tmp/config.json', 'p1', 1, '/tmp/x.log')).not.toThrow();
  });
});
