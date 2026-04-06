import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockHttps,
  mockAuthRead,
  mockAuthUserIndex,
  mockFsPromisesMkdir,
  mockFsPromisesWriteFile,
  mockPathJoin,
} = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockAuthRead: vi.fn(),
  mockAuthUserIndex: vi.fn(() => 0),
  mockFsPromisesMkdir: vi.fn(),
  mockFsPromisesWriteFile: vi.fn(),
  mockPathJoin: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: {
      get: vi.fn(() => ({
        findIndex: vi.fn(() => ({
          value: mockAuthUserIndex,
        })),
      })),
    },
    data: {
      users: [{ user_id: 'user-1', region: 'NA', authtoken: 'cs-auth-token' }],
    },
  },
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: { CS_API: { NA: 'https://api.contentstack.io/v3', EU: 'https://eu-api.contentstack.com/v3' } },
}));
vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: mockFsPromisesMkdir,
      writeFile: mockFsPromisesWriteFile,
    },
  },
}));
vi.mock('path', () => ({
  default: { join: mockPathJoin },
}));
vi.mock('../../../src/constants/index.js', () => ({
  MIGRATION_DATA_CONFIG: {
    DATA: './cmsMigrationData',
    TAXONOMIES_DIR_NAME: 'taxonomies',
    TAXONOMIES_FILE_NAME: 'taxonomies.json',
  },
  HTTP_TEXTS: { CS_ERROR: 'Contentstack API error' },
}));

import { taxonomyService } from '../../../src/services/taxonomy.service.js';

describe('taxonomy.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
    mockAuthUserIndex.mockReturnValue(0);
    mockFsPromisesMkdir.mockResolvedValue(undefined);
    mockFsPromisesWriteFile.mockResolvedValue(undefined);
    mockHttps
      .mockResolvedValueOnce({
        status: 200,
        data: {
          taxonomies: [
            { uid: 'tax-1', name: 'Category', description: 'Cat taxonomy' },
          ],
        },
      })
      .mockResolvedValue({
        status: 200,
        data: {
          terms: [
            { uid: 'term-1', name: 'Root', parent_uid: null, children_count: 0 },
          ],
        },
      });
  });

  describe('createTaxonomy', () => {
    it('should fetch taxonomies and create term files', async () => {
      await taxonomyService.createTaxonomy({
        stackId: 'stack-123',
        region: 'NA',
        userId: 'user-1',
        current_test_stack_id: 'test-stack-1',
        orgId: 'org-1',
        projectId: 'proj-1',
      });

      expect(mockHttps).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('taxonomies'),
          headers: expect.objectContaining({
            api_key: 'stack-123',
            authtoken: 'cs-auth-token',
          }),
        })
      );
      expect(mockFsPromisesMkdir).toHaveBeenCalled();
      expect(mockFsPromisesWriteFile).toHaveBeenCalled();
    });

    it('should return error object when taxonomies API fails', async () => {
      mockHttps
        .mockReset()
        .mockRejectedValue({ response: { status: 500, data: { message: 'Error' } } });

      const result = await taxonomyService.createTaxonomy({
        stackId: 'stack-456',
        region: 'NA',
        userId: 'user-1',
        current_test_stack_id: 'test-stack-2',
        orgId: 'org-2',
        projectId: 'proj-2',
      });

      expect(result).toEqual({
        data: { message: 'Error' },
        status: 500,
      });
    });

    it('should create taxonomy JSON file with correct structure', async () => {
      mockHttps
        .mockReset()
        .mockResolvedValueOnce({
          status: 200,
          data: { taxonomies: [{ uid: 'tax-1', name: 'Tags', description: 'Tags taxonomy' }] },
        })
        .mockResolvedValue({
          status: 200,
          data: { terms: [{ uid: 't1', name: 'Tag1', parent_uid: null, children_count: 0 }] },
        });

      await taxonomyService.createTaxonomy({
        stackId: 'stack-789',
        region: 'NA',
        userId: 'user-1',
        current_test_stack_id: 'test-stack-3',
        orgId: 'org-3',
        projectId: 'proj-3',
      });

      const writeCalls = mockFsPromisesWriteFile.mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      const taxonomiesFileCall = writeCalls.find((c) => c[0].includes('taxonomies.json'));
      expect(taxonomiesFileCall).toBeDefined();
      if (taxonomiesFileCall) {
        const parsed = JSON.parse(taxonomiesFileCall[1]);
        expect(parsed['tax-1']).toEqual({
          uid: 'tax-1',
          name: 'Tags',
          description: 'Tags taxonomy',
        });
      }
    });

    it('should recursively fetch descendant terms', async () => {
      mockHttps
        .mockReset()
        .mockResolvedValueOnce({
          status: 200,
          data: {
            taxonomies: [{ uid: 'tax-2', name: 'Nested', description: '' }],
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            terms: [
              { uid: 'root', name: 'Root', parent_uid: null, children_count: 1 },
            ],
          },
        })
        .mockResolvedValue({
          status: 200,
          data: {
            terms: [{ uid: 'child', name: 'Child', parent_uid: 'root', children_count: 0 }],
          },
        });

      await taxonomyService.createTaxonomy({
        stackId: 'stack-nested',
        region: 'NA',
        userId: 'user-1',
        current_test_stack_id: 'test-stack-4',
        orgId: 'org-4',
        projectId: 'proj-4',
      });

      expect(mockHttps.mock.calls.length).toBeGreaterThan(2);
    });

    it('should throw when no user token is found in authentication store', async () => {
      mockAuthUserIndex.mockReturnValue(-1);

      await expect(
        taxonomyService.createTaxonomy({
          stackId: 'stack-err',
          region: 'NA',
          userId: 'user-unknown',
          current_test_stack_id: 'test-stack-5',
          orgId: 'org-5',
          projectId: 'proj-5',
        })
      ).rejects.toThrow('No authentication token found');
    });
  });
});
