import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockProject } from '../../fixtures/project.fixture.js';

const {
  mockProjectRead,
  mockProjectUpdate,
  mockProjectWrite,
  mockFindValue,
  mockFilterValue,
  mockGetProjectUtil,
  mockHttps,
  mockGetAuthToken,
  mockFindIndexValue,
  mockContentTypesDb,
  mockFieldDb,
  getContentTypesMapperDbMock,
  getFieldMapperDbMock,
  mockFs,
  mockAdmZipInstance,
  mockAdmZipCtor,
} = vi.hoisted(() => {
  const mockCtChainGet = vi.fn().mockReturnValue({
    filter: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue([]) }),
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(null) }),
    findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
  });
  const mockFieldChainGet = vi.fn().mockReturnValue({
    filter: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue([]) }),
    find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(null) }),
    findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(-1) }),
  });
  const mockContentTypesDb = {
    read: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    write: vi.fn(),
    chain: { get: mockCtChainGet },
    data: { ContentTypesMappers: [] as unknown[] },
  };
  const mockFieldDb = {
    read: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    write: vi.fn(),
    chain: { get: mockFieldChainGet },
    data: { field_mapper: [] as unknown[] },
  };
  const mockFs = {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
  // A single shared AdmZip instance returned by the constructor so tests can
  // configure its entries / readers per case.
  const mockAdmZipInstance = {
    getEntries: vi.fn().mockReturnValue([]),
    readAsText: vi.fn().mockReturnValue('{}'),
  };
  const mockAdmZipCtor = vi.fn(function () {
    return mockAdmZipInstance;
  });
  return {
    mockProjectRead: vi.fn(),
    mockProjectUpdate: vi.fn(),
    mockProjectWrite: vi.fn(),
    mockFindValue: vi.fn(),
    mockFilterValue: vi.fn(),
    mockGetProjectUtil: vi.fn(),
    mockHttps: vi.fn(),
    mockGetAuthToken: vi.fn(),
    mockFindIndexValue: vi.fn(),
    mockContentTypesDb,
    mockFieldDb,
    getContentTypesMapperDbMock: vi.fn(() => mockContentTypesDb),
    getFieldMapperDbMock: vi.fn(() => mockFieldDb),
    mockFs,
    mockAdmZipInstance,
    mockAdmZipCtor,
  };
});

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    update: mockProjectUpdate,
    write: mockProjectWrite,
    chain: {
      get: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({ value: mockFilterValue }),
        find: vi.fn().mockReturnValue({ value: mockFindValue }),
        findIndex: vi.fn().mockReturnValue({ value: mockFindIndexValue }),
      }),
    },
    data: { projects: [] },
  },
}));

vi.mock('node:fs', () => ({ default: mockFs, ...mockFs }));
vi.mock('adm-zip', () => ({ __esModule: true, default: mockAdmZipCtor }));

vi.mock('../../../src/utils/get-project.utils.js', () => ({ default: mockGetProjectUtil }));
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
  },
}));
vi.mock('../../../src/models/contentTypesMapper-lowdb.js', () => ({
  default: getContentTypesMapperDbMock,
  getContentTypesMapperDb: getContentTypesMapperDbMock,
}));
vi.mock('../../../src/models/FieldMapper.js', () => ({
  default: getFieldMapperDbMock,
}));
vi.mock('../../../src/services/contentMapper.service.js', () => ({
  contentMapperService: {
    removeMapping: vi.fn().mockResolvedValue(undefined),
    resetAllContentTypesMapping: vi.fn().mockResolvedValue(undefined),
  },
}));

import { projectService } from '../../../src/services/projects.service.js';

const makeReq = (params: any = {}, body: any = {}) =>
  ({ params, body } as any);

const tokenPayload = { region: 'NA', user_id: 'user-123', is_sso: false };

