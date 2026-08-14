import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MIGRATION_DATA_CONFIG } from '../../../src/constants/index.js';

const {
  mockHttps,
  mockGetAuthToken,
  mockProjectRead,
  mockProjectUpdate,
  mockChainGet,
  mockProjects,
  mockFsExistsSync,
  mockFsReadDirSync,
  mockFsPromisesReadFile,
  mockFsPromisesAppendFile,
  mockFsPromisesRealpath,
  mockFsPromisesLstat,
  mockFsMkdirSync,
  mockFsWriteFileSync,
  mockFsAppendFileSync,
} = vi.hoisted(() => {
  const projects = [
    {
      id: 'proj-1',
      org_id: 'org-123',
      test_stacks: [] as any[],
      stackDetails: { master_locale: 'en-us' },
      legacy_cms: { cms: 'wordpress' },
      current_test_stack_id: '',
      destination_stack_id: '',
      current_step: 1,
    },
  ];
  return {
    mockHttps: vi.fn(),
    mockGetAuthToken: vi.fn(),
    mockProjectRead: vi.fn(),
    mockProjectUpdate: vi.fn(),
    mockChainGet: vi.fn(),
    mockProjects: projects,
    mockFsExistsSync: vi.fn(),
    mockFsReadDirSync: vi.fn(),
    mockFsPromisesReadFile: vi.fn(),
    mockFsPromisesAppendFile: vi.fn(),
    mockFsPromisesRealpath: vi.fn(),
    mockFsPromisesLstat: vi.fn(),
    mockFsMkdirSync: vi.fn(),
    mockFsWriteFileSync: vi.fn(),
    mockFsAppendFileSync: vi.fn(),
  };
});

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/auth.utils.js', () => ({ default: mockGetAuthToken }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/config/index.js', () => ({
  config: {
    CS_API: { NA: 'https://api.contentstack.io/v3' },
    CS_URL: { NA: 'https://app.contentstack.com' },
    LOG_FILE_PATH: '/tmp/test.log',
  },
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    update: mockProjectUpdate,
    chain: {
      get: (...args: unknown[]) => {
        const chain = mockChainGet(...args);
        return chain;
      },
    },
    data: { projects: mockProjects },
  },
}));

