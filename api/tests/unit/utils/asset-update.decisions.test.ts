import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the delta-AEM Asset Mapper decision branches in removeExistingAssets
// (isUpdate=true → replace-in-place, isUpdate=false → reuse, update-but-missing
// → reuse fallback) plus the saveAssetMetadata / loadPreviousAssetMetadata
// helpers directly. The existing asset-update.utils.test.ts deliberately leaves
// getAssetMapperDb unmocked, so it only exercises the no-decision automatic path.

const {
  mockProjectRead,
  mockChainGet,
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockReaddirSync,
  mockRmSync,
  mockAppendFileSync,
  mockGetAssetMapperDb,
} = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockChainGet: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockGetAssetMapperDb: vi.fn(),
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockChainGet },
  },
}));

vi.mock('../../../src/models/assetMapper.js', () => ({
  default: mockGetAssetMapperDb,
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    rmSync: mockRmSync,
    appendFileSync: mockAppendFileSync,
  },
}));

const projectIter2 = () => ({
  id: 'p1',
  iteration: 2,
  destination_stack_id: 'stack1',
});

// Sets up a clean iteration-2 dedup scenario with a single previously-migrated
// asset "a1" (source uid → CS uid "cs-uid-1"). `decision` becomes the asset
// mapper row's isUpdate; `binaryExists` controls whether the asset's file is on
// disk. entriesDir is absent so reference-rewriting is skipped (covered
// elsewhere); filesDir + the asset folder exist so reuse can rmSync them.
const setupDedup = (opts: {
  assetMapperRows: Array<{ otherCmsAssetUid: string; isUpdate: boolean }>;
  filename?: string;
  binaryExists?: boolean;
  assetTitle?: string;
}) => {
  const filename = opts.filename ?? 'photo.jpg';

  mockChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({
      value: vi.fn().mockReturnValue(projectIter2()),
    }),
  });

  mockGetAssetMapperDb.mockReturnValue({
    read: vi.fn().mockResolvedValue(undefined),
    data: { asset_mapper: opts.assetMapperRows },
  });

  mockExistsSync.mockImplementation((p: string) => {
    const s = String(p);
    if (s.endsWith('index.json')) return true;
    if (s.includes('uid-mapper.json')) return true;
    if (s.includes('asset-metadata.json')) return true;
    // the asset binary: <assetsDir>/files/a1/<filename>
    if (s.includes(`${path.sep}files${path.sep}a1${path.sep}${filename}`)) {
      return opts.binaryExists ?? false;
    }
    // the asset folder: <assetsDir>/files/a1 (used for rmSync on reuse)
    if (s.endsWith(`${path.sep}files${path.sep}a1`)) return true;
    // the files dir itself
    if (s.endsWith(`${path.sep}files`)) return true;
    // entriesDir absent → skip ref rewriting branch
    return false;
  });

  mockReadFileSync.mockImplementation((p: string) => {
    const s = String(p);
    if (s.endsWith('index.json')) {
      const asset: Record<string, string> = { filename, file_size: '10', url: '' };
      if (opts.assetTitle) asset.title = opts.assetTitle;
      return JSON.stringify({ a1: asset });
    }
    if (s.includes('uid-mapper.json')) {
      return JSON.stringify({ assets: { a1: 'cs-uid-1' } });
    }
    if (s.includes('asset-metadata.json')) {
      return JSON.stringify({ a1: { filename, file_size: '10', url: '' } });
    }
    return '{}';
  });
};

