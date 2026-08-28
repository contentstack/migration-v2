import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockHttps,
  mockGetAuthToken,
  mockGetProjectUtil,
  mockFetchAllPaginatedData,
  mockProjectRead,
  mockProjectUpdate,
  mockProjectWrite,
  mockContentTypesMapperRead,
  mockContentTypesMapperUpdate,
  mockFieldMapperRead,
  mockFieldMapperUpdate,
  mockUuidv4,
  mockFsPromises,
  mockContentTypesDb,
  mockFieldDb,
  getContentTypesMapperDbMock,
  getFieldMapperDbMock,
  mockEntryMapperDb,
  mockUidMapperDb,
  getEntryMapperDbMock,
  getUidMapperDbMock,
  mockRetryFailedAsset,
  mockAssetMapperDb,
  getAssetMapperDbMock,
  mockFsExistsSync,
  mockFsReadFileSync,
} = vi.hoisted(() => {
  const mockContentTypesMapperRead = vi.fn();
  const mockContentTypesMapperUpdate = vi.fn();
  const mockFieldMapperRead = vi.fn();
  const mockFieldMapperUpdate = vi.fn();
  const mockContentTypesChainGet = vi.fn();
  const mockFieldMapperChainGet = vi.fn();
  const mockContentTypesDb = {
    read: mockContentTypesMapperRead,
    update: mockContentTypesMapperUpdate,
    write: vi.fn(),
    chain: { get: mockContentTypesChainGet },
    data: { ContentTypesMappers: [] as unknown[] },
  };
  const mockFieldDb = {
    read: mockFieldMapperRead,
    update: mockFieldMapperUpdate,
    write: vi.fn(),
    chain: { get: mockFieldMapperChainGet },
    data: { field_mapper: [] as unknown[] },
  };
  const mockEntryMapperRead = vi.fn();
  const mockEntryMapperUpdate = vi.fn();
  const mockEntryMapperChainGet = vi.fn();
  const mockEntryMapperDb = {
    read: mockEntryMapperRead,
    update: mockEntryMapperUpdate,
    write: vi.fn(),
    chain: { get: mockEntryMapperChainGet },
    data: { entry_mapper: [] as unknown[] },
  };
  const mockUidMapperRead = vi.fn();
  const mockUidMapperUpdate = vi.fn();
  const mockUidMapperChainGet = vi.fn();
  const mockUidMapperDb = {
    read: mockUidMapperRead,
    update: mockUidMapperUpdate,
    write: vi.fn(),
    chain: { get: mockUidMapperChainGet },
    data: { entry: {} as Record<string, unknown>, assets: {} as Record<string, unknown> },
  };
  const mockAssetMapperRead = vi.fn();
  const mockAssetMapperChainGet = vi.fn();
  const mockAssetMapperDb = {
    read: mockAssetMapperRead,
    chain: { get: mockAssetMapperChainGet },
    data: { asset_mapper: [] as unknown[] },
  };
  return {
    mockHttps: vi.fn(),
    mockGetAuthToken: vi.fn(),
    mockGetProjectUtil: vi.fn(),
    mockFetchAllPaginatedData: vi.fn(),
    mockProjectRead: vi.fn(),
    mockProjectUpdate: vi.fn(),
    mockProjectWrite: vi.fn(),
    mockContentTypesMapperRead,
    mockContentTypesMapperUpdate,
    mockFieldMapperRead,
    mockFieldMapperUpdate,
    mockUuidv4: vi.fn(() => 'uuid-123'),
    mockFsPromises: { lstat: vi.fn(), readFile: vi.fn(), realpath: vi.fn() },
    mockContentTypesDb,
    mockFieldDb,
    getContentTypesMapperDbMock: vi.fn(() => mockContentTypesDb),
    getFieldMapperDbMock: vi.fn(() => mockFieldDb),
    mockEntryMapperDb,
    mockUidMapperDb,
    getEntryMapperDbMock: vi.fn(() => mockEntryMapperDb),
    getUidMapperDbMock: vi.fn(() => mockUidMapperDb),
    mockRetryFailedAsset: vi.fn(),
    mockAssetMapperDb,
    getAssetMapperDbMock: vi.fn(() => mockAssetMapperDb),
    mockFsExistsSync: vi.fn(() => false),
    mockFsReadFileSync: vi.fn(() => '{}'),
  };
});

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/auth.utils.js', () => ({ default: mockGetAuthToken }));
vi.mock('../../../src/utils/get-project.utils.js', () => ({ default: mockGetProjectUtil }));
vi.mock('../../../src/utils/pagination.utils.js', () => ({ default: mockFetchAllPaginatedData }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: { CS_API: { NA: 'https://api.contentstack.io/v3' } },
}));
vi.mock('uuid', () => ({ v4: mockUuidv4 }));