vi.mock('../../../src/services/sitecore.service.js', () => ({
  siteCoreService: {
    createEntry: vi.fn().mockResolvedValue(undefined),
    createLocale: vi.fn().mockResolvedValue(undefined),
    createEnvironment: vi.fn().mockResolvedValue(undefined),
    createVersionFile: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../src/services/drupal.service.js', () => ({
  drupalService: {
    createQuery: vi.fn().mockResolvedValue(undefined),
    generateContentTypeSchemas: vi.fn().mockResolvedValue(undefined),
    createAssets: vi.fn().mockResolvedValue(undefined),
    createRefrence: vi.fn().mockResolvedValue(undefined),
    createTaxonomy: vi.fn().mockResolvedValue(undefined),
    createEntry: vi.fn().mockResolvedValue(undefined),
    createLocale: vi.fn().mockResolvedValue(undefined),
    createVersionFile: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../src/services/wordpress.service.js', () => ({
  wordpressService: {
    getAllAssets: vi.fn().mockResolvedValue(undefined),
    createTaxonomy: vi.fn().mockResolvedValue(undefined),
    createEntry: vi.fn().mockResolvedValue(undefined),
    createLocale: vi.fn().mockResolvedValue(undefined),
    createVersionFile: vi.fn().mockResolvedValue(undefined),
    dropInArticleContentTypes: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../src/services/contentful.service.js', () => ({
  contentfulService: {
    createLocale: vi.fn().mockResolvedValue(undefined),
    createRefrence: vi.fn().mockResolvedValue(undefined),
    createWebhooks: vi.fn().mockResolvedValue(undefined),
    createEnvironment: vi.fn().mockResolvedValue(undefined),
    createTaxonomy: vi.fn().mockResolvedValue(undefined),
    createAssets: vi.fn().mockResolvedValue(undefined),
    createEntry: vi.fn().mockResolvedValue(undefined),
    createVersionFile: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../src/services/aem.service.js', () => ({
  aemService: {
    createAssets: vi.fn().mockResolvedValue(undefined),
    createEntry: vi.fn().mockResolvedValue(undefined),
    createLocale: vi.fn().mockResolvedValue(undefined),
    createVersionFile: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../src/services/marketplace.service.js', () => ({
  marketPlaceAppService: { createAppManifest: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src/services/extension.service.js', () => ({
  extensionService: { createExtension: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src/services/globalField.service.js', () => ({
  globalFieldServie: { createGlobalField: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src/services/taxonomy.service.js', () => ({
  taxonomyService: { createTaxonomy: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src/services/runCli.service.js', () => ({
  utilsCli: { runCli: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src/utils/field-attacher.utils.js', () => ({
  fieldAttacher: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../src/utils/test-folder-creator.utils.js', () => ({
  testFolderCreator: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/server.js', () => ({ setLogFilePath: vi.fn() }));

vi.mock('fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => mockFsExistsSync(...args),
    readdirSync: (...args: unknown[]) => mockFsReadDirSync(...args),
    mkdirSync: (...args: unknown[]) => mockFsMkdirSync(...args),
    writeFileSync: (...args: unknown[]) => mockFsWriteFileSync(...args),
    appendFileSync: (...args: unknown[]) => mockFsAppendFileSync(...args),
    promises: {
      readFile: (...args: unknown[]) => mockFsPromisesReadFile(...args),
      lstat: (...args: unknown[]) => mockFsPromisesLstat(...args),
    },
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockFsPromisesReadFile,
    appendFile: mockFsPromisesAppendFile,
    realpath: mockFsPromisesRealpath,
    lstat: mockFsPromisesLstat,
  },
}));

vi.mock('../../../src/utils/sanitize-path.utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/sanitize-path.utils.js')>();
  return {
    ...actual,
    getSafePath: vi.fn((p: string) => p),
  };
});

import { migrationService } from '../../../src/services/migration.service.js';

const createMockReq = (overrides: Record<string, unknown> = {}) =>
  ({
    params: { orgId: 'org-123', projectId: 'proj-1' },
    body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
    ...overrides,
  }) as any;

describe('migration.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthToken.mockResolvedValue('cs-auth-token');
    mockProjectRead.mockResolvedValue(undefined);
    mockProjectUpdate.mockImplementation((fn: (data: any) => void) => {
      fn({ projects: [...mockProjects] });
    });
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(mockProjects[0]) }),
      findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
    });
    mockFsPromisesRealpath.mockRejectedValue(new Error('File not found'));
  });

  describe('createTestStack', () => {
    it('should create test stack and update project on success', async () => {
      mockHttps.mockResolvedValue({
        status: 201,
        data: { stack: { api_key: 'test-stack-1', name: 'MyStack-Test-1' } },
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          name: 'MyStack',
        },
      });

      const result = await migrationService.createTestStack(req);

      expect(result.status).toBe(201);
      expect(result.data.data.stack.api_key).toBe('test-stack-1');
      expect(result.data.url).toContain('test-stack-1');
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should return error when create stack API fails', async () => {
      vi.spyOn(
        await import('../../../src/utils/index.js'),
        'safePromise'
      ).mockImplementation((p: Promise<unknown>) =>
        p.then(() => [
          { response: { status: 400, data: { error: 'Bad request' } } },
          null,
        ] as any)
      );

      mockHttps.mockResolvedValue({ status: 201, data: {} });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false }, name: 'Test' },
      });

      const result = await migrationService.createTestStack(req);

      expect(result.status).toBe(400);
      expect(result.data).toEqual({ error: 'Bad request' });
    });

    it('should throw when getAuthtoken or ProjectModelLowdb fails', async () => {
      mockGetAuthToken.mockRejectedValue(new Error('Auth failed'));

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          name: 'MyStack',
        },
      });

      await expect(migrationService.createTestStack(req)).rejects.toThrow();
    });

    it('should create Drupal test stack and generate queries when CMS is Drupal', async () => {
      const drupalProject = {
        ...mockProjects[0],
        legacy_cms: {
          cms: 'drupal',
          mySQLDetails: {
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'drupal',
            port: 3306,
          },
        },
        test_stacks: [],
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(drupalProject) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      mockHttps.mockResolvedValue({
        status: 201,
        data: { stack: { api_key: 'drupal-test-stack', name: 'Drupal-Test-1' } },
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          name: 'Drupal',
        },
      });

      const result = await migrationService.createTestStack(req);

      expect(result.status).toBe(201);
      expect(mockProjectUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteTestStack', () => {
    it('should delete test stack and remove from project on success', async () => {
      mockHttps.mockResolvedValue({ status: 200, data: {} });

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          stack_key: 'test-stack-1',
        },
      });

      const result = await migrationService.deleteTestStack(req);

      expect(result.status).toBe(200);
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should return error when delete API fails', async () => {
      vi.spyOn(
        await import('../../../src/utils/index.js'),
        'safePromise'
      ).mockImplementation((p: Promise<unknown>) =>
        p.then(() => [
          { response: { status: 404, data: { error: 'Not found' } } },
          null,
        ] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: {} });

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          stack_key: 'test-stack-1',
        },
      });

      const result = await migrationService.deleteTestStack(req);

      expect(result.status).toBe(404);
      expect(result.data).toEqual({ error: 'Not found' });
    });

    it('should still return success when index is -1 (stack not in project)', async () => {
      mockHttps.mockResolvedValue({ status: 200, data: {} });
      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(mockProjects[0]) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
      });

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          stack_key: 'test-stack-1',
        },
      });

      const result = await migrationService.deleteTestStack(req);

      expect(result.status).toBe(200);
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });

    it('should throw when getAuthtoken fails', async () => {
      mockGetAuthToken.mockRejectedValue(new Error('Token error'));

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          stack_key: 'test-stack-1',
        },
      });

      await expect(migrationService.deleteTestStack(req)).rejects.toThrow();
    });
  });

  describe('startTestMigration', () => {
    it('should run without throwing when project has current_test_stack_id (WordPress)', async () => {
      const projectWithTestStack = {
        ...mockProjects[0],
        current_test_stack_id: 'test-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: { cms: 'wordpress', file_path: '/tmp/wp' },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });

    it('should run for Sitecore CMS when project has current_test_stack_id', async () => {
      const projectWithTestStack = {
        ...mockProjects[0],
        current_test_stack_id: 'test-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: { cms: 'sitecore v9', file_path: '/tmp/sc' },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });

    it('should run for Contentful CMS when project has current_test_stack_id', async () => {
      const projectWithTestStack = {
        ...mockProjects[0],
        current_test_stack_id: 'test-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: { cms: 'contentful', file_path: '/tmp/cf/' },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });

    it('should run for AEM CMS when project has current_test_stack_id', async () => {
      const projectWithTestStack = {
        ...mockProjects[0],
        current_test_stack_id: 'test-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: { cms: 'aem', file_path: '/tmp/aem' },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });

    it('should run for Drupal CMS when project has current_test_stack_id', async () => {
      const projectWithTestStack = {
        ...mockProjects[0],
        current_test_stack_id: 'test-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: {
          cms: 'drupal',
          file_path: '/tmp/drupal',
          mySQLDetails: {
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'drupal',
            port: 3306,
          },
        },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
        content_mapper: [],
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });

    it('should do nothing when project has no current_test_stack_id', async () => {
      const projectNoTestStack = {
        ...mockProjects[0],
        current_test_stack_id: '',
        extract_path: '/tmp/extract',
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectNoTestStack) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startTestMigration(req)).resolves.not.toThrow();
    });
  });

  describe('startMigration', () => {
    it('should run without throwing when project has destination_stack_id', async () => {
      const projectWithDest = {
        ...mockProjects[0],
        destination_stack_id: 'dest-stack-1',
        extract_path: '/tmp/extract',
        legacy_cms: { cms: 'wordpress', file_path: '/tmp/wp' },
        stackDetails: { master_locale: 'en-us' },
        mapperKeys: {},
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectWithDest) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const migrationDataBase = path.resolve(process.cwd(), MIGRATION_DATA_CONFIG.DATA);
      const assetsIndexPath = path.join(
        migrationDataBase,
        'dest-stack-1',
        MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME,
        MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE,
      );

      mockFsPromisesLstat.mockResolvedValueOnce({
        isSymbolicLink: () => false,
        isFile: () => true,
      });
      mockFsPromisesRealpath.mockImplementation(async (p: string | URL) => {
        const s = path.normalize(String(p));
        if (s === path.normalize(assetsIndexPath)) {
          return assetsIndexPath;
        }
        throw new Error('File not found');
      });
      mockFsPromisesReadFile.mockImplementation(async (p: string | URL) => {
        const s = path.normalize(String(p));
        if (s === path.normalize(assetsIndexPath)) {
          return '{}';
        }
        return '';
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await expect(migrationService.startMigration(req)).resolves.not.toThrow();
      expect(mockProjectUpdate).toHaveBeenCalled();
      expect(mockFsPromisesLstat).toHaveBeenCalled();
      expect(mockFsWriteFileSync).toHaveBeenCalled();
    });

    it('should do nothing when project has no destination_stack_id', async () => {
      const projectNoDest = {
        ...mockProjects[0],
        destination_stack_id: '',
        extract_path: '/tmp/extract',
      };

      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(projectNoDest) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-123', is_sso: false } },
      });

      await migrationService.startMigration(req);

      expect(mockProjectUpdate).toHaveBeenCalled();
    });
  });

  describe('getLogs', () => {
    it('should return logs when file exists with valid logs', async () => {
      mockFsExistsSync.mockReturnValue(true);
      const logLine1 = JSON.stringify({ level: 'info', message: 'test', id: 0 });
      const logLine2 = JSON.stringify({ level: 'error', message: 'test2', id: 1 });
      mockFsPromisesReadFile.mockResolvedValue(logLine1 + '\n' + logLine2 + '\n');

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
          searchText: 'null',
          filter: 'all',
        },
      });

      const result = await migrationService.getLogs(req);

      expect(result.status).toBe(200);
      expect(result.logs).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.filterOptions).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it('should return empty logs when file has no valid log entries', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue('invalid\nnotjson\n');

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
        },
      });

      const result = await migrationService.getLogs(req);

      expect(result.status).toBe(200);
      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw BadRequestError when projectId contains ..', async () => {
      const req = createMockReq({
        params: {
          projectId: '..',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
        },
      });

      await expect(migrationService.getLogs(req)).rejects.toThrow('Invalid projectId or stackId');
    });

    it('should throw BadRequestError when stackId contains ..', async () => {
      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: '../..',
          limit: '10',
          startIndex: '0',
        },
      });

      await expect(migrationService.getLogs(req)).rejects.toThrow('Invalid projectId or stackId');
    });

    it('should throw BadRequestError when projectId is missing', async () => {
      const req = createMockReq({
        params: {
          projectId: '',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
        },
      });

      await expect(migrationService.getLogs(req)).rejects.toThrow('Invalid projectId or stackId');
    });

    it('should throw BadRequestError when stackId is missing', async () => {
      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: '',
          limit: '10',
          startIndex: '0',
        },
      });

      await expect(migrationService.getLogs(req)).rejects.toThrow('Invalid projectId or stackId');
    });

    it('should throw BadRequestError when log file does not exist', async () => {
      mockFsExistsSync.mockReturnValue(false);

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
        },
      });

      await expect(migrationService.getLogs(req)).rejects.toThrow();
    });

    it('should apply filter when filter is not "all"', async () => {
      mockFsExistsSync.mockReturnValue(true);
      const logLine1 = JSON.stringify({ level: 'info', message: 'info msg', id: 0 });
      const logLine2 = JSON.stringify({ level: 'error', message: 'error msg', id: 1 });
      mockFsPromisesReadFile.mockResolvedValue(logLine1 + '\n' + logLine2 + '\n');

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
          filter: 'error',
        },
      });

      const result = await migrationService.getLogs(req);

      expect(result.status).toBe(200);
      expect(result.logs).toBeDefined();
    });

    it('should apply searchText when provided', async () => {
      mockFsExistsSync.mockReturnValue(true);
      const logLine1 = JSON.stringify({
        level: 'info',
        message: 'Starting audit process',
        methodName: 'audit',
        timestamp: '2024-01-01',
        id: 0,
      });
      mockFsPromisesReadFile.mockResolvedValue(logLine1 + '\n');

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          limit: '10',
          startIndex: '0',
          searchText: 'audit',
        },
      });

      const result = await migrationService.getLogs(req);

      expect(result.status).toBe(200);
      expect(result.logs).toBeDefined();
    });

    it('should use default limit and startIndex when not provided', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue(
        JSON.stringify({ level: 'info', message: 'test', id: 0 }) + '\n'
      );

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
        },
      });

      const result = await migrationService.getLogs(req);

      expect(result.status).toBe(200);
      expect(result.logs).toBeDefined();
    });
  });

  describe('createSourceLocales', () => {
    it('should update project source locales when project exists', async () => {
      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
          locale: [{ code: 'en-us', name: 'English' }],
        },
      });

      await expect(migrationService.createSourceLocales(req)).resolves.not.toThrow();
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should not throw when project index is -1', async () => {
      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(null) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
      });

      const req = createMockReq({
        params: { projectId: 'nonexistent' },
        body: { locale: [] },
      });

      await expect(migrationService.createSourceLocales(req)).resolves.not.toThrow();
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });

    it('should throw when ProjectModelLowdb.read fails', async () => {
      mockProjectRead.mockRejectedValue(new Error('DB read failed'));

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: { locale: [{ code: 'en-us', name: 'English' }] },
      });

      await expect(migrationService.createSourceLocales(req)).rejects.toThrow();
    });
  });

  describe('updateLocaleMapper', () => {
    it('should update master_locale and locales when project exists', async () => {
      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: {
          master_locale: 'en-us',
          locales: [{ code: 'fr', name: 'French' }],
        },
      });

      await expect(migrationService.updateLocaleMapper(req)).resolves.not.toThrow();
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should not throw when project index is -1', async () => {
      mockChainGet.mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(null) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
      });

      const req = createMockReq({
        params: { projectId: 'nonexistent' },
        body: { master_locale: 'en-us', locales: [] },
      });

      await expect(migrationService.updateLocaleMapper(req)).resolves.not.toThrow();
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });

    it('should throw when ProjectModelLowdb.read fails', async () => {
      mockProjectRead.mockRejectedValue(new Error('DB read failed'));

      const req = createMockReq({
        params: { projectId: 'proj-1' },
        body: { master_locale: 'en-us', locales: [] },
      });

      await expect(migrationService.updateLocaleMapper(req)).rejects.toThrow();
    });
  });

  describe('getAuditData', () => {
    it('should throw BadRequestError when projectId contains ..', async () => {
      const req = createMockReq({
        params: {
          projectId: '..bad',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Invalid projectId, stackId, or moduleName'
      );
    });

    it('should throw BadRequestError when stackId contains ..', async () => {
      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: '..stack',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Invalid projectId, stackId, or moduleName'
      );
    });

    it('should throw BadRequestError when moduleName contains ..', async () => {
      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: '..entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Invalid projectId, stackId, or moduleName'
      );
    });

    it('should throw when stack folder not found in migration-data', async () => {
      mockFsReadDirSync.mockReturnValue(['other-stack-folder']);

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Migration data not found for this stack'
      );
    });

    it('should throw when audit log path does not exist', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync.mockReturnValue(false);

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Audit log path not found'
      );
    });

    it('should return audit data when files exist', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      mockFsPromisesReadFile.mockResolvedValue(
        JSON.stringify([{ uid: 'item-1', title: 'Test', data_type: 'entry' }])
      );

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      const result = await migrationService.getAuditData(req);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.totalCount).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should throw when no audit data found for module', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync.mockReturnValue(false);

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'nonexistent',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow();
    });

    it('should apply filter when filter is not "all"', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue(
        JSON.stringify([
          { uid: '1', data_type: 'entry', title: 'Entry 1' },
          { uid: '2', data_type: 'asset', title: 'Asset 1' },
        ])
      );

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'entry-asset',
        },
      });

      const result = await migrationService.getAuditData(req);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    });

    it('should throw on invalid JSON in audit file', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync.mockReturnValue(true);
      mockFsPromisesReadFile.mockResolvedValue('invalid json {');

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'entries',
          limit: '10',
          startIndex: '0',
          searchText: '',
          filter: 'all',
        },
      });

      await expect(migrationService.getAuditData(req)).rejects.toThrow(
        'Invalid JSON format in audit file'
      );
    });

    it('should apply searchText for Entries_Select_feild module', async () => {
      mockFsReadDirSync.mockReturnValue(['stack-1-abc']);
      mockFsExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      mockFsPromisesReadFile.mockResolvedValue(
        JSON.stringify([
          {
            uid: '1',
            data_type: 'entry',
            title: 'Hello World',
            display_type: 'entry',
          },
        ])
      );

      const req = createMockReq({
        params: {
          projectId: 'proj-1',
          stackId: 'stack-1',
          moduleName: 'Entries_Select_feild',
          limit: '10',
          startIndex: '0',
          searchText: 'Hello',
          filter: 'all',
        },
      });

      const result = await migrationService.getAuditData(req);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    });
  });
});
