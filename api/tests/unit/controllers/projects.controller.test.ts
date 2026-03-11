import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProjectService } = vi.hoisted(() => ({
  mockProjectService: {
    getAllProjects: vi.fn(),
    getProject: vi.fn(),
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
}));

vi.mock('../../../src/services/projects.service.js', () => ({
  projectService: mockProjectService,
}));

import { projectController } from '../../../src/controllers/projects.controller.js';

describe('projects.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { orgId: 'org-123', projectId: 'proj-123' },
      body: { token_payload: { region: 'NA', user_id: 'user-123' } },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
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
});
