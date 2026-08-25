import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProjectService, mockArchive, mockZipArchiveCtor, mockFs, mockReadStream } = vi.hoisted(() => {
  const mockArchive = {
    on: vi.fn(),
    pipe: vi.fn(),
    append: vi.fn(),
    directory: vi.fn(),
    finalize: vi.fn().mockResolvedValue(undefined),
  };
  const mockReadStream = {
    on: vi.fn().mockReturnThis(),
    pipe: vi.fn(),
  };
  return {
    mockProjectService: {
      getAllProjects: vi.fn(),
      getProject: vi.fn(),
      exportProject: vi.fn(),
      getReconciliationReportPath: vi.fn(),
      importProject: vi.fn(),
      createProject: vi.fn(),
      updateProject: vi.fn(),
      updateLegacyCMS: vi.fn(),
      updateAffix: vi.fn(),
      affixConfirmation: vi.fn(),
      updateFileFormat: vi.fn(),
      fileformatConfirmation: vi.fn(),
      updateDestinationStack: vi.fn(),
      updateCurrentStep: vi.fn(),
      deleteProject: vi.fn(),
      revertProject: vi.fn(),
      updateStackDetails: vi.fn(),
      updateMigrationExecution: vi.fn(),
      getMigratedStacks: vi.fn(),
    },
    mockArchive,
    mockReadStream,
    mockZipArchiveCtor: vi.fn(function () {
      return mockArchive;
    }),
    mockFs: {
      existsSync: vi.fn().mockReturnValue(false),
      createReadStream: vi.fn(() => mockReadStream),
    },
  };
});

vi.mock('../../../src/services/projects.service.js', () => ({
  projectService: mockProjectService,
}));

vi.mock('archiver', () => ({ ZipArchive: mockZipArchiveCtor }));
vi.mock('node:fs', () => ({ __esModule: true, default: mockFs, ...mockFs }));

import { projectController } from '../../../src/controllers/projects.controller.js';

