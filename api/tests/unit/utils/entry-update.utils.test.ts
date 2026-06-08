import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockProjectRead,
  mockChainGet,
  mockEntryRead,
  mockEntryChainGet,
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockReaddirSync,
  mockAppendFileSync,
  mockRmSync,
  mockSanitizeStackId,
  mockAssertResolvedPathUnderBase,
} = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockChainGet: vi.fn(),
  mockEntryRead: vi.fn(),
  mockEntryChainGet: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockSanitizeStackId: vi.fn(),
  mockAssertResolvedPathUnderBase: vi.fn(),
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockChainGet },
  },
}));

vi.mock('../../../src/models/EntryMapper.js', () => ({
  default: vi.fn(() => ({
    read: mockEntryRead,
    chain: { get: mockEntryChainGet },
  })),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    appendFileSync: mockAppendFileSync,
    readdirSync: mockReaddirSync,
    rmSync: mockRmSync,
  },
}));

vi.mock('../../../src/utils/sanitize-path.utils.js', () => ({
  sanitizeStackId: mockSanitizeStackId,
  assertResolvedPathUnderBase: mockAssertResolvedPathUnderBase,
  getSafePath: (p: string) => p,
}));

describe('entry-update.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockEntryRead.mockResolvedValue(undefined);
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue({
          id: 'p1',
          iteration: 1,
          destination_stack_id: 'stack1',
        }),
      }),
    });
    mockEntryChainGet.mockReturnValue({
      value: () => [
        { otherCmsEntryUid: 'legacy-key', isUpdate: true, contentstackEntryUid: 'cs-uid' },
      ],
    });
    mockSanitizeStackId.mockImplementation((id: string) => id);
    mockAssertResolvedPathUnderBase.mockReturnValue(undefined);
  });

  describe('clearStaleEntries', () => {
    it('skips cleanup and logs when stackId is invalid', async () => {
      mockSanitizeStackId.mockReturnValue('');
      const { clearStaleEntries } = await import('../../../src/utils/entry-update.utils.js');

      clearStaleEntries('../../evil', '/tmp/mig.log');

      expect(mockRmSync).not.toHaveBeenCalled();
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/mig.log',
        expect.stringContaining('Invalid stackId')
      );
    });

    it('does nothing when entries directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const { clearStaleEntries } = await import('../../../src/utils/entry-update.utils.js');

      clearStaleEntries('stack1', '/tmp/mig.log');

      expect(mockRmSync).not.toHaveBeenCalled();
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/mig.log',
        expect.stringContaining('No existing entries directory')
      );
    });

    it('removes the entries directory when it exists', async () => {
      mockExistsSync.mockReturnValue(true);
      const { clearStaleEntries } = await import('../../../src/utils/entry-update.utils.js');

      clearStaleEntries('stack1', '/tmp/mig.log');

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('entries'),
        { recursive: true, force: true }
      );
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/mig.log',
        expect.stringContaining('Cleared stale entries directory')
      );
    });
  });

  it('removeEntriesFromDatabase returns null when stackId missing', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue({ id: 'p1', iteration: 1 }),
      }),
    });
    const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
    await expect(removeEntriesFromDatabase('p1')).resolves.toBeNull();
  });

  it('removeEntriesFromDatabase returns null when no entry_mapper items', async () => {
    mockEntryChainGet.mockReturnValue({ value: () => [] });
    const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
    await expect(removeEntriesFromDatabase('p1')).resolves.toBeNull();
  });

  it('removeEntriesFromDatabase returns null when entries directory missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
    await expect(removeEntriesFromDatabase('p1')).resolves.toBeNull();
  });

  it('removeEntriesFromDatabase walks dirs, updates json, writes config', async () => {
    // entriesDir + content-type/locale dirs exist, but no index.json → glob fallback.
    mockExistsSync.mockImplementation((p: string) => !String(p).endsWith('index.json'));
    const dirent = (name: string, isDir: boolean) => ({
      name,
      isDirectory: () => isDir,
    });
    // Branch on the options arg instead of queued returns so the once-queue can't
    // leak into a later test.
    mockReaddirSync.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) => {
      if (opts?.withFileTypes) {
        return String(p).endsWith('ct1') ? [dirent('en', true)] : [dirent('ct1', true)];
      }
      return ['page.json'];
    });
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ 'legacy-key': { title: 'Hello' }, keep: { x: 1 } })
    );

    const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
    const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

    expect(result).toMatch(/updated-entries\.json$/);
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalled();
  });

  describe('removeEntriesFromDatabase index.json-driven chunk selection', () => {
    const dirent = (name: string, isDir: boolean) => ({
      name,
      isDirectory: () => isDir,
    });

    it('only processes chunk files listed in index.json (ignores stale orphans)', async () => {
      // entriesDir exists + index.json exists + the listed chunk exists
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) =>
        opts?.withFileTypes
          ? (String(p).endsWith('ct1') ? [dirent('en', true)] : [dirent('ct1', true)])
          : []
      );
      // index.json lists only current.json; orphan.json is NOT listed and must be ignored
      mockReadFileSync.mockImplementation((p: string) => {
        if (String(p).endsWith('index.json')) {
          return JSON.stringify({ '1': 'current.json' });
        }
        return JSON.stringify({ 'legacy-key': { title: 'Hello' } });
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

      expect(result).toMatch(/updated-entries\.json$/);
      // The chunk read must be the index-listed file, never the orphan.
      const readPaths = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      expect(readPaths.some((p) => p.endsWith('current.json'))).toBe(true);
      expect(readPaths.some((p) => p.endsWith('orphan.json'))).toBe(false);
    });

    it('skips the locale and logs when index.json is corrupt', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) =>
        opts?.withFileTypes
          ? (String(p).endsWith('ct1') ? [dirent('en', true)] : [dirent('ct1', true)])
          : []
      );
      mockReadFileSync.mockImplementation((p: string) => {
        if (String(p).endsWith('index.json')) return '{ not valid json';
        return JSON.stringify({ 'legacy-key': { title: 'Hello' } });
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

      // Whole step must not abort; config still written, locale skipped.
      expect(result).toMatch(/updated-entries\.json$/);
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/mig.log',
        expect.stringContaining('Failed to parse index.json')
      );
      // No chunk file was read because the locale was skipped.
      const readPaths = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      expect(readPaths.some((p) => p.endsWith('current.json'))).toBe(false);
    });

    it('skips the locale and logs when index.json is not an object', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((p: string, opts?: { withFileTypes?: boolean }) =>
        opts?.withFileTypes
          ? (String(p).endsWith('ct1') ? [dirent('en', true)] : [dirent('ct1', true)])
          : []
      );
      mockReadFileSync.mockImplementation((p: string) => {
        if (String(p).endsWith('index.json')) return JSON.stringify('a string, not an object');
        return JSON.stringify({ 'legacy-key': { title: 'Hello' } });
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

      expect(result).toMatch(/updated-entries\.json$/);
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        '/tmp/mig.log',
        expect.stringContaining('is not an object')
      );
    });

    // readdirSync is called two ways: `{ withFileTypes: true }` for the dir walks
    // (content-type dirs, then locale dirs) and with no options for the glob fallback.
    // Branch on the options arg so call ordering can't desync the mocks.
    const dirWalkImpl = (globResult: string[] = ['page.json', 'index.json']) =>
      (p: string, opts?: { withFileTypes?: boolean }) => {
        if (opts?.withFileTypes) {
          return String(p).endsWith('ct1') ? [dirent('en', true)] : [dirent('ct1', true)];
        }
        return globResult;
      };

    it('falls back to globbing when index.json is absent (legacy data)', async () => {
      // entriesDir exists, but index.json does not → glob the locale dir
      mockExistsSync.mockImplementation((p: string) => !String(p).endsWith('index.json'));
      mockReaddirSync.mockImplementation(dirWalkImpl(['page.json', 'index.json']));
      mockReadFileSync.mockReturnValue(JSON.stringify({ 'legacy-key': { title: 'Hello' } }));

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

      expect(result).toMatch(/updated-entries\.json$/);
      const readPaths = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      // index.json itself is filtered out of the glob; only page.json is read.
      expect(readPaths.some((p) => p.endsWith('page.json'))).toBe(true);
    });

    it('throws when an index-listed chunk file does not exist on disk', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(dirWalkImpl());
      mockReadFileSync.mockImplementation((p: string) => {
        if (String(p).endsWith('index.json')) return JSON.stringify({ '1': 'ghost.json' });
        // Reading the listed-but-missing chunk fails like a real fs.readFileSync ENOENT
        const err: NodeJS.ErrnoException = new Error('ENOENT: no such file');
        err.code = 'ENOENT';
        throw err;
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      await expect(removeEntriesFromDatabase('p1', '/tmp/mig.log')).rejects.toThrow(/ENOENT/);
    });
  });

  it('enrichConfigWithAssetMapping covers iteration 1 (no old path branch)', async () => {
    mockExistsSync.mockReturnValue(false);
    const { enrichConfigWithAssetMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetMapping('/c.json', 'proj', 1);
  });

  it('enrichConfigWithAssetMapping loads old and new uid-mappers when files exist', async () => {
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes('uid-mapper.json')
    );
    mockReadFileSync.mockReturnValue(JSON.stringify({ assets: { x: 'y' } }));

    const { enrichConfigWithAssetMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetMapping('/c.json', 'proj', 2, '/log');
  });

  it('enrichConfigWithAssetMapping catches JSON errors on old mapper', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    mockExistsSync.mockImplementation(() => true);
    mockReadFileSync.mockImplementation(() => {
      calls += 1;
      if (calls === 1) throw new Error('bad json');
      return JSON.stringify({ assets: {} });
    });

    const { enrichConfigWithAssetMapping } = await import('../../../src/utils/entry-update.utils.js');
    enrichConfigWithAssetMapping('/c.json', 'proj', 2);
    log.mockRestore();
  });
});
