import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('mysql2', () => ({
  default: {
    createConnection: vi.fn()
  }
}));

vi.mock('../../src/utils/custom-logger.utils.js', () => ({
  default: vi.fn().mockResolvedValue(undefined)
}));

describe('helper/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDbConnection', () => {
    it('should create connection with default timeout', async () => {
      const mysql = await import('mysql2');
      const mockConnection = {
        connect: vi.fn().mockImplementation((callback) => callback(null)),
        destroy: vi.fn(),
        end: vi.fn().mockImplementation((callback) => callback && callback())
      };
      
      (mysql.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(mockConnection);

      const { createDbConnection } = await import('../../../src/helper/index.js');
      
      const config = {
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: '3306'
      };

      const result = await createDbConnection(config);

      expect(result).toBe(mockConnection);
      expect(mysql.default.createConnection).toHaveBeenCalledWith({
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: 3306,
        connectTimeout: 30000
      });
      expect(mockConnection.connect).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      const mysql = await import('mysql2');
      const mockConnection = {
        connect: vi.fn().mockImplementation((callback) => callback(new Error('Connection failed'))),
        destroy: vi.fn(),
        end: vi.fn().mockImplementation((callback) => callback && callback()),
        end: vi.fn().mockImplementation((callback) => callback && callback())
      };
      
      (mysql.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(mockConnection);

      const { createDbConnection } = await import('../../../src/helper/index.js');
      
      const config = {
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: '3306'
      };

      await expect(createDbConnection(config, 'test-project', 'test-stack')).rejects.toThrow('Connection failed');
    });

    it('should handle connection timeout', async () => {
      vi.useFakeTimers();
      
      const mysql = await import('mysql2');
      const mockConnection = {
        connect: vi.fn().mockImplementation(() => {
          // Never call the callback to simulate hanging
        }),
        destroy: vi.fn(),
        end: vi.fn().mockImplementation((callback) => callback && callback())
      };
      
      (mysql.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(mockConnection);

      const { createDbConnection } = await import('../../../src/helper/index.js');
      
      const config = {
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: '3306'
      };

      const connectionPromise = createDbConnection(config, 'test-project', 'test-stack', 1000);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(connectionPromise).rejects.toThrow('Database connection timed out after 1000ms');
      expect(mockConnection.destroy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should use custom timeout', async () => {
      const mysql = await import('mysql2');
      const mockConnection = {
        connect: vi.fn().mockImplementation((callback) => callback(null)),
        destroy: vi.fn(),
        end: vi.fn().mockImplementation((callback) => callback && callback())
      };
      
      (mysql.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(mockConnection);

      const { createDbConnection } = await import('../../../src/helper/index.js');
      
      const config = {
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: '3306'
      };

      await createDbConnection(config, 'test-project', 'test-stack', 5000);

      expect(mysql.default.createConnection).toHaveBeenCalledWith({
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: 3306,
        connectTimeout: 5000
      });
    });

    it('should handle destroy error gracefully during timeout', async () => {
      vi.useFakeTimers();
      
      const mysql = await import('mysql2');
      const mockConnection = {
        connect: vi.fn().mockImplementation(() => {
          // Never call the callback to simulate hanging
        }),
        destroy: vi.fn(),
        end: vi.fn().mockImplementation((callback) => callback && callback()).mockImplementation(() => {
          throw new Error('Destroy failed');
        })
      };
      
      (mysql.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(mockConnection);

      const { createDbConnection } = await import('../../../src/helper/index.js');
      
      const config = {
        host: 'localhost',
        user: 'test',
        password: 'password',
        database: 'testdb',
        port: '3306'
      };

      const connectionPromise = createDbConnection(config, 'test-project', 'test-stack', 1000);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(1000);

      // Should still reject with timeout error, not destroy error
      await expect(connectionPromise).rejects.toThrow('Database connection timed out after 1000ms');

      vi.useRealTimers();
    });
  });
});