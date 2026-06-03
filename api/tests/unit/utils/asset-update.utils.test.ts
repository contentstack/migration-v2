import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockChainGet },
  },
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

const project = (opts: Partial<{ iteration: number; destination_stack_id: string | undefined }>) => {
  const p = {
    id: 'p1',
    iteration: opts.iteration ?? 1,
    destination_stack_id: 'stack1' as string | undefined,
  };
  if ('destination_stack_id' in opts) {
    p.destination_stack_id = opts.destination_stack_id;
  }
  return p;
};

describe('asset-update.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({})),
      }),
    });
  });

  it('removeExistingAssets returns early when no stackId', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ destination_stack_id: '' })),
      }),
    });
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('removeExistingAssets returns when assets index.json missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('removeExistingAssets returns when index file empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('   ');
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets iteration 1 saves metadata only', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ a1: { filename: 'f', file_size: '1', url: 'u' } }));
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1', '/tmp/a.log');
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('removeExistingAssets iteration 2+ skips dedup when no previous uid map', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    mockExistsSync.mockImplementation((p: string) => {
      if (String(p).endsWith('index.json')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ a1: { filename: 'f', file_size: '1' } }));

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets iteration 2+ runs dedup when prev maps exist', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    let indexRead = false;
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes(`${path.sep}entries${path.sep}`)) return true;
      if (s.includes('files')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json') && !indexRead) {
        indexRead = true;
        return JSON.stringify({
          asset1: { filename: 'f', file_size: '1' },
        });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { asset1: 'cs-uid-1' } });
      }
      if (s.includes('asset-metadata.json')) {
        return JSON.stringify({
          asset1: { filename: 'f', file_size: '1', url: '' },
        });
      }
      if (s.endsWith('.json') && s.includes('entries')) {
        return JSON.stringify({ ref: { uid: 'asset1' } });
      }
      return '{}';
    });
    const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir });
    mockReaddirSync
      .mockReturnValueOnce([dirent('ct', true)])
      .mockReturnValueOnce([dirent('en', true)])
      .mockReturnValueOnce(['e.json']);

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('removeExistingAssets returns when index JSON parse fails', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ not json');
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets iteration 2+ exits when no unchanged assets to dedupe', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    let call = 0;
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json') && call === 0) {
        call += 1;
        return JSON.stringify({ a1: { filename: 'new-name', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { a1: 'cs-1' } });
      }
      if (s.includes('asset-metadata.json')) {
        return JSON.stringify({
          a1: { filename: 'old-name', file_size: '1', url: '' },
        });
      }
      return '{}';
    });
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets tolerates corrupt previous asset-metadata JSON', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) {
        return JSON.stringify({ x1: { filename: 'f', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { x1: 'cs-1' } });
      }
      if (s.includes('asset-metadata.json')) {
        return '{ bad json';
      }
      return '{}';
    });
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets tolerates corrupt uid-mapper JSON', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) {
        return JSON.stringify({ a1: { filename: 'f', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return 'not-json';
      }
      return '{}';
    });
    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets removes folders and updates index when dedup applies', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    let indexPass = 0;
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      if (s.includes(`${path.sep}entries${path.sep}`)) return true;
      if (s.endsWith(`${path.sep}files`) || s.includes(`${path.sep}files${path.sep}`)) return true;
      if (s.includes(`${path.sep}files${path.sep}a1`)) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) {
        indexPass += 1;
        return JSON.stringify({ a1: { filename: 'f', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { a1: 'cs-uid-1' } });
      }
      if (s.includes('asset-metadata.json')) {
        return JSON.stringify({
          a1: { filename: 'f', file_size: '1', url: '' },
        });
      }
      if (s.endsWith('.json') && s.includes('entries')) {
        return JSON.stringify({ nested: { uid: 'a1' } });
      }
      return '{}';
    });
    const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir });
    mockReaddirSync
      .mockReturnValueOnce([dirent('ct', true)])
      .mockReturnValueOnce([dirent('en', true)])
      .mockReturnValueOnce(['e.json']);

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
    expect(mockRmSync).toHaveBeenCalled();
  });

  it('removeExistingAssets skips entry JSON files that fail to parse', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      if (s.includes(`${path.sep}entries${path.sep}`)) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) {
        return JSON.stringify({ z1: { filename: 'f', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { z1: 'cs-z' } });
      }
      if (s.includes('asset-metadata.json')) {
        return JSON.stringify({ z1: { filename: 'f', file_size: '1', url: '' } });
      }
      if (s.endsWith('bad.json')) {
        return '{';
      }
      return '{}';
    });
    const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir });
    mockReaddirSync
      .mockReturnValueOnce([dirent('ct', true)])
      .mockReturnValueOnce([dirent('en', true)])
      .mockReturnValueOnce(['bad.json']);

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
  });

  it('removeExistingAssets replaces nested asset uids and skips empty entry JSON', async () => {
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue(project({ iteration: 2 })),
      }),
    });
    let entryReadCount = 0;
    mockExistsSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) return true;
      if (s.includes('uid-mapper.json')) return true;
      if (s.includes('asset-metadata.json')) return true;
      if (s.includes(`${path.sep}entries${path.sep}`)) return true;
      if (s.includes(`${path.sep}files`)) return false;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      const s = String(p);
      if (s.endsWith('index.json')) {
        return JSON.stringify({ a1: { filename: 'f', file_size: '1' } });
      }
      if (s.includes('uid-mapper.json')) {
        return JSON.stringify({ assets: { a1: 'cs-nested' } });
      }
      if (s.includes('asset-metadata.json')) {
        return JSON.stringify({
          a1: { filename: 'f', file_size: '1', url: '' },
        });
      }
      if (s.endsWith('empty.json')) {
        return '   \n';
      }
      if (s.endsWith('nested.json')) {
        return JSON.stringify({ level: { deeper: { uid: 'a1' } } });
      }
      return '{}';
    });
    const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir });
    mockReaddirSync
      .mockReturnValueOnce([dirent('ct', true)])
      .mockReturnValueOnce([dirent('en', true)])
      .mockReturnValueOnce(['empty.json', 'nested.json']);

    const { removeExistingAssets } = await import('../../../src/utils/asset-update.utils.js');
    await removeExistingAssets('p1');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
