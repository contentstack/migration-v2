import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockProjectRead,
  mockChainGet,
  mockExistsSync,
  mockReadFileSync,
  mockUidRead,
  mockUidWrite,
  mockGetUidMapperDb,
  mockCustomLogger,
} = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockChainGet: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockUidRead: vi.fn(),
  mockUidWrite: vi.fn(),
  mockGetUidMapperDb: vi.fn(),
  mockCustomLogger: vi.fn(),
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockChainGet },
  },
}));

vi.mock('../../../src/models/uidMapper.js', () => ({
  default: mockGetUidMapperDb,
}));

vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: mockCustomLogger,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}));

import writeUidMapping from '../../../src/utils/uid-mapper.utils';

describe('uid-mapper.utils - writeUidMapping', () => {
  const uidDb = {
    read: mockUidRead,
    write: mockUidWrite,
    data: {} as Record<string, unknown>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue({
          id: 'p1',
          destination_stack_id: 'stack1',
        }),
      }),
    });
    mockCustomLogger.mockResolvedValue(undefined);
    mockUidRead.mockResolvedValue(undefined);
    mockUidWrite.mockResolvedValue(undefined);
    mockGetUidMapperDb.mockReturnValue(uidDb);
  });

  it('writes combined asset and entry mapping when both files have data', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('assets')) return JSON.stringify({ a1: 'asset-uid' });
      return JSON.stringify({ e1: 'entry-uid' });
    });

    await writeUidMapping('/backup', 'p1', 1);

    expect(mockGetUidMapperDb).toHaveBeenCalledWith('p1', 1);
    expect(uidDb.data).toEqual({
      assets: { a1: 'asset-uid' },
      entry: { e1: 'entry-uid' },
    });
    expect(mockUidWrite).toHaveBeenCalled();
  });

  it('still writes asset mappings when the entry mapper file is missing', async () => {
    // asset file exists with data, entry file does not exist. writeUidMapping
    // reads the two mappings independently and always persists the combined
    // result, so asset mappings survive a run with no entry mapper file (entry
    // stays empty) — required for delta carry-forward.
    mockExistsSync.mockImplementation((p: string) => p.includes('assets'));
    mockReadFileSync.mockReturnValue(JSON.stringify({ a1: 'asset-uid' }));

    await writeUidMapping('/backup', 'p1', 1);

    expect(mockUidWrite).toHaveBeenCalled();
    expect(uidDb.data).toEqual({ assets: { a1: 'asset-uid' }, entry: {} });
  });

  it('falls back to previous iteration for assets when current asset data is empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('mapper') && p.includes('assets')) return JSON.stringify({});
      if (p.includes('database')) return JSON.stringify({ assets: { prev: 'a' } });
      return JSON.stringify({ e1: 'entry-uid' });
    });

    await writeUidMapping('/backup', 'p1', 2);

    expect(uidDb.data).toMatchObject({ assets: { prev: 'a' } });
    expect(mockUidWrite).toHaveBeenCalled();
  });

  it('falls back to previous iteration for entries when current entry data is empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('mapper') && p.includes('assets')) return JSON.stringify({ a1: 'x' });
      if (p.includes('mapper') && p.includes('entries')) return JSON.stringify({});
      if (p.includes('database')) return JSON.stringify({ entry: { prevE: 'e' } });
      return JSON.stringify({});
    });

    await writeUidMapping('/backup', 'p1', 2);

    expect(uidDb.data).toMatchObject({ entry: { prevE: 'e' } });
    expect(mockUidWrite).toHaveBeenCalled();
  });

  it('handles missing project data gracefully (undefined destination stack)', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(undefined),
      }),
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ k: 'v' }));

    await expect(writeUidMapping('/backup', 'p1', 1)).resolves.toBeUndefined();
    expect(mockUidWrite).toHaveBeenCalled();
  });

  it('catches and logs errors without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(writeUidMapping('/backup', 'p1', 1)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error writing UID mapping file:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});