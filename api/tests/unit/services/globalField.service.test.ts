import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockHttps,
  mockGetAuthToken,
  mockFsExistsSync,
  mockFsMkdirSync,
  mockFsPromisesReadFile,
  mockFsPromisesMkdir,
  mockFsPromisesWriteFile,
  mockPathJoin,
  mockPathDirname,
} = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockGetAuthToken: vi.fn(),
  mockFsExistsSync: vi.fn(),
  mockFsMkdirSync: vi.fn(),
  mockFsPromisesReadFile: vi.fn(),
  mockFsPromisesMkdir: vi.fn(),
  mockFsPromisesWriteFile: vi.fn(),
  mockPathJoin: vi.fn((...args: string[]) => args.join('/')),
  mockPathDirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/auth.utils.js', () => ({ default: mockGetAuthToken }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: { CS_API: { NA: 'https://api.contentstack.io/v3', EU: 'https://eu-api.contentstack.com/v3' } },
}));
vi.mock('fs', () => ({
  default: {
    existsSync: mockFsExistsSync,
    mkdirSync: mockFsMkdirSync,
    promises: {
      readFile: mockFsPromisesReadFile,
      mkdir: mockFsPromisesMkdir,
      writeFile: mockFsPromisesWriteFile,
    },
  },
}));
vi.mock('path', () => ({
  default: { join: mockPathJoin, dirname: mockPathDirname },
}));

import { globalFieldServie } from '../../../src/services/globalField.service.js';

describe('globalField.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthToken.mockResolvedValue('cs-auth-token');
    mockHttps.mockResolvedValue({
      status: 200,
      data: {
        global_fields: [
          { uid: 'gf-1', title: 'SEO', schema: {} },
          { uid: 'gf-2', title: 'Meta', schema: {} },
        ],
      },
    });
    mockFsExistsSync.mockReturnValue(false);
    mockFsPromisesReadFile.mockResolvedValue('[]');
    mockFsPromisesMkdir.mockResolvedValue(undefined);
    mockFsPromisesWriteFile.mockResolvedValue(undefined);
  });

  describe('createGlobalField', () => {
    it('should fetch global fields from CS API and write to file', async () => {
      await globalFieldServie.createGlobalField({
        region: 'NA',
        user_id: 'user-123',
        stackId: 'stack-abc',
        current_test_stack_id: 'test-stack-1',
      });

      expect(mockGetAuthToken).toHaveBeenCalledWith('NA', 'user-123');
      expect(mockHttps).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('global_fields'),
          headers: expect.objectContaining({
            api_key: 'stack-abc',
            authtoken: 'cs-auth-token',
          }),
        })
      );
      expect(mockFsPromisesWriteFile).toHaveBeenCalled();
      const [, writtenData] = mockFsPromisesWriteFile.mock.calls[0];
      const parsed = JSON.parse(writtenData);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].uid).toBe('gf-1');
    });

    it('should merge new global fields with existing file data', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue(
        JSON.stringify([{ uid: 'gf-existing', title: 'Existing' }])
      );

      await globalFieldServie.createGlobalField({
        region: 'NA',
        user_id: 'user-123',
        stackId: 'stack-abc',
        current_test_stack_id: 'test-stack-2',
      });

      const [, writtenData] = mockFsPromisesWriteFile.mock.calls[0];
      const parsed = JSON.parse(writtenData);
      expect(parsed).toHaveLength(3);
      const uids = parsed.map((gf: { uid: string }) => gf.uid);
      expect(uids).toContain('gf-1');
      expect(uids).toContain('gf-2');
      expect(uids).toContain('gf-existing');
    });

    it('should create directory when it does not exist', async () => {
      mockFsExistsSync.mockReturnValue(false);

      await globalFieldServie.createGlobalField({
        region: 'NA',
        user_id: 'user-123',
        stackId: 'stack-abc',
        current_test_stack_id: 'test-stack-3',
      });

      expect(mockFsMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should return error object when writeFile fails', async () => {
      mockFsPromisesWriteFile.mockRejectedValue(new Error('Write failed'));

      const result = await globalFieldServie.createGlobalField({
        region: 'NA',
        user_id: 'user-123',
        stackId: 'stack-abc',
        current_test_stack_id: 'test-stack-4',
      });

      expect(result).toEqual({
        data: expect.any(Error),
        status: 500,
      });
    });

    it('should handle invalid JSON in existing file', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue('invalid json {');

      await globalFieldServie.createGlobalField({
        region: 'NA',
        user_id: 'user-123',
        stackId: 'stack-abc',
        current_test_stack_id: 'test-stack-5',
      });

      expect(mockFsPromisesWriteFile).toHaveBeenCalled();
    });

    it('should use current_test_stack_id when provided', async () => {
      await globalFieldServie.createGlobalField({
        region: 'EU',
        user_id: 'user-456',
        stackId: 'stack-eu',
        current_test_stack_id: 'eu-test-stack',
      });

      expect(mockFsPromisesWriteFile).toHaveBeenCalled();
    });
  });
});