vi.mock('../../../src/models/project-lowdb.js', () => {
  const mockChainGet = vi.fn();
  return {
    default: {
      read: mockProjectRead,
      update: mockProjectUpdate,
      write: mockProjectWrite,
      chain: { get: mockChainGet },
      data: { projects: [] },
    },
  };
});

vi.mock('../../../src/models/contentTypesMapper-lowdb.js', () => ({
  default: getContentTypesMapperDbMock,
  getContentTypesMapperDb: getContentTypesMapperDbMock,
  ContentTypesMapper: {},
}));

vi.mock('../../../src/models/FieldMapper.js', () => ({
  default: getFieldMapperDbMock,
}));

vi.mock('../../../src/models/EntryMapper.js', () => ({
  default: getEntryMapperDbMock,
}));

vi.mock('../../../src/models/uidMapper.js', () => ({
  default: getUidMapperDbMock,
}));

vi.mock('../../../src/models/assetMapper.js', () => ({
  default: getAssetMapperDbMock,
}));

vi.mock('../../../src/services/contentful.service.js', () => ({
  contentfulService: { retryFailedAsset: mockRetryFailedAsset },
}));

vi.mock('fs', () => {
  const mkdirSync = vi.fn();
  return {
    default: {
      promises: mockFsPromises,
      mkdirSync,
      existsSync: mockFsExistsSync,
      readFileSync: mockFsReadFileSync,
    },
    mkdirSync,
    existsSync: mockFsExistsSync,
    readFileSync: mockFsReadFileSync,
    promises: mockFsPromises,
  };
});

import { contentMapperService } from '../../../src/services/contentMapper.service.js';
import ProjectModelLowdb from '../../../src/models/project-lowdb.js';

const createChain = (opts: {
  find?: unknown;
  findIndex?: number;
  value?: unknown;
  filter?: unknown[];
}) => {
  const findValue = opts.find !== undefined ? opts.find : null;
  const findIndexValue = opts.findIndex !== undefined ? opts.findIndex : -1;
  const filterValue = opts.filter !== undefined ? opts.filter : [];
  return {
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(findValue) }),
    findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(findIndexValue) }),
    filter: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(filterValue) }),
  };
};