describe('projects.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockGetAuthToken.mockResolvedValue('cs-auth-token');
  });

  describe('getAllProjects', () => {
    it('should return filtered projects', async () => {
      const projects = [createMockProject(), createMockProject({ id: 'proj-2' })];
      mockFilterValue.mockReturnValue(projects);
      const result = await projectService.getAllProjects(
        makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload })
      );
      expect(result).toEqual(projects);
    });

    it('should throw NotFoundError when projects is null', async () => {
      mockFilterValue.mockReturnValue(null);
      await expect(
        projectService.getAllProjects(makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload }))
      ).rejects.toThrow();
    });

    it('should return empty array when no projects match', async () => {
      mockFilterValue.mockReturnValue([]);
      const result = await projectService.getAllProjects(
        makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload })
      );
      expect(result).toEqual([]);
    });

    it('should throw BadRequestError when orgId is missing', async () => {
      await expect(
        projectService.getAllProjects(makeReq({}, { token_payload: tokenPayload }))
      ).rejects.toThrow('Organization ID is required');
    });

    it('should throw BadRequestError when token_payload is missing', async () => {
      await expect(
        projectService.getAllProjects(makeReq({ orgId: 'org-123' }, {}))
      ).rejects.toThrow('Token payload is required');
    });
  });

  describe('getProject', () => {
    it('should return project by ID', async () => {
      const project = createMockProject();
      mockGetProjectUtil.mockResolvedValue(project);
      const result = await projectService.getProject(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toEqual(project);
    });

    it('should throw BadRequestError when params missing', async () => {
      await expect(
        projectService.getProject(makeReq({}, { token_payload: tokenPayload }))
      ).rejects.toThrow('Organization ID and Project ID are required');
    });
  });

  describe('exportProject', () => {
    it('should return the project and its database path', async () => {
      const project = createMockProject();
      mockGetProjectUtil.mockResolvedValue(project);

      const result = await projectService.exportProject(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );

      expect(result.project).toEqual(project);
      expect(result.databasePath).toContain(project.id);
      // Scopes the lookup to the current user / org, like getProject.
      expect(mockGetProjectUtil).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({ id: project.id, org_id: 'org-123', owner: 'user-123' }),
        'exportProject'
      );
    });

    it('should throw BadRequestError when orgId or projectId missing', async () => {
      await expect(
        projectService.exportProject(makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload }))
      ).rejects.toThrow('Organization ID and Project ID are required');
    });

    it('should throw BadRequestError when token_payload is missing', async () => {
      await expect(
        projectService.exportProject(makeReq({ orgId: 'org-123', projectId: 'p1' }, {}))
      ).rejects.toThrow('Token payload is required');
    });
  });

  describe('importProject', () => {
    const oldId = 'old-project-id';
    const makeImportReq = (fileOverride?: any) =>
      ({
        params: { orgId: 'org-999' },
        body: { token_payload: tokenPayload },
        file: fileOverride === undefined ? { buffer: Buffer.from('zip') } : fileOverride,
      } as any);

    const setupZip = (importedProject: any, extraEntries: any[] = []) => {
      const projectEntry = { entryName: `${oldId}/project.json`, isDirectory: false };
      mockAdmZipInstance.getEntries.mockReturnValue([projectEntry, ...extraEntries]);
      mockAdmZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry === projectEntry) return JSON.stringify(importedProject);
        return entry?.__content ?? '{}';
      });
    };

    beforeEach(() => {
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [] };
        fn(data);
        return data;
      });
    });

    it('should create a new project re-owned under the current user/org', async () => {
      const imported = { id: oldId, org_id: 'OLD_ORG', owner: 'OLD_USER', name: 'Imported', current_step: 3 };
      setupZip(imported);

      const result = await projectService.importProject(makeImportReq());

      expect(result.status).toBe('success');
      expect(result.project.name).toBe('Imported');
      expect(result.project.current_step).toBe(3);
      // Fresh id, not the original.
      expect(result.project.id).not.toBe(oldId);
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should extract mapper files and rewrite the old project id', async () => {
      const imported = { id: oldId, name: 'Imported' };
      const mapperEntry = {
        entryName: `${oldId}/1/contentTypesMapper.json`,
        isDirectory: false,
        __content: `{"projectId":"${oldId}"}`,
      };
      setupZip(imported, [mapperEntry]);

      await projectService.importProject(makeImportReq());

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      // The written content must have the old id rewritten to the new one.
      const written = mockFs.writeFileSync.mock.calls[0][1] as string;
      expect(written).not.toContain(oldId);
    });

    it('should skip directory entries and the top-level project.json when copying mappers', async () => {
      const imported = { id: oldId, name: 'Imported' };
      const dirEntry = { entryName: `${oldId}/1/`, isDirectory: true, __content: '' };
      setupZip(imported, [dirEntry]);

      await projectService.importProject(makeImportReq());

      // Only the project.json + a directory entry -> nothing copied to disk.
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should reject Zip Slip path traversal and not write outside the project dir', async () => {
      const imported = { id: oldId, name: 'Imported' };
      const evilEntry = {
        entryName: `${oldId}/../../../../tmp/evil.json`,
        isDirectory: false,
        __content: '{"pwned":true}',
      };
      setupZip(imported, [evilEntry]);

      await expect(
        projectService.importProject(makeImportReq())
      ).rejects.toThrow('path traversal detected');
      // Nothing should have been written to disk for the malicious entry.
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      // Partial project dir is cleaned up and no orphan record is persisted.
      expect(mockFs.rmSync).toHaveBeenCalled();
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when orgId is missing', async () => {
      await expect(
        projectService.importProject({ params: {}, body: { token_payload: tokenPayload }, file: { buffer: Buffer.from('z') } } as any)
      ).rejects.toThrow('Organization ID is required');
    });

    it('should throw BadRequestError when token_payload is missing', async () => {
      await expect(
        projectService.importProject({ params: { orgId: 'org-999' }, body: {}, file: { buffer: Buffer.from('z') } } as any)
      ).rejects.toThrow('Token payload is required');
    });

    it('should throw BadRequestError when no file is uploaded', async () => {
      await expect(
        projectService.importProject(makeImportReq(null))
      ).rejects.toThrow('A project zip file is required');
    });

    it('should throw BadRequestError when project.json is not in the archive', async () => {
      mockAdmZipInstance.getEntries.mockReturnValue([
        { entryName: `${oldId}/1/field-mapper.json`, isDirectory: false },
      ]);
      await expect(
        projectService.importProject(makeImportReq())
      ).rejects.toThrow('project.json not found');
    });

    it('should throw BadRequestError when project.json is invalid JSON', async () => {
      const projectEntry = { entryName: `${oldId}/project.json`, isDirectory: false };
      mockAdmZipInstance.getEntries.mockReturnValue([projectEntry]);
      mockAdmZipInstance.readAsText.mockReturnValue('not-json{');
      await expect(
        projectService.importProject(makeImportReq())
      ).rejects.toThrow('not valid JSON');
    });

    it('should reject a zip bomb whose uncompressed size exceeds the limit', async () => {
      const projectEntry = {
        entryName: `${oldId}/project.json`,
        isDirectory: false,
        header: { size: 600 * 1024 * 1024 }, // 600 MB uncompressed, over the 500 MB cap
      };
      mockAdmZipInstance.getEntries.mockReturnValue([projectEntry]);
      await expect(
        projectService.importProject(makeImportReq())
      ).rejects.toThrow('uncompressed size exceeds the allowed limit');
      // Guard trips before anything is written or persisted.
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createProject', () => {
    it('should create project and return success', async () => {
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [] };
        fn(data);
        return data;
      });
      const result = await projectService.createProject(
        makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload, name: 'New', description: 'Desc' })
      );
      expect(result.status).toBe('success');
      expect(result.project.name).toBe('New');
    });

    it('should create project when name is omitted (name optional in service)', async () => {
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [] };
        fn(data);
        return data;
      });
      const result = await projectService.createProject(
        makeReq({ orgId: 'org-123' }, { token_payload: tokenPayload })
      );
      expect(result.status).toBe('success');
      expect(result.project.name).toBeUndefined();
    });
  });

  describe('updateProject', () => {
    it('should update project and return success', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => {
        const data = { projects: [project] };
        fn(data);
      });
      const result = await projectService.updateProject(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, name: 'Updated', description: 'Updated desc' }
        )
      );
      expect(result.status).toBe('success');
    });
  });

  describe('updateLegacyCMS', () => {
    it('should update legacy CMS successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, legacy_cms: {} });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateLegacyCMS(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, legacy_cms: 'wordpress' }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw BadRequestError when project status is migration completed', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 5 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };

      await expect(
        projectService.updateLegacyCMS(
          makeReq(
            { orgId: 'org-123', projectId: project.id },
            { token_payload: tokenPayload, legacy_cms: 'wordpress' }
          )
        )
      ).rejects.toThrow();
    });

    it('should throw BadRequestError when legacy_cms is missing', async () => {
      await expect(
        projectService.updateLegacyCMS(
          makeReq({ orgId: 'org-123', projectId: 'p1' }, { token_payload: tokenPayload })
        )
      ).rejects.toThrow('Legacy CMS data is required');
    });
  });

  describe('updateAffix', () => {
    it('should update affix successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateAffix(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, affix: 'pre' }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw BadRequestError when affix is empty', async () => {
      await expect(
        projectService.updateAffix(
          makeReq({ orgId: 'org-123', projectId: 'p1' }, { token_payload: tokenPayload, affix: '' })
        )
      ).rejects.toThrow('Affix is required');
    });
  });

  describe('affixConfirmation', () => {
    it('should update affix confirmation', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.affixConfirmation(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, affix_confirmation: true }
        )
      );
      expect(result.status).toBe(200);
    });
  });

  describe('updateFileFormat', () => {
    it('should update file format successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, legacy_cms: {} });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateFileFormat(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, file_format: 'json', file_path: '/path', is_localPath: true, is_fileValid: true }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should update file format with awsDetails', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, legacy_cms: {} });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateFileFormat(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          {
            token_payload: tokenPayload,
            file_format: 'json',
            file_path: '/path',
            is_localPath: false,
            is_fileValid: true,
            awsDetails: { awsRegion: 'us-east-1', bucketName: 'bucket', bucketKey: 'key' },
          }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw when project status is migration completed', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 5 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };

      await expect(
        projectService.updateFileFormat(
          makeReq(
            { orgId: 'org-123', projectId: project.id },
            { token_payload: tokenPayload, file_format: 'json' }
          )
        )
      ).rejects.toThrow();
    });
  });

  describe('fileformatConfirmation', () => {
    it('should update fileformat confirmation', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.fileformatConfirmation(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, fileformat_confirmation: true }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should skip update when fileformat_confirmation is undefined', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const result = await projectService.fileformatConfirmation(
        makeReq(
          { orgId: 'org-123', projectId: 'p1' },
          { token_payload: tokenPayload }
        )
      );
      expect(result.status).toBe(200);
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateDestinationStack', () => {
    it('should update destination stack when stack is found', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, current_step: 2 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockHttps.mockResolvedValue({
        data: { stacks: [{ api_key: 'stack-key' }] },
        status: 200,
      });
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateDestinationStack(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, stack_api_key: 'stack-key' }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw when stack not found in org stacks', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, current_step: 2 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockHttps.mockResolvedValue({
        data: { stacks: [{ api_key: 'other-stack' }] },
        status: 200,
      });

      await expect(
        projectService.updateDestinationStack(
          makeReq(
            { orgId: 'org-123', projectId: project.id },
            { token_payload: tokenPayload, stack_api_key: 'stack-key' }
          )
        )
      ).rejects.toThrow();
    });

    it('should throw when project status blocks update', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 5, current_step: 2 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };

      await expect(
        projectService.updateDestinationStack(
          makeReq(
            { orgId: 'org-123', projectId: project.id },
            { token_payload: tokenPayload, stack_api_key: 'stack-key' }
          )
        )
      ).rejects.toThrow();
    });

    it('should return error when CS API fails', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, current_step: 2 });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockHttps.mockRejectedValue({ response: { data: 'error', status: 500 } });

      const result = await projectService.updateDestinationStack(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, stack_api_key: 'stack-key' }
        )
      );
      expect(result.status).toBe(500);
    });
  });

  describe('updateCurrentStep', () => {
    it('should advance from LEGACY_CMS to DESTINATION_STACK', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 0,
        current_step: 1,
        legacy_cms: { cms: 'wordpress', file_format: 'json' },
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
    });

    it('should advance from DESTINATION_STACK to AUDIT_REPORT', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 0,
        current_step: 2,
        legacy_cms: { cms: 'wordpress', file_format: 'json' },
        destination_stack_id: 'stack-1',
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
    });

    it('should advance from AUDIT_REPORT to CONTENT_MAPPING', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 3,
        current_step: 3,
        legacy_cms: {
          cms: 'wordpress',
          file_format: 'json',
          audit: { summary: { unused_assets: 0 } },
        },
        destination_stack_id: 'stack-1',
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
      expect(result.current_step).toBe(4);
      expect(result.status).toBe(3);
    });

    it('should advance from CONTENT_MAPPING to TESTING', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 3,
        current_step: 4,
        legacy_cms: { cms: 'wordpress', file_format: 'json' },
        destination_stack_id: 'stack-1',
        content_mapper: ['ct-1'],
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
    });

    it('should advance from TESTING to MIGRATION', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 4,
        current_step: 5,
        legacy_cms: { cms: 'wordpress', file_format: 'json' },
        destination_stack_id: 'stack-1',
        content_mapper: ['ct-1'],
        current_test_stack_id: 'test-stack-1',
        migration_execution: true,
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
    });

    it('should complete MIGRATION step', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({
        status: 4,
        current_step: 6,
        legacy_cms: { cms: 'wordpress', file_format: 'json' },
        destination_stack_id: 'stack-1',
        content_mapper: ['ct-1'],
        current_test_stack_id: 'test-stack-1',
        isMigrationCompleted: true,
      });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateCurrentStep(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result).toBeDefined();
    });

    it('should throw when LEGACY_CMS step is incomplete', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject({ status: 0, current_step: 1, legacy_cms: {} });
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };

      await expect(
        projectService.updateCurrentStep(
          makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
        )
      ).rejects.toThrow();
    });
  });

  describe('deleteProject', () => {
    it('should soft delete project when status is not completed', async () => {
      const project = createMockProject({ status: 0 });
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.deleteProject(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result.status).toBe(200);
    });

    it('should hard delete project with content mappers when status is 5', async () => {
      const project = createMockProject({ status: 5, content_mapper: ['ct-1'] });
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };

      (mockContentTypesDb.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        find: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue({ id: 'ct-1', fieldMapping: [] }) }),
        findIndex: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(0) }),
      });
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.deleteProject(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result.status).toBe(200);
    });
  });

  describe('revertProject', () => {
    it('should set isDeleted to false', async () => {
      const project = createMockProject({ isDeleted: true });
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [project] };
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.revertProject(
        makeReq({ orgId: 'org-123', projectId: project.id }, { token_payload: tokenPayload })
      );
      expect(result.status).toBe(200);
    });

    it('should throw NotFoundError when project not found', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [undefined] };

      await expect(
        projectService.revertProject(
          makeReq({ orgId: 'org-123', projectId: 'p1' }, { token_payload: tokenPayload })
        )
      ).rejects.toThrow();
    });
  });

  describe('updateStackDetails', () => {
    it('should update stack details successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateStackDetails(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, stack_details: { uid: 's1', label: 'Stack' } }
        )
      );
      expect(result.status).toBe(200);
    });
  });

  describe('updateContentMapper', () => {
    it('should update content mapper keys', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateContentMapper(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload, content_mapper: { key: 'value' } }
        )
      );
      expect(result.status).toBe(200);
    });
  });

  describe('updateMigrationExecution', () => {
    it('should set migration_execution to true', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const project = createMockProject();
      mockProjectUpdate.mockImplementation(async (fn: any) => fn({ projects: [project] }));

      const result = await projectService.updateMigrationExecution(
        makeReq(
          { orgId: 'org-123', projectId: project.id },
          { token_payload: tokenPayload }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw BadRequestError when params missing', async () => {
      await expect(
        projectService.updateMigrationExecution(makeReq({}, { token_payload: tokenPayload }))
      ).rejects.toThrow('Organization ID and Project ID are required');
    });
  });

  describe('getMigratedStacks', () => {
    it('should return destination stacks of other completed projects (not current project)', async () => {
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = {
        projects: [
          {
            id: 'proj-self',
            status: 5,
            current_step: 6,
            destination_stack_id: 'stack-a',
          },
          {
            id: 'proj-other',
            status: 5,
            current_step: 6,
            destination_stack_id: 'stack-b',
          },
          {
            id: 'proj-deleted',
            status: 5,
            current_step: 6,
            destination_stack_id: 'stack-c',
            isDeleted: true,
          },
          { status: 0, current_step: 1, destination_stack_id: '' },
        ],
      };

      const result = await projectService.getMigratedStacks(
        makeReq({ projectId: 'proj-self' }, { token_payload: tokenPayload })
      );
      expect(result.status).toBe(200);
      expect(result.destinationStacks).toEqual(['stack-b']);
    });

    it('should return empty when only the current project is completed for its stack', async () => {
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = {
        projects: [
          {
            id: 'proj-self',
            status: 5,
            current_step: 6,
            destination_stack_id: 'stack-a',
          },
        ],
      };

      const result = await projectService.getMigratedStacks(
        makeReq({ projectId: 'proj-self' }, { token_payload: tokenPayload })
      );
      expect(result.destinationStacks).toEqual([]);
    });

    it('should return empty array when no completed projects', async () => {
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [] };

      const result = await projectService.getMigratedStacks(
        makeReq({ projectId: 'any' }, { token_payload: tokenPayload })
      );
      expect(result.destinationStacks).toEqual([]);
    });

    it('should throw BadRequestError when token_payload missing', async () => {
      await expect(
        projectService.getMigratedStacks(makeReq({ projectId: 'p1' }, {}))
      ).rejects.toThrow('Token payload is required');
    });
  });

  describe('updateSourceConfig', () => {
    it('should update source details successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [{ id: 'proj-1', legacy_cms: {} }] };
        fn(data);
        return data;
      });

      const result = await projectService.updateSourceConfig(
        makeReq(
          { orgId: 'org-123', projectId: 'proj-1' },
          {
            token_payload: tokenPayload,
            source_details: {
              source_mode: 'credentials',
              source_region_id: 'NA',
              source_org_id: 'org-1',
              source_stack_id: 'stack-1',
              source_branch: 'main',
            },
          }
        )
      );

      expect(result.status).toBe(200);
      expect(result.data.message).toMatch(/updated/i);
      expect(mockProjectUpdate).toHaveBeenCalled();
    });

    it('should accept imported_export as source_mode', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [{ id: 'proj-1', legacy_cms: {} }] };
        fn(data);
        return data;
      });

      const result = await projectService.updateSourceConfig(
        makeReq(
          { orgId: 'org-123', projectId: 'proj-1' },
          {
            token_payload: tokenPayload,
            source_details: {
              source_mode: 'imported_export',
              imported_data_path: '/some/path',
            },
          }
        )
      );
      expect(result.status).toBe(200);
    });

    it('should throw when params missing', async () => {
      await expect(
        projectService.updateSourceConfig(
          makeReq({}, { token_payload: tokenPayload, source_details: {} })
        )
      ).rejects.toThrow('Organization ID and Project ID are required');
    });

    it('should throw when token_payload missing', async () => {
      await expect(
        projectService.updateSourceConfig(
          makeReq({ orgId: 'org-123', projectId: 'proj-1' }, { source_details: {} })
        )
      ).rejects.toThrow('Token payload is required');
    });

    it('should throw when source_details missing', async () => {
      await expect(
        projectService.updateSourceConfig(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            { token_payload: tokenPayload }
          )
        )
      ).rejects.toThrow('source_details is required');
    });

    it('should throw when source_mode is invalid', async () => {
      await expect(
        projectService.updateSourceConfig(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            {
              token_payload: tokenPayload,
              source_details: { source_mode: 'bogus' },
            }
          )
        )
      ).rejects.toThrow(/source_mode/);
    });

    it('should throw NotFoundError when project index invalid during update', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      mockProjectUpdate.mockImplementation((fn: any) => {
        const data = { projects: [] };
        fn(data);
      });

      await expect(
        projectService.updateSourceConfig(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            {
              token_payload: tokenPayload,
              source_details: { source_mode: 'credentials' },
            }
          )
        )
      ).rejects.toThrow();
    });
  });

  describe('updateAuditSelections', () => {
    it('should update audit selections successfully', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = {
        projects: [
          {
            id: 'proj-1',
            legacy_cms: { audit: {} },
          },
        ],
      };
      mockProjectWrite.mockResolvedValue(undefined);

      const result = await projectService.updateAuditSelections(
        makeReq(
          { orgId: 'org-123', projectId: 'proj-1' },
          {
            token_payload: tokenPayload,
            excludedItems: [{ uid: 'x1' }],
            selectionStats: { total: 5 },
          }
        )
      );

      expect(result).toBeDefined();
      expect(result.legacy_cms.audit.excludedItems).toEqual([{ uid: 'x1' }]);
      expect(mockProjectWrite).toHaveBeenCalled();
    });

    it('should throw when params missing', async () => {
      await expect(
        projectService.updateAuditSelections(
          makeReq({}, { token_payload: tokenPayload, excludedItems: [] })
        )
      ).rejects.toThrow('Organization ID and Project ID are required');
    });

    it('should throw when token_payload missing', async () => {
      await expect(
        projectService.updateAuditSelections(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            { excludedItems: [] }
          )
        )
      ).rejects.toThrow('Token payload is required');
    });

    it('should throw when excludedItems is not array', async () => {
      await expect(
        projectService.updateAuditSelections(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            { token_payload: tokenPayload, excludedItems: 'not array' }
          )
        )
      ).rejects.toThrow('excludedItems must be an array');
    });

    it('should throw NotFoundError when project not found', async () => {
      mockGetProjectUtil.mockResolvedValue(0);
      const mockModel = await import('../../../src/models/project-lowdb.js');
      (mockModel.default as any).data = { projects: [] };

      await expect(
        projectService.updateAuditSelections(
          makeReq(
            { orgId: 'org-123', projectId: 'proj-1' },
            {
              token_payload: tokenPayload,
              excludedItems: [],
            }
          )
        )
      ).rejects.toThrow();
    });
  });
});