describe('asset-update.utils — Asset Mapper decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
  });

  it('isUpdate=true with the binary present → queues an in-place replace and keeps the file', async () => {
    setupDedup({
      assetMapperRows: [{ otherCmsAssetUid: 'a1', isUpdate: true }],
      filename: 'photo.jpg',
      binaryExists: true,
      assetTitle: 'My Photo', // title comes from index.json, not the mapper row
    });

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    const updates = await removeExistingAssets('p1');

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      uid: 'cs-uid-1',
      filename: 'photo.jpg',
      title: 'My Photo',
    });
    expect(updates[0].filePath).toContain(`files${path.sep}a1${path.sep}photo.jpg`);
    // updated assets keep their folder so the replace step can upload the binary
    expect(mockRmSync).not.toHaveBeenCalled();
    // a1 was dropped from index.json (it keeps its existing CS uid)
    const indexWrite = mockWriteFileSync.mock.calls.find((c) => String(c[0]).endsWith('index.json'));
    expect(indexWrite).toBeDefined();
    expect(String(indexWrite?.[1])).not.toContain('a1');
  });

  it('isUpdate=false (reuse) → no replace queued and the local file folder is removed', async () => {
    setupDedup({
      assetMapperRows: [{ otherCmsAssetUid: 'a1', isUpdate: false }],
    });

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    const updates = await removeExistingAssets('p1');

    expect(updates).toEqual([]);
    // reused asset's folder is deleted from migration data
    expect(mockRmSync).toHaveBeenCalledWith(
      expect.stringContaining(`files${path.sep}a1`),
      { recursive: true, force: true },
    );
  });

  it('isUpdate=true but the binary is missing → falls back to reuse (no replace, folder removed)', async () => {
    setupDedup({
      assetMapperRows: [{ otherCmsAssetUid: 'a1', isUpdate: true }],
      binaryExists: false,
    });

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    const updates = await removeExistingAssets('p1');

    expect(updates).toEqual([]);
    expect(mockRmSync).toHaveBeenCalled();
  });

  it('ignores asset-mapper rows without otherCmsAssetUid', async () => {
    setupDedup({
      // malformed row should be skipped; a1 then has no decision → automatic
      // path. metadata matches (unchanged) → reused (folder removed), updates empty.
      assetMapperRows: [{ otherCmsAssetUid: '', isUpdate: true } as any],
    });

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    const updates = await removeExistingAssets('p1');

    expect(updates).toEqual([]);
  });

  it('repoints asset references in entry JSON files to the existing CS uid', async () => {
    // Drives the entry-reference rewrite path: entriesDir exists, so the walk
    // (content type -> locale -> chunk) runs and replaceAssetRefsInObject swaps
    // the deduped source uid for the existing Contentstack uid in the entry.
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(projectIter2()),
      }),
    });
    mockGetAssetMapperDb.mockReturnValue({
      read: vi.fn().mockResolvedValue(undefined),
      data: { asset_mapper: [{ otherCmsAssetUid: 'a1', isUpdate: false }] }, // reuse
    });
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      if (s.includes('entries')) return true; // entriesDir + ct + locale dirs exist
      if (s.includes('files')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return JSON.stringify({ a1: { filename: 'f.jpg', file_size: '1', url: '' } });
      if (s.includes('uid-mapper.json')) return JSON.stringify({ assets: { a1: 'cs-uid-1' } });
      if (s.includes('asset-metadata.json')) return JSON.stringify({ a1: { filename: 'f.jpg', file_size: '1', url: '' } });
      if (s.endsWith('entry1.json')) return JSON.stringify({ banner: { uid: 'a1' } });
      return '{}';
    });
    const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir });
    mockReaddirSync
      .mockReturnValueOnce([dirent('page', true)]) // content type dirs
      .mockReturnValueOnce([dirent('en-us', true)]) // locale dirs
      .mockReturnValueOnce(['entry1.json', 'index.json']); // chunk files (index.json skipped)

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');

    // entry1.json rewritten with the source uid 'a1' replaced by the CS uid 'cs-uid-1'
    const entryWrite = mockWriteFileSync.mock.calls.find((c) => String(c[0]).endsWith('entry1.json'));
    expect(entryWrite).toBeDefined();
    expect(String(entryWrite?.[1])).toContain('cs-uid-1');
    expect(String(entryWrite?.[1])).not.toContain('a1');
  });
});

describe('asset-update.utils — saveAssetMetadata / loadPreviousAssetMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveAssetMetadata writes only filename/file_size/url and creates the dir', async () => {
    const { saveAssetMetadata } = await import('../../../src/utils/asset-update.utils.js');
    saveAssetMetadata(
      { a1: { filename: 'f.jpg', file_size: '99', url: 'http://x/f.jpg', extra: 'drop-me' } },
      'p1',
      3,
      '/tmp/x.log',
    );

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    const call = mockWriteFileSync.mock.calls.find((c) => String(c[0]).includes('asset-metadata'));
    expect(call).toBeDefined();
    const written = JSON.parse(String(call?.[1]));
    expect(written).toEqual({ a1: { filename: 'f.jpg', file_size: '99', url: 'http://x/f.jpg' } });
    // logger path supplied → a log line is appended
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('saveAssetMetadata fills missing fields with empty strings', async () => {
    const { saveAssetMetadata } = await import('../../../src/utils/asset-update.utils.js');
    saveAssetMetadata({ a1: {} }, 'p1', 1);
    const call = mockWriteFileSync.mock.calls.find((c) => String(c[0]).includes('asset-metadata'));
    const written = JSON.parse(String(call?.[1]));
    expect(written).toEqual({ a1: { filename: '', file_size: '', url: '' } });
  });

  it('loadPreviousAssetMetadata returns {} when the file is absent', async () => {
    mockExistsSync.mockReturnValue(false);
    const { loadPreviousAssetMetadata } = await import('../../../src/utils/asset-update.utils.js');
    expect(loadPreviousAssetMetadata('p1', 1)).toEqual({});
  });

  it('loadPreviousAssetMetadata parses a valid metadata file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ a1: { filename: 'f', file_size: '1', url: '' } }));
    const { loadPreviousAssetMetadata } = await import('../../../src/utils/asset-update.utils.js');
    expect(loadPreviousAssetMetadata('p1', 2)).toEqual({ a1: { filename: 'f', file_size: '1', url: '' } });
  });

  it('loadPreviousAssetMetadata returns {} on corrupt JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ not json');
    const { loadPreviousAssetMetadata } = await import('../../../src/utils/asset-update.utils.js');
    expect(loadPreviousAssetMetadata('p1', 2)).toEqual({});
  });
});
