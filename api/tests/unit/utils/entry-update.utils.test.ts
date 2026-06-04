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
  },
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
    mockExistsSync.mockReturnValue(true);
    const dirent = (name: string, isDir: boolean) => ({
      name,
      isDirectory: () => isDir,
    });
    mockReaddirSync
      .mockReturnValueOnce([dirent('ct1', true)])
      .mockReturnValueOnce([dirent('en', true)])
      .mockReturnValueOnce(['page.json']);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ 'legacy-key': { title: 'Hello' }, keep: { x: 1 } })
    );

    const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
    const result = await removeEntriesFromDatabase('p1', '/tmp/mig.log');

    expect(result).toMatch(/updated-entries\.json$/);
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalled();
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
