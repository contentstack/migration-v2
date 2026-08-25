import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';

/**
 * Regression tests for a real production finding: `cm:stacks:import` can hang
 * for 15-17 minutes on a degraded connection before it self-reports
 * "Connection failed: Unable to reach the server" — and because runCommand
 * had no timeout, our own entries-import retry loop just waited out the
 * whole hang every time, burning most of its 6-attempt budget on a handful
 * of long stalls instead of genuine retries. These tests pin two things:
 * (1) runCommand now kills a hung process and rejects instead of waiting
 * forever, and (2) the entries retry loop absorbs a single failed/timed-out
 * attempt and keeps going instead of aborting the whole migration.
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
  mockReaddirSync,
  mockStatSync,
  mockReadFileSync,
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
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReadFileSync: vi.fn(),
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
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    readFileSync: mockReadFileSync,
  },
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  readFileSync: mockReadFileSync,
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

import { runCommand, utilsCli } from '../../../src/services/runCli.service.js';

/** A fake child process that never closes on its own — simulates a hung connection. */
const makeHungChild = () => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
};

/** A fake child process whose close event fires with the given exit code. */
const makeChild = (exitCode = 0) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  queueMicrotask(() => child.emit('close', exitCode));
  return child;
};

const setUser = (user: any) => {
  mockAuthChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(user) }),
  });
};

describe('runCommand — timeout kills a hung process instead of waiting forever', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a timeout-specific message once timeoutMs elapses with no close event', async () => {
    vi.useFakeTimers();
    const child = makeHungChild();
    mockSpawn.mockReturnValue(child);

    const promise = runCommand('npx', ['whatever'], undefined, 5000);
    const assertion = expect(promise).rejects.toThrow(/timed out after 5000ms/i);

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('kills the hung process with SIGTERM once it times out', async () => {
    vi.useFakeTimers();
    const child = makeHungChild();
    mockSpawn.mockReturnValue(child);

    const promise = runCommand('npx', ['whatever'], undefined, 5000);
    promise.catch(() => {}); // avoid unhandled rejection noise; assertion is on the kill call

    await vi.advanceTimersByTimeAsync(5000);

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('does not time out a process that closes well within timeoutMs', async () => {
    vi.useFakeTimers();
    const child = makeChild(0);
    mockSpawn.mockReturnValue(child);

    const promise = runCommand('npx', ['whatever'], undefined, 5000);
    await vi.advanceTimersByTimeAsync(0); // let the queued microtask's close event fire

    await expect(promise).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('still rejects on a genuine non-zero exit when no timeout is hit or configured', async () => {
    const child = makeChild(1);
    mockSpawn.mockReturnValue(child);

    await expect(runCommand('npx', ['whatever'])).rejects.toThrow(/exit code 1/);
  });
});

describe('runCli entries retry loop — a single failed attempt does not abort the whole migration', () => {
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

    // Simulate one (content type, locale) pair — cs_contentpage/fr-fr — that our
    // connector wrote but the CLI's mapper never catches up on, so
    // findIncompleteLocalePairs reports it as missing on every single check,
    // forcing the retry loop to run all the way to its attempt ceiling.
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir.includes(path.join('mapper', 'entries'))) {
        throw new Error('no mapper folder yet'); // readMappedEntryUids treats this as "nothing mapped"
      }
      if (dir.endsWith(path.join('entries', 'cs_contentpage'))) return ['fr-fr'];
      if (dir.endsWith('entries')) return ['cs_contentpage'];
      return [];
    });
    mockReadFileSync.mockImplementation((file: string) => {
      if (file.endsWith('fr-fr.json')) return JSON.stringify({ a: 1 });
      return '{}';
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries entries import up to the new higher ceiling instead of aborting after the first failed attempt', async () => {
    vi.useFakeTimers();
    let spawnCalls = 0;
    mockSpawn.mockImplementation(() => {
      spawnCalls += 1;
      // Calls 1-2 are `config:set:region` and the initial full-module import —
      // let both succeed so the retry loop is reached. Every call after that is
      // a scoped entries retry that FAILS immediately (exit code 1) — if the
      // loop aborted on the first one of these instead of absorbing it and
      // retrying, spawn would be called far fewer than MAX_ENTRY_IMPORT_ATTEMPTS
      // + 2 times.
      return spawnCalls <= 2 ? makeChild(0) : makeChild(1);
    });

    const promise = utilsCli.runCli('NA', 'u1', 'stack123', 'proj1', false, '/tmp/log.log');
    promise.catch(() => {});

    // Flush every attempt's fixed backoff sleep (10s each) plus the initial call.
    for (let i = 0; i < 20; i += 1) {
      await vi.advanceTimersByTimeAsync(10_000);
    }

    await expect(promise).rejects.toThrow(/still incomplete after 15 attempts/i);
    // config:set:region + initial full import + 15 entries-only retries, none of
    // which aborted the loop early.
    expect(spawnCalls).toBe(17);
  });
});