describe('projects.controller', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { orgId: 'org-123', projectId: 'proj-123' },
      body: { token_payload: { region: 'NA', user_id: 'user-123' } },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      headersSent: false,
    };
    next = vi.fn();
  });

  it('getAllProjects should return 200 with projects array', async () => {
    const projects = [{ id: '1' }, { id: '2' }];
    mockProjectService.getAllProjects.mockResolvedValue(projects);

    await projectController.getAllProjects(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(projects);
  });

  it('getProject should return 200 with single project', async () => {
    const project = { id: 'proj-123', name: 'Test' };
    mockProjectService.getProject.mockResolvedValue(project);

    await projectController.getProject(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(project);
  });

  it('createProject should return 201 with created project', async () => {
    const project = { id: 'new-proj', name: 'New Project' };
    mockProjectService.createProject.mockResolvedValue(project);

    await projectController.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(project);
  });

  it('updateProject should return 200 with updated project', async () => {
    const project = { id: 'proj-123', name: 'Updated' };
    mockProjectService.updateProject.mockResolvedValue(project);

    await projectController.updateProject(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(project);
  });

  const testServiceDelegation = (
    controllerMethod: keyof typeof projectController,
    serviceMethod: keyof typeof mockProjectService
  ) => {
    it(`${controllerMethod} should delegate to service and return response`, async () => {
      mockProjectService[serviceMethod].mockResolvedValue({ status: 200, data: { ok: true } });

      await projectController[controllerMethod](req, res);

      expect(mockProjectService[serviceMethod]).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  };

  testServiceDelegation('updateLegacyCMS', 'updateLegacyCMS');
  testServiceDelegation('updateAffix', 'updateAffix');
  testServiceDelegation('affixConfirmation', 'affixConfirmation');
  testServiceDelegation('updateFileFormat', 'updateFileFormat');
  testServiceDelegation('fileformatConfirmation', 'fileformatConfirmation');
  testServiceDelegation('updateDestinationStack', 'updateDestinationStack');
  testServiceDelegation('deleteProject', 'deleteProject');
  testServiceDelegation('revertProject', 'revertProject');
  testServiceDelegation('updateStackDetails', 'updateStackDetails');
  testServiceDelegation('updateMigrationExecution', 'updateMigrationExecution');
  testServiceDelegation('getMigratedStacks', 'getMigratedStacks');

  it('updateCurrentStep should return 200', async () => {
    const project = { id: 'proj-123', current_step: 2 };
    mockProjectService.updateCurrentStep.mockResolvedValue(project);

    await projectController.updateCurrentStep(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(project);
  });

  describe('exportProject', () => {
    it('should stream a zip with attachment headers', async () => {
      mockProjectService.exportProject.mockResolvedValue({
        project: { id: 'proj-123' },
        databasePath: '/db/proj-123',
      });

      await projectController.exportProject(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="proj-123.zip"'
      );
      expect(mockArchive.pipe).toHaveBeenCalledWith(res);
      expect(mockArchive.append).toHaveBeenCalledWith(
        expect.any(String),
        { name: 'proj-123/project.json' }
      );
      expect(mockArchive.finalize).toHaveBeenCalled();
    });

    it('should include the database folder when it exists', async () => {
      mockProjectService.exportProject.mockResolvedValue({
        project: { id: 'proj-123' },
        databasePath: '/db/proj-123',
      });
      mockFs.existsSync.mockReturnValue(true);

      await projectController.exportProject(req, res);

      expect(mockArchive.directory).toHaveBeenCalledWith('/db/proj-123', 'proj-123');
    });

    it('should not include the database folder when it does not exist', async () => {
      mockProjectService.exportProject.mockResolvedValue({
        project: { id: 'proj-123' },
        databasePath: '/db/proj-123',
      });
      mockFs.existsSync.mockReturnValue(false);

      await projectController.exportProject(req, res);

      expect(mockArchive.directory).not.toHaveBeenCalled();
    });
  });

  describe('downloadReconciliationReport', () => {
    it('should stream the report with xlsx content-type and attachment headers', async () => {
      mockProjectService.getReconciliationReportPath.mockResolvedValue({
        project: { id: 'proj-123' },
        reportPath: '/Reconcile files/stack1.reconcile.xlsx',
      });

      await projectController.downloadReconciliationReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="stack1.reconcile.xlsx"'
      );
      expect(mockFs.createReadStream).toHaveBeenCalledWith('/Reconcile files/stack1.reconcile.xlsx');
      expect(mockReadStream.pipe).toHaveBeenCalledWith(res);
    });

    it('routes a stream error through next() instead of destroying the connection, when no bytes have been sent yet', async () => {
      // Regression: this used to call res.destroy(err) unconditionally, which just resets
      // the connection — the client (and the UI's download handler) saw a raw network
      // failure instead of the app's normal structured JSON error response.
      mockProjectService.getReconciliationReportPath.mockResolvedValue({
        project: { id: 'proj-123' },
        reportPath: '/Reconcile files/stack1.reconcile.xlsx',
      });
      let errorHandler: ((err: Error) => void) | undefined;
      mockReadStream.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') errorHandler = handler;
        return mockReadStream;
      });

      await projectController.downloadReconciliationReport(req, res, next);
      const boom = new Error('disk read failed');
      errorHandler?.(boom);

      expect(next).toHaveBeenCalledWith(boom);
      expect(res.destroy).not.toHaveBeenCalled();
    });

    it('still destroys the response (cannot resend headers) if the stream errors after bytes were already flushed', async () => {
      mockProjectService.getReconciliationReportPath.mockResolvedValue({
        project: { id: 'proj-123' },
        reportPath: '/Reconcile files/stack1.reconcile.xlsx',
      });
      let errorHandler: ((err: Error) => void) | undefined;
      mockReadStream.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') errorHandler = handler;
        return mockReadStream;
      });
      res.headersSent = true;

      await projectController.downloadReconciliationReport(req, res, next);
      const boom = new Error('disk read failed mid-stream');
      errorHandler?.(boom);

      expect(res.destroy).toHaveBeenCalledWith(boom);
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('importProject should return 201 with the imported project', async () => {
    const result = { status: 'success', project: { id: 'new-proj' } };
    mockProjectService.importProject.mockResolvedValue(result);

    await projectController.importProject(req, res);

    expect(mockProjectService.importProject).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(result);
  });
});
