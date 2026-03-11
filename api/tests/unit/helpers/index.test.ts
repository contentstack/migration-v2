import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConnect, mockEnd, mockDestroy, mockCreateConnection } = vi.hoisted(() => {
  const mockConnect = vi.fn();
  const mockEnd = vi.fn();
  const mockDestroy = vi.fn();
  const mockCreateConnection = vi.fn(() => ({
    connect: mockConnect,
    end: mockEnd,
    destroy: mockDestroy,
  }));
  return { mockConnect, mockEnd, mockDestroy, mockCreateConnection };
});

vi.mock('mysql2', () => ({
  default: {
    createConnection: mockCreateConnection,
  },
}));

vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import { createDbConnection, getDbConnection } from '../../../src/helper/index.js';

describe('helper/index', () => {
  const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'testdb',
    port: 3306,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('createDbConnection', () => {
    it('should create a MySQL connection successfully', async () => {
      mockConnect.mockImplementation((cb: any) => cb(null));

      const connectionPromise = createDbConnection(dbConfig, 'proj-1', 'stack-1');
      vi.runAllTimers();
      const connection = await connectionPromise;

      expect(connection).toBeTruthy();
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'testdb',
          port: 3306,
        })
      );
    });

    it('should reject on connection error', async () => {
      const dbError = new Error('Access denied');
      mockConnect.mockImplementation((cb: any) => cb(dbError));
      mockEnd.mockImplementation((cb: any) => cb(null));

      const connectionPromise = createDbConnection(dbConfig);
      vi.runAllTimers();

      await expect(connectionPromise).rejects.toThrow('Access denied');
    });

    it('should reject on connection timeout', async () => {
      mockConnect.mockImplementation(() => {
        // Never calls callback, simulating hang
      });

      const connectionPromise = createDbConnection(dbConfig, '', '', 100);
      vi.advanceTimersByTime(150);

      await expect(connectionPromise).rejects.toThrow('timed out');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should return null on synchronous createConnection error', async () => {
      mockCreateConnection.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      const result = await createDbConnection(dbConfig);
      expect(result).toBeNull();
    });
  });

  describe('getDbConnection', () => {
    it('should return connection when createDbConnection succeeds', async () => {
      mockConnect.mockImplementation((cb: any) => cb(null));
      mockCreateConnection.mockReturnValue({
        connect: mockConnect,
        end: mockEnd,
        destroy: mockDestroy,
      });

      const connectionPromise = getDbConnection(dbConfig, 'proj-1', 'stack-1');
      vi.runAllTimers();
      const connection = await connectionPromise;

      expect(connection).toBeTruthy();
    });

    it('should throw when connection is null', async () => {
      mockCreateConnection.mockImplementation(() => {
        throw new Error('Cannot connect');
      });

      await expect(getDbConnection(dbConfig)).rejects.toThrow();
    });
  });
});
