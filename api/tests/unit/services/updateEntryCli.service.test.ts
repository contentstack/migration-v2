import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const {
  mockSpawn,
  mockAppendFileSync,
  mockAuthRead,
  mockAuthChainGet,
  mockSetLogFilePath,
  mockSetOAuthConfig,
  mockSetBasicAuthConfig,
} = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockAuthRead: vi.fn(),
  mockAuthChainGet: vi.fn(),
  mockSetLogFilePath: vi.fn(),
  mockSetOAuthConfig: vi.fn(),
  mockSetBasicAuthConfig: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs', () => ({
  default: { appendFileSync: mockAppendFileSync },
  appendFileSync: mockAppendFileSync,
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: { get: mockAuthChainGet },
  },
}));

vi.mock('../../../src/server.js', () => ({
  setLogFilePath: mockSetLogFilePath,
}));

vi.mock('../../../src/utils/config-handler.util.js', () => ({
  setOAuthConfig: mockSetOAuthConfig,
  setBasicAuthConfig: mockSetBasicAuthConfig,
}));

import { updateEntryCli, utilsUpdateCli } from '../../../src/services/updateEntryCli.service.js';

/**
 * Builds a fake child process whose close event fires with the given exit code
 * on the next tick, optionally emitting stdout/stderr data first.
 */
const makeChild = (exitCode = 0, stdout = '', stderr = '') => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', exitCode);
  });
  return child;
};

const setUser = (user: any) => {
  mockAuthChainGet.mockReturnValue({
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(user) }),
  });
};

describe('updateEntryCli.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
    mockSetLogFilePath.mockResolvedValue(undefined);
    setUser({ email: 'u@x.com', authtoken: 'tok', region: 'NA', user_id: 'u1' });
    mockSpawn.mockImplementation(() => makeChild(0));
  });

  it('exposes updateEntryCli via the utilsUpdateCli object', () => {
    expect(utilsUpdateCli.updateEntryCli).toBe(updateEntryCli);
  });

  it('runs both CLI commands and logs success for a basic-auth user', async () => {
    await updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json');

    // config:set:region + cm:stacks:migration = 2 spawned commands
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockSetBasicAuthConfig).toHaveBeenCalled();
    expect(mockSetOAuthConfig).not.toHaveBeenCalled();
    // a success completion line is written
    const written = mockAppendFileSync.mock.calls.map((c) => String(c[1]));
    expect(written.some((l) => l.includes('Entry Update Process Completed'))).toBe(true);
  });

  it('uses OAuth config when the user has an access token', async () => {
    setUser({ email: 'u@x.com', access_token: 'oauth', region: 'NA', user_id: 'u1' });
    await updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json');

    expect(mockSetOAuthConfig).toHaveBeenCalled();
    expect(mockSetBasicAuthConfig).not.toHaveBeenCalled();
  });

  it('logs and returns early when stack_api_key is missing (no migration command)', async () => {
    await updateEntryCli('NA', 'u1', '', '/tmp/log', '/tmp/config.json');

    // only the first command (config:set:region) runs; migration is skipped
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const written = mockAppendFileSync.mock.calls.map((c) => String(c[1]));
    expect(written.some((l) => l.includes('stack API key missing'))).toBe(true);
  });

  it('logs then rethrows when the user has no authentication token', async () => {
    setUser({ email: 'u@x.com', region: 'NA', user_id: 'u1' }); // no authtoken/access_token

    // first command runs, then the missing-auth throw is logged and rethrown — the caller
    // (migration.service.ts) relies on this rejecting to know the run didn't succeed
    await expect(
      updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json')
    ).rejects.toThrow('No authentication token found');

    const written = mockAppendFileSync.mock.calls.map((c) => String(c[1]));
    expect(written.some((l) => l.includes('Failed to update entries'))).toBe(true);
  });

  it('classifies stdout/stderr output and writes log entries with correct levels', async () => {
    mockSpawn
      .mockImplementationOnce(() => makeChild(0, 'Operation failed: not found\n', 'boom\n'))
      .mockImplementationOnce(() => makeChild(0, 'all good\n'));

    await updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json');

    const entries = mockAppendFileSync.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[1]).trim());
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // stdout containing "failed"/"not found" -> error level
    expect(entries.some((e) => e.level === 'error' && e.message.includes('Operation failed'))).toBe(true);
    // stderr always logged at error level
    expect(entries.some((e) => e.level === 'error' && e.message === 'boom')).toBe(true);
    // benign stdout -> info level
    expect(entries.some((e) => e.level === 'info' && e.message === 'all good')).toBe(true);
  });

  it('rejects with the underlying error when a spawned command exits non-zero', async () => {
    mockSpawn.mockImplementationOnce(() => makeChild(1)); // first command fails

    await expect(
      updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json')
    ).rejects.toThrow('Command failed with exit code 1');

    const entries = mockAppendFileSync.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[1]).trim());
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(entries.some((e) => e.message?.includes('Command failed with exit code 1'))).toBe(true);
    // the failed command bubbles into the catch block, which logs before rethrowing
    const written = mockAppendFileSync.mock.calls.map((c) => String(c[1]));
    expect(written.some((l) => l.includes('Failed to update entries'))).toBe(true);
  });

  it('maps a warning in stdout to warn level', async () => {
    mockSpawn
      .mockImplementationOnce(() => makeChild(0, 'this is a warning message\n'))
      .mockImplementationOnce(() => makeChild(0));

    await updateEntryCli('NA', 'u1', 'stackKey', '/tmp/log', '/tmp/config.json');

    const entries = mockAppendFileSync.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[1]).trim());
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(entries.some((e) => e.level === 'warn')).toBe(true);
  });
});