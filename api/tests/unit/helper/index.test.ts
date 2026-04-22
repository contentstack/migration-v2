import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreateConnection = vi.fn();
const mockConnect = vi.fn();
const mockDestroy = vi.fn();
const mockEnd = vi.fn();
const mockCustomLogger = vi.fn().mockResolvedValue(undefined);

vi.mock('mysql2', () => ({
  default: {
    createConnection: (...args: unknown[]) => mockCreateConnection(...args),
  },
}));

vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: (...args: unknown[]) => mockCustomLogger(...args),
}));

import { createDbConnection, getDbConnection } from '../../../src/helper/index.js';

describe('helper createDbConnection', () => {
  const config = {
    host: 'h',
    user: 'u',
    password: 'p',
    database: 'd',
    port: '3306',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomLogger.mockReset();
    mockCustomLogger.mockResolvedValue(undefined);
    mockDestroy.mockClear();
    mockEnd.mockImplementation((cb?: (err?: Error) => void) => {
      if (cb) cb();
    });
    mockCreateConnection.mockReturnValue({
      connect: mockConnect,
      destroy: mockDestroy,
      end: mockEnd,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves connection on successful connect', async () => {
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(null);
    });
    const conn = await createDbConnection(config, 'proj', 'stack');
    expect(conn).toBeDefined();
    expect(mockCreateConnection).toHaveBeenCalled();
  });

  it('still resolves connection when info logger throws synchronously', async () => {
    mockCustomLogger.mockImplementation((_p, _s, level: string) => {
      if (level === 'info') throw new Error('sync log');
      return Promise.resolve();
    });
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(null);
    });
    const conn = await createDbConnection(config, 'proj', 'stack');
    expect(conn).toBeDefined();
  });

  it('still resolves connection when info logger rejects asynchronously', async () => {
    mockCustomLogger.mockImplementation((_p, _s, level: string) =>
      level === 'info' ? Promise.reject(new Error('async log')) : Promise.resolve()
    );
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(null);
    });
    const conn = await createDbConnection(config, 'proj', 'stack');
    expect(conn).toBeDefined();
  });

  it('rejects when connect returns error', async () => {
    const dbErr = new Error('conn refused');
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(dbErr);
    });
    await expect(createDbConnection(config, 'proj', 'stack')).rejects.toThrow('conn refused');
    expect(mockEnd).toHaveBeenCalled();
  });

  it('rejects with original DB error when error logger throws synchronously', async () => {
    const dbErr = new Error('conn refused');
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(dbErr);
    });
    mockCustomLogger.mockImplementation((_p, _s, level: string) => {
      if (level === 'error') throw new Error('logger broke');
      return Promise.resolve();
    });
    await expect(createDbConnection(config, 'proj', 'stack')).rejects.toThrow('conn refused');
  });

  it('logs warn when connection.end reports an error after connect failure', async () => {
    const dbErr = new Error('conn refused');
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(dbErr);
    });
    mockEnd.mockImplementation((cb?: (e?: Error) => void) => {
      if (cb) cb(new Error('end failed'));
    });
    await expect(createDbConnection(config, 'proj', 'stack')).rejects.toThrow('conn refused');
  });

  it('returns null when createConnection throws synchronously', async () => {
    mockCreateConnection.mockImplementation(() => {
      throw new Error('bad config');
    });
    const conn = await createDbConnection(config, 'proj', 'stack');
    expect(conn).toBeNull();
  });

  it('times out when connect never completes', async () => {
    vi.useFakeTimers();
    mockConnect.mockImplementation(() => {});
    const p = createDbConnection(config, 'proj', 'stack', 5000);
    vi.advanceTimersByTime(5000);
    await expect(p).rejects.toThrow('timed out');
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('getDbConnection throws when connection is null', async () => {
    mockCreateConnection.mockImplementation(() => {
      throw new Error('fail');
    });
    await expect(getDbConnection(config, 'p', 's')).rejects.toThrow('Could not establish database connection');
  });

  it('getDbConnection returns connection on success', async () => {
    mockConnect.mockImplementation((cb: (err: Error | null) => void) => {
      cb(null);
    });
    const conn = await getDbConnection(config, 'p', 's');
    expect(conn).toBe(mockCreateConnection.mock.results[0].value);
  });
});
