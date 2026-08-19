import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Regression tests for a real production gap: runCli's own top-level
 * try/catch used to swallow EVERY failure — a failed CLI import subprocess,
 * or the deliberate "entries still incomplete after every retry" throw —
 * with only a console.error, no rethrow. The caller (migration.service.ts)
 * always saw a resolved promise, so a genuinely failed customer migration was
 * indistinguishable from a successful one. Fixed to log loudly AND rethrow;
 * these tests pin that runCli's returned promise now actually rejects.
 */
const {
  mockSpawn,
  mockAppendFileSync,
  mockAuthRead,
  mockAuthChainGet,
  mockSetLogFilePath,
  mockSetOAuthConfig,
  mockSetBasicAuthConfig,
  mockCopyDirectory,
  mockCreateDirectoryAndFile,
  mockProjectRead,
  mockProjectChainGet,
  mockWriteUidMapping,
  mockWritePerLocaleEntryUidMapping,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockAuthRead: vi.fn(),
  mockAuthChainGet: vi.fn(),
  mockSetLogFilePath: vi.fn(),
  mockSetOAuthConfig: vi.fn(),
  mockSetBasicAuthConfig: vi.fn(),
  mockCopyDirectory: vi.fn(),
  mockCreateDirectoryAndFile: vi.fn(),
  mockProjectRead: vi.fn(),
  mockProjectChainGet: vi.fn(),
  mockWriteUidMapping: vi.fn(),
  mockWritePerLocaleEntryUidMapping: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs', () => ({
  default: {
    appendFileSync: mockAppendFileSync,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: mockExistsSync,
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isDirectory: () => false })),
    readFileSync: vi.fn(() => '{}'),
  },
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: mockExistsSync,
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  readFileSync: vi.fn(() => '{}'),
}));

vi.mock('../../../src/utils/index.js', () => ({
  copyDirectory: mockCopyDirectory,
  createDirectoryAndFile: mockCreateDirectoryAndFile,
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: { get: mockAuthChainGet },
  },
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockProjectChainGet },
    data: { projects: [] },
    write: vi.fn(),
  },
}));

vi.mock('../../../src/server.js', () => ({
  setLogFilePath: mockSetLogFilePath,
}));

vi.mock('../../../src/utils/config-handler.util.js', () => ({
  setOAuthConfig: mockSetOAuthConfig,
  setBasicAuthConfig: mockSetBasicAuthConfig,
}));

vi.mock('../../../src/utils/uid-mapper.utils.js', () => ({
  default: mockWriteUidMapping,
  writePerLocaleEntryUidMapping: mockWritePerLocaleEntryUidMapping,
}));

import { utilsCli } from '../../../src/services/runCli.service.js';

/** A fake child process whose close event fires with the given exit code. */
const makeChild = (exitCode = 0) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => child.emit('close', exitCode));
  return child;
};

const setUser = (user: any) => {
  mockAuthChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(user) }),
  });
};

describe('runCli — failures propagate instead of being swallowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
    mockSetLogFilePath.mockResolvedValue(undefined);
    mockCopyDirectory.mockResolvedValue(undefined);
    mockCreateDirectoryAndFile.mockResolvedValue(undefined);
    mockProjectRead.mockResolvedValue(undefined);
    mockProjectChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(undefined) }),
      findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
    });
    setUser({ email: 'u@x.com', authtoken: 'tok', region: 'NA', user_id: 'u1' });
    // No entries directory at all -> findIncompleteLocalePairs sees nothing to
    // check, so the retry loop is a no-op and the CLI import command's own
    // exit code is what's under test.
    mockExistsSync.mockReturnValue(false);
  });

  it('rejects when the CLI import subprocess exits non-zero', async () => {
    mockSpawn.mockImplementation(() => makeChild(1)); // every spawned command "fails"

    await expect(
      utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log'),
    ).rejects.toThrow(/exit code 1/);
  });

  it('writes a loud error log entry (not just console.error) when the import fails', async () => {
    mockSpawn.mockImplementation(() => makeChild(1));

    await expect(
      utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log'),
    ).rejects.toThrow();

    const written = mockAppendFileSync.mock.calls.map((c) => String(c[1]));
    expect(written.some((l) => l.includes('Migration import failed'))).toBe(true);
  });

  it('does not reject when the import genuinely succeeds', async () => {
    mockSpawn.mockImplementation(() => makeChild(0));

    await expect(
      utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', true, '/tmp/log.log'),
    ).resolves.toBeUndefined();
  });
});
