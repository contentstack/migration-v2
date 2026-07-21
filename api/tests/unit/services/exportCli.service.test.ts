import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const {
  mockExistsSync,
  mockRmSync,
  mockMkdirSync,
  mockSpawn,
  mockAuthRead,
  mockChainFindValue,
  mockSetBasicAuthConfig,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockSpawn: vi.fn(),
  mockAuthRead: vi.fn(),
  mockChainFindValue: vi.fn(),
  mockSetBasicAuthConfig: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    rmSync: mockRmSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  rmSync: mockRmSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: {
      get: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ value: mockChainFindValue }),
      }),
    },
  },
}));

vi.mock('../../../src/utils/config-handler.util.js', () => ({
  setBasicAuthConfig: mockSetBasicAuthConfig,
}));

const makeProc = (exitCode = 0, errorEvent?: Error) => {
  const ee: any = new EventEmitter();
  setImmediate(() => {
    if (errorEvent) {
      ee.emit('error', errorEvent);
    } else {
      ee.emit('close', exitCode);
    }
  });
  return ee;
};

describe('exportCli.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
  });

  it('exports stack: resolves region, creates output dir, runs CLI commands', async () => {
    mockChainFindValue.mockReturnValue({
      user_id: 'u1',
      region: 'NA',
      username: 'a@b.c',
    });
    mockExistsSync.mockReturnValue(true);
    mockSpawn.mockImplementation(() => makeProc(0));

    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    const out = await exportStackCli('stack123', 'NA', 'u1');

    expect(out).toMatch(/export-stack.*stack123/);
    expect(mockSetBasicAuthConfig).toHaveBeenCalled();
    expect(mockRmSync).toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    const firstCallArgs = mockSpawn.mock.calls[0][1];
    expect(firstCallArgs).toContain('config:set:region');
    expect(firstCallArgs).toContain('NA');
    const secondCallArgs = mockSpawn.mock.calls[1][1];
    expect(secondCallArgs).toContain('cm:stacks:export');
    expect(secondCallArgs).toContain('stack123');
  });

  it('falls back to NA when region is unknown and converts underscores to dashes', async () => {
    mockChainFindValue.mockReturnValue({ user_id: 'u1', region: 'NA' });
    mockExistsSync.mockReturnValue(false);
    mockSpawn.mockImplementation(() => makeProc(0));

    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    await exportStackCli('s1', 'UNKNOWN_REGION', 'u1');
    expect(mockRmSync).not.toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalled();
  });

  it('throws when user not found', async () => {
    mockChainFindValue.mockReturnValue(undefined);
    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    await expect(exportStackCli('s1', 'NA', 'u1')).rejects.toThrow(
      'User not found'
    );
  });

  it('rejects when a spawn process exits non-zero', async () => {
    mockChainFindValue.mockReturnValue({ user_id: 'u1', region: 'NA' });
    mockExistsSync.mockReturnValue(false);
    mockSpawn.mockImplementation(() => makeProc(1));
    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    await expect(exportStackCli('s1', 'NA', 'u1')).rejects.toThrow(
      /exit code 1/
    );
  });

  it('rejects when spawn emits an error', async () => {
    mockChainFindValue.mockReturnValue({ user_id: 'u1', region: 'NA' });
    mockExistsSync.mockReturnValue(false);
    mockSpawn.mockImplementation(() => makeProc(0, new Error('spawn failed')));
    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    await expect(exportStackCli('s1', 'NA', 'u1')).rejects.toThrow(
      'spawn failed'
    );
  });

  it('handles EU region with underscore replacement (AZURE_NA -> azure-na)', async () => {
    mockChainFindValue.mockReturnValue({ user_id: 'u1', region: 'AZURE_NA' });
    mockExistsSync.mockReturnValue(false);
    mockSpawn.mockImplementation(() => makeProc(0));
    const { exportStackCli } = await import(
      '../../../src/services/exportCli.service.js'
    );
    await exportStackCli('s1', 'AZURE_NA', 'u1');
    const firstCallArgs = mockSpawn.mock.calls[0][1];
    expect(firstCallArgs).toContain('AZURE-NA');
  });
});