describe('contentMapper.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    (mockFieldDb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    (mockEntryMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    (mockUidMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReset();
    mockGetAuthToken.mockResolvedValue('cs-auth-token');
    mockProjectRead.mockResolvedValue(undefined);
    mockContentTypesMapperRead.mockResolvedValue(undefined);
    mockFieldMapperRead.mockResolvedValue(undefined);
    (mockEntryMapperDb.read as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mockUidMapperDb.read as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mockAssetMapperDb.read as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    mockFsExistsSync.mockReturnValue(false);
    mockFsReadFileSync.mockReturnValue('{}');
    mockProjectUpdate.mockImplementation(async (fn: (d: any) => void) => {
      const data = ProjectModelLowdb.data as any;
      if (!data.projects) data.projects = [];
      while (data.projects.length < 2) data.projects.push({});
      fn(data);
    });
    mockContentTypesMapperUpdate.mockImplementation(async (fn: (d: any) => void) => {
      const data = mockContentTypesDb.data as any;
      if (!data.ContentTypesMappers) data.ContentTypesMappers = [];
      while (data.ContentTypesMappers.length < 2) data.ContentTypesMappers.push({});
      fn(data);
    });
    mockFieldMapperUpdate.mockImplementation(async (fn: (d: any) => void) => {
      const data = mockFieldDb.data as any;
      if (!data.field_mapper) data.field_mapper = [];
      fn(data);
    });
    (mockEntryMapperDb.update as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (d: any) => void) => {
      const data = mockEntryMapperDb.data as any;
      if (!data.entry_mapper) data.entry_mapper = [];
      fn(data);
    });
    (mockUidMapperDb.update as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (d: any) => void) => {
      fn(mockUidMapperDb.data as any);
    });
    mockFetchAllPaginatedData.mockResolvedValue([]);
    ProjectModelLowdb.data = { projects: [] };
    mockContentTypesDb.data = { ContentTypesMappers: [] };
    mockFieldDb.data = { field_mapper: [] };
    mockEntryMapperDb.data = { entry_mapper: [] };
    mockUidMapperDb.data = { entry: {}, assets: {} };
    mockAssetMapperDb.data = { asset_mapper: [] };
    (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: null, findIndex: -1 }));
    (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: null, findIndex: -1 }));
    (mockFieldDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: null, findIndex: -1 }));
    (mockEntryMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: null, findIndex: -1 }));
    (mockUidMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: null, findIndex: -1 }));
    (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ filter: [] }));
  });

  describe('putTestData', () => {
    it('should throw BadRequestError when contentTypes is not an array', async () => {
      const req = {
        params: { projectId: 'proj-1' },
        body: { contentTypes: 'invalid' },
      } as any;

      await expect(contentMapperService.putTestData(req)).rejects.toThrow('Invalid contentTypes: Expected an array.');
    });

    it('should throw when project not found', async () => {
      const req = {
        params: { projectId: 'proj-999' },
        body: {
          contentTypes: [
            { id: 'ct-1', otherCmsTitle: 'Blog', fieldMapping: [] },
          ],
        },
      } as any;

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ findIndex: -1, find: null })
      );

      await expect(contentMapperService.putTestData(req)).rejects.toThrow();
    });

    it('should create content mappers successfully', async () => {
      const project = { id: 'proj-1', content_mapper: [], destination_stack_id: 'stack-1' };
      ProjectModelLowdb.data.projects = [project];
      mockProjectWrite.mockResolvedValue(undefined);

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project, findIndex: 0 })
      );

      const req = {
        params: { projectId: 'proj-1' },
        body: {
          contentTypes: [
            { id: 'ct-1', otherCmsTitle: 'Blog', fieldMapping: [{ id: 'f1', otherCmsField: 'title' }] },
          ],
        },
      } as any;

      const result = await contentMapperService.putTestData(req);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    });
  });

  describe('getContentTypes', () => {
    it('should throw when project not found', async () => {
      const req = {
        params: { projectId: 'proj-1', skip: 0, limit: 10 },
      } as any;

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      await expect(contentMapperService.getContentTypes(req)).rejects.toThrow('Sorry, the requested project does not exists.');
    });

    it('should return content types when project has content mappers', async () => {
      const project = { id: 'proj-1', content_mapper: ['ct-1'] };
      const contentMapper = { id: 'ct-1', projectId: 'proj-1', otherCmsTitle: 'Blog' };

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: project }));
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: contentMapper })
      );

      const req = {
        params: { projectId: 'proj-1', skip: 0, limit: 10 },
      } as any;

      const result = await contentMapperService.getContentTypes(req);

      expect(result.status).toBe(200);
      expect(result.count).toBe(1);
      expect(result.contentTypes).toHaveLength(1);
    });

    it('should filter by search when searchText provided', async () => {
      const project = { id: 'proj-1', content_mapper: ['ct-1'] };
      const contentMapper = { id: 'ct-1', projectId: 'proj-1', otherCmsTitle: 'Blog' };

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: project }));
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: contentMapper })
      );

      const req = {
        params: { projectId: 'proj-1', skip: 0, limit: 10, searchText: 'blog' },
      } as any;

      const result = await contentMapperService.getContentTypes(req);

      expect(result.status).toBe(200);
      expect(result.contentTypes).toBeDefined();
    });
  });

  describe('getFieldMapping', () => {
    it('should throw when content type not found', async () => {
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      const req = {
        params: { projectId: 'proj-1', contentTypeId: 'ct-1', skip: 0, limit: 10 },
      } as any;

      await expect(contentMapperService.getFieldMapping(req)).rejects.toThrow('ContentType does not exist');
    });

    it('should return field mapping when content type exists', async () => {
      const contentType = { id: 'ct-1', projectId: 'proj-1', fieldMapping: ['f1'] };
      const fieldData = { id: 'f1', otherCmsField: 'title', contentstackField: 'title' };

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValue(createChain({ find: contentType }));

      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValue(createChain({ find: fieldData }));

      const req = {
        params: { projectId: 'proj-1', contentTypeId: 'ct-1', skip: 0, limit: 10 },
      } as any;

      const result = await contentMapperService.getFieldMapping(req);

      expect(result.status).toBe(200);
      expect(result.fieldMapping).toBeDefined();
    });

    it('should filter by search when searchText provided', async () => {
      const contentType = { id: 'ct-1', projectId: 'proj-1', fieldMapping: ['f1'] };
      const fieldData = { id: 'f1', otherCmsField: 'Title', contentstackField: 'title' };

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValue(createChain({ find: contentType }));
      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValue(createChain({ find: fieldData }));

      const req = {
        params: { projectId: 'proj-1', contentTypeId: 'ct-1', skip: 0, limit: 10, searchText: 'title' },
      } as any;

      const result = await contentMapperService.getFieldMapping(req);
      expect(result.status).toBe(200);
    });
  });

  describe('getExistingContentTypes', () => {
    it('should return content types successfully', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockFetchAllPaginatedData.mockResolvedValue([
        { uid: 'ct-1', title: 'Blog', schema: {} },
      ]);

      const req = {
        params: { projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingContentTypes(req);

      expect(result.contentTypes).toHaveLength(1);
      expect(result.contentTypes[0].uid).toBe('ct-1');
    });

    it('should fetch selected content type when contentTypeUid provided', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockFetchAllPaginatedData.mockResolvedValue([]);
      mockHttps.mockResolvedValue({
        data: { content_type: { uid: 'ct-1', title: 'Blog', schema: {} } },
      });

      const req = {
        params: { projectId: 'proj-1', contentTypeUid: 'ct-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingContentTypes(req);

      expect(result.contentTypes).toBeDefined();
      expect(result.selectedContentType).toBeDefined();
    });
  });

  describe('getExistingGlobalFields', () => {
    it('should return 400 when projectId is missing', async () => {
      const req = {
        params: {},
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingGlobalFields(req);

      expect(result.status).toBe(400);
      expect(result.data).toContain('Project ID');
    });

    it('should return 400 when token payload is missing', async () => {
      const req = {
        params: { projectId: 'proj-1' },
        body: {},
      } as any;

      const result = await contentMapperService.getExistingGlobalFields(req);

      expect(result.status).toBe(400);
      expect(result.data).toContain('Token payload');
    });

    it('should return 404 when project not found', async () => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      const req = {
        params: { projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingGlobalFields(req);

      expect(result.status).toBe(404);
      expect(result.data).toBe('Project not found');
    });

    it('should return 400 when stackId is missing', async () => {
      const project = { id: 'proj-1', destination_stack_id: null };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );

      const req = {
        params: { projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingGlobalFields(req);

      expect(result.status).toBe(400);
      expect(result.data).toContain('Destination stack ID');
    });

    it('should return global fields successfully', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockFetchAllPaginatedData.mockResolvedValue([
        { uid: 'gf-1', title: 'SEO', schema: {} },
      ]);

      const req = {
        params: { projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingGlobalFields(req);

      expect(result.globalFields).toHaveLength(1);
      expect(result.globalFields[0].uid).toBe('gf-1');
    });
  });

  describe('updateContentType', () => {
    it('should return 400 when status prevents update', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [
        { status: 5, current_step: 2 },
      ];

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: { otherCmsTitle: 'Blog' },
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(400);
      expect(result.message).toContain('content mapping is restricted');
    });

    it('should return 400 when contentTypeData is empty', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [
        { status: 1, current_step: 3 },
      ];

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: null,
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(400);
      expect(result.message).toContain('valid ContentType');
    });

    it('should return 400 when field has invalid contentstackFieldType', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [{ status: 1, current_step: 3 }];
      mockContentTypesDb.data.ContentTypesMappers = [{ id: 'ct-1', status: 1 }];

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ findIndex: 0 }))
        .mockReturnValue(createChain({ find: { id: 'ct-1', projectId: 'proj-1', status: 1 } }));

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: {
            otherCmsTitle: 'Blog',
            fieldMapping: [{ id: 'f1', contentstackFieldType: '', contentstackFieldUid: '' }],
          },
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(400);
    });

    it('should update content type successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [{ status: 1, current_step: 3 }];
      mockContentTypesDb.data.ContentTypesMappers = [{ id: 'ct-1', projectId: 'proj-1', status: 1 }];
      mockFieldDb.data.field_mapper = [
        { id: 'f1', contentTypeId: 'ct-1', contentstackFieldType: 'text', contentstackFieldUid: 'f1' },
      ];

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ findIndex: 0 }))
        .mockReturnValue(createChain({ find: { id: 'ct-1', projectId: 'proj-1', status: 1 } }));

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: {
            otherCmsTitle: 'Blog',
            contentstackTitle: 'Blog',
            contentstackUid: 'ct-1',
            fieldMapping: [
              { id: 'f1', contentTypeId: 'ct-1', contentstackFieldType: 'text', contentstackFieldUid: 'f1' },
            ],
          },
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    });

    it('re-asserts mandatory:true for title/url even if the saved payload tries to turn it off', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [{ status: 1, current_step: 3 }];
      mockContentTypesDb.data.ContentTypesMappers = [{ id: 'ct-1', projectId: 'proj-1', status: 1 }];
      mockFieldDb.data.field_mapper = [
        { id: 'f-title', contentTypeId: 'ct-1', contentstackFieldType: 'single_line_text', contentstackFieldUid: 'title', advanced: { mandatory: true } },
        { id: 'f-url', contentTypeId: 'ct-1', contentstackFieldType: 'url', contentstackFieldUid: 'url', advanced: { mandatory: true } },
      ];

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ findIndex: 0 }))
        .mockReturnValue(createChain({ find: { id: 'ct-1', projectId: 'proj-1', status: 1 } }));

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: {
            otherCmsTitle: 'Blog',
            contentstackTitle: 'Blog',
            contentstackUid: 'ct-1',
            fieldMapping: [
              { id: 'f-title', contentTypeId: 'ct-1', contentstackFieldType: 'single_line_text', contentstackFieldUid: 'title', advanced: { mandatory: false } },
              { id: 'f-url', contentTypeId: 'ct-1', contentstackFieldType: 'url', contentstackFieldUid: 'url', advanced: { mandatory: false } },
            ],
          },
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(200);
      expect(mockFieldDb.data.field_mapper[0].advanced.mandatory).toBe(true);
      expect(mockFieldDb.data.field_mapper[1].advanced.mandatory).toBe(true);
    });

    it('leaves mandatory as submitted for a non-title/url field', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [{ status: 1, current_step: 3 }];
      mockContentTypesDb.data.ContentTypesMappers = [{ id: 'ct-1', projectId: 'proj-1', status: 1 }];
      mockFieldDb.data.field_mapper = [
        { id: 'f-summary', contentTypeId: 'ct-1', contentstackFieldType: 'single_line_text', contentstackFieldUid: 'summary', advanced: { mandatory: true } },
      ];

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ findIndex: 0 }))
        .mockReturnValue(createChain({ find: { id: 'ct-1', projectId: 'proj-1', status: 1 } }));

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          contentTypeData: {
            otherCmsTitle: 'Blog',
            contentstackTitle: 'Blog',
            contentstackUid: 'ct-1',
            fieldMapping: [
              { id: 'f-summary', contentTypeId: 'ct-1', contentstackFieldType: 'single_line_text', contentstackFieldUid: 'summary', advanced: { mandatory: false } },
            ],
          },
        },
      } as any;

      const result = await contentMapperService.updateContentType(req);

      expect(result.status).toBe(200);
      expect(mockFieldDb.data.field_mapper[0].advanced.mandatory).toBe(false);
    });
  });

  describe('resetToInitialMapping', () => {
    it('should throw when status prevents reset', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [
        { status: 0, current_step: 2 },
      ];

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      await expect(contentMapperService.resetToInitialMapping(req)).rejects.toThrow(
        'Reseting the content mapping is restricted'
      );
    });

    it('should reset successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      ProjectModelLowdb.data.projects = [{ status: 1, current_step: 3 }];
      const contentTypeData = {
        id: 'ct-1',
        projectId: 'proj-1',
        fieldMapping: ['f1'],
      };
      const fieldData = {
        id: 'f1',
        otherCmsField: 'title',
        backupFieldUid: 'buid',
        backupFieldType: 'text',
        advanced: { initial: {} },
      };

      mockContentTypesDb.data.ContentTypesMappers = [contentTypeData];
      mockFieldDb.data.field_mapper = [fieldData];

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: contentTypeData }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: fieldData }));

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1', contentTypeId: 'ct-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.resetToInitialMapping(req);

      expect(result.status).toBe(200);
      expect(result.message).toContain('restored to its initial mapping');
    });
  });

  describe('resetAllContentTypesMapping', () => {
    it('should throw when content mapper is empty', async () => {
      const project = { id: 'proj-1', content_mapper: [] };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );

      await expect(
        contentMapperService.resetAllContentTypesMapping('proj-1')
      ).rejects.toThrow('content mapper id does not exists');
    });

    it('should reset all content types successfully', async () => {
      const project = { id: 'proj-1', content_mapper: ['ct-1'] };
      const contentType = {
        id: 'ct-1',
        projectId: 'proj-1',
        fieldMapping: ['f1'],
      };
      const fieldData = { id: 'f1', projectId: 'proj-1', backupFieldType: 'text' };

      mockContentTypesDb.data.ContentTypesMappers = [{ ...contentType, contentstackTitle: 'Old' }];
      mockFieldDb.data.field_mapper = [fieldData];

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(createChain({ find: project }));
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: contentType }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: fieldData }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));

      const result = await contentMapperService.resetAllContentTypesMapping('proj-1');

      expect(result).toEqual(project);
    });
  });

  describe('removeMapping', () => {
    it('should throw when project not found', async () => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      await expect(contentMapperService.removeMapping('proj-999')).rejects.toThrow(
        'Sorry, the requested project does not exists.'
      );
    });

    it('should remove mapping successfully', async () => {
      const project = { id: 'proj-1', content_mapper: ['ct-1'] };
      const contentType = { id: 'ct-1', projectId: 'proj-1', fieldMapping: ['f1'] };

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: project }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: contentType }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ findIndex: 0 })
      );

      const result = await contentMapperService.removeMapping('proj-1');

      expect(result).toEqual(project);
    });
  });

  describe('removeContentMapper', () => {
    it('should throw when project not found', async () => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      const req = { params: { projectId: 'proj-999' } } as any;

      await expect(contentMapperService.removeContentMapper(req)).rejects.toThrow(
        'Sorry, the requested project does not exists.'
      );
    });

    it('should remove content mappers successfully', async () => {
      const project = { id: 'proj-1', content_mapper: ['ct-1'] };
      const contentType = { id: 'ct-1', projectId: 'proj-1', fieldMapping: ['f1'] };

      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: project }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(createChain({ find: contentType }))
        .mockReturnValueOnce(createChain({ findIndex: 0 }));
      (mockFieldDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ findIndex: 0 })
      );

      const req = { params: { projectId: 'proj-1' } } as any;

      const result = await contentMapperService.removeContentMapper(req);

      expect(result).toEqual(project);
    });
  });

  describe('getSingleContentTypes', () => {
    it('should return content type successfully', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockHttps.mockResolvedValue({
        data: { content_type: { title: 'Blog', uid: 'ct-1', schema: {} } },
      });

      const req = {
        params: { projectId: 'proj-1', contentTypeUid: 'ct-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getSingleContentTypes(req);

      expect(result.title).toBe('Blog');
      expect(result.uid).toBe('ct-1');
    });

    it('should return error when https fails', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockHttps.mockRejectedValue({ response: { data: 'Error', status: 404 } });

      const req = {
        params: { projectId: 'proj-1', contentTypeUid: 'ct-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getSingleContentTypes(req);

      expect(result.status).toBe(404);
    });
  });

  describe('getSingleGlobalField', () => {
    it('should return global field successfully', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockHttps.mockResolvedValue({
        data: { global_field: { title: 'SEO', uid: 'gf-1', schema: {} } },
      });

      const req = {
        params: { projectId: 'proj-1', globalFieldUid: 'gf-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getSingleGlobalField(req);

      expect(result.title).toBe('SEO');
      expect(result.uid).toBe('gf-1');
    });

    it('should return error when https fails', async () => {
      const project = { id: 'proj-1', destination_stack_id: 'stack-1' };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockHttps.mockRejectedValue({ response: { data: 'Error', status: 500 } });

      const req = {
        params: { projectId: 'proj-1', globalFieldUid: 'gf-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getSingleGlobalField(req);

      expect(result.status).toBe(500);
    });
  });

  describe('updateContentMapper', () => {
    it('should update content mapper successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = { id: 'proj-1', mapperKeys: undefined };
      ProjectModelLowdb.data.projects = [project];

      const req = {
        params: { orgId: 'org-1', projectId: 'proj-1' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-1' },
          content_mapper: { key: 'value' },
        },
      } as any;

      const result = await contentMapperService.updateContentMapper(req);

      expect(result.status).toBe(200);
      expect(result.data.message).toContain('content mapping updated');
    });
  });

  describe('getExistingTaxonomies', () => {
    it('should return source and destination taxonomies when project has taxonomies', async () => {
      const project = {
        id: 'proj-1',
        destination_stack_id: 'stack-1',
        taxonomies: [{ uid: 'tax-1', name: 'Category', description: '' }],
      };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockFetchAllPaginatedData.mockResolvedValue([
        { uid: 'cs-tax-1', name: 'Category', description: '' },
      ]);

      const req = {
        params: { projectId: 'proj-1' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingTaxonomies(req);

      expect(result.status).toBe(200);
      expect(result.sourceTaxonomies).toHaveLength(1);
      expect(result.sourceTaxonomies[0].uid).toBe('tax-1');
      expect(result.destinationTaxonomies).toHaveLength(1);
      expect(result.destinationTaxonomies[0].uid).toBe('cs-tax-1');
    });

    it('should return 404 when project not found', async () => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: null })
      );

      const req = {
        params: { projectId: 'proj-999' },
        body: { token_payload: { region: 'NA', user_id: 'user-1' } },
      } as any;

      const result = await contentMapperService.getExistingTaxonomies(req);

      expect(result.status).toBe(404);
      expect(result.data).toBe('Project not found');
    });
  });

  describe('retryAssetDownload', () => {
    it('returns 400 when assetUid is missing', async () => {
      const req = { params: { projectId: 'proj-1' } } as any;

      const result = await contentMapperService.retryAssetDownload(req);

      expect(result.status).toBe(400);
      expect(result.data.message).toMatch(/assetUid/i);
    });

    it('returns 400 when the project has no destination stack or source file path', async () => {
      const project = { id: 'proj-1', legacy_cms: { cms: 'contentful' } };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );

      const req = { params: { projectId: 'proj-1', assetUid: 'src-1' } } as any;
      const result = await contentMapperService.retryAssetDownload(req);

      expect(result.status).toBe(400);
      expect(result.data.message).toMatch(/destination stack|source file/i);
    });

    it('returns 400 for a non-Contentful project', async () => {
      const project = {
        id: 'proj-1',
        destination_stack_id: 'stack-1',
        legacy_cms: { cms: 'wordpress', file_path: '/tmp/export.xml' },
      };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );

      const req = { params: { projectId: 'proj-1', assetUid: 'src-1' } } as any;
      const result = await contentMapperService.retryAssetDownload(req);

      expect(result.status).toBe(400);
      expect(result.data.message).toMatch(/Contentful/i);
    });

    it('returns 200 with success:true when the retry succeeds', async () => {
      const project = {
        id: 'proj-1',
        destination_stack_id: 'stack-1',
        legacy_cms: { cms: 'contentful', file_path: '/tmp/export.json' },
      };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockRetryFailedAsset.mockResolvedValue({
        success: true,
        message: 'Asset downloaded successfully. It will be included in the next migration run.',
      });

      const req = { params: { projectId: 'proj-1', assetUid: 'src-1' } } as any;
      const result = await contentMapperService.retryAssetDownload(req);

      expect(mockRetryFailedAsset).toHaveBeenCalledWith('/tmp/export.json', 'stack-1', 'proj-1', 'src-1');
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
    });

    it('returns 400 with the failure reason when the retry fails again', async () => {
      const project = {
        id: 'proj-1',
        destination_stack_id: 'stack-1',
        legacy_cms: { cms: 'contentful', file_path: '/tmp/export.json' },
      };
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
      mockRetryFailedAsset.mockResolvedValue({ success: false, message: 'DNS lookup failed.' });

      const req = { params: { projectId: 'proj-1', assetUid: 'src-1' } } as any;
      const result = await contentMapperService.retryAssetDownload(req);

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.message).toBe('DNS lookup failed.');
    });
  });

  describe('getAssetMapping', () => {
    const project = { id: 'proj-1', destination_stack_id: 'stack1', iteration: 1 };
    const baseReq = (overrides: Record<string, unknown> = {}) =>
      ({
        params: { projectId: 'proj-1', skip: '0', limit: '10', searchText: '', ...overrides },
        query: {},
      }) as any;

    beforeEach(() => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: project })
      );
    });

    it('returns assets with an ok status when nothing failed', async () => {
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-1', contentstackAssetUid: 'cs-1', filename: 'a.jpg', title: 'A' },
          ],
        })
      );

      const result = await contentMapperService.getAssetMapping(baseReq());

      expect(result.status).toBe(200);
      expect(result.count).toBe(1);
      expect(result.assetMapping[0].status).toBe('ok');
      expect(result.missingCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('marks assets with no source file as missing', async () => {
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-2', hasSource: false, filename: 'b.jpg', title: 'B' },
          ],
        })
      );

      const result = await contentMapperService.getAssetMapping(baseReq());

      expect(result.assetMapping[0].status).toBe('missing');
      expect(result.missingCount).toBe(1);
    });

    it('marks assets recorded in cs_failed.json as failed', async () => {
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-3', filename: 'c.jpg', title: 'C' },
          ],
        })
      );
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(
        JSON.stringify({ 'src-3': { reason_for_error: 'Timeout downloading asset.' } })
      );

      const result = await contentMapperService.getAssetMapping(baseReq());

      expect(result.assetMapping[0].status).toBe('failed');
      expect(result.assetMapping[0].errorMessage).toBe('Timeout downloading asset.');
      expect(result.failedCount).toBe(1);
    });

    it('filters by the requested status', async () => {
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-1', contentstackAssetUid: 'cs-1', filename: 'a.jpg', title: 'A' },
            { projectId: 'proj-1', otherCmsAssetUid: 'src-2', hasSource: false, filename: 'b.jpg', title: 'B' },
          ],
        })
      );

      const result = await contentMapperService.getAssetMapping(baseReq({}));
      const filteredResult = await contentMapperService.getAssetMapping({
        params: { projectId: 'proj-1', skip: '0', limit: '10', searchText: '' },
        query: { status: 'missing' },
      } as any);

      expect(result.count).toBe(2);
      expect(filteredResult.count).toBe(1);
      expect(filteredResult.assetMapping[0].status).toBe('missing');
    });

    it('filters by search text against filename and title', async () => {
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-1', contentstackAssetUid: 'cs-1', filename: 'windmill.jpg', title: 'Windmill' },
            { projectId: 'proj-1', otherCmsAssetUid: 'src-2', contentstackAssetUid: 'cs-2', filename: 'sunset.jpg', title: 'Sunset' },
          ],
        })
      );

      const result = await contentMapperService.getAssetMapping(baseReq({ searchText: 'wind' }));

      expect(result.count).toBe(1);
      expect(result.assetMapping[0].filename).toBe('windmill.jpg');
    });

    it('shows brand-new assets alongside previously-migrated ones on iteration 2+', async () => {
      (ProjectModelLowdb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({ find: { ...project, iteration: 2 } })
      );
      mockUidMapperDb.data = { entry: {}, assets: { 'src-1': 'cs-1' } };
      (mockAssetMapperDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue(
        createChain({
          filter: [
            { projectId: 'proj-1', otherCmsAssetUid: 'src-1', contentstackAssetUid: 'cs-1', filename: 'a.jpg', title: 'A' },
            { projectId: 'proj-1', otherCmsAssetUid: 'src-2', filename: 'b.jpg', title: 'B' },
          ],
        })
      );

      const result = await contentMapperService.getAssetMapping(baseReq());

      expect(result.count).toBe(2);
      expect(result.assetMapping.map((item: any) => item.otherCmsAssetUid).sort()).toEqual(['src-1', 'src-2']);
    });
  });
});
