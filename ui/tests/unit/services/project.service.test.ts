import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCall, mockPostCall, mockPutCall, mockDeleteCall } = vi.hoisted(() => ({
  mockGetCall: vi.fn(),
  mockPostCall: vi.fn(),
  mockPutCall: vi.fn(),
  mockDeleteCall: vi.fn()
}));

vi.mock('../../../src/services/api/service', () => ({
  getCall: mockGetCall,
  postCall: mockPostCall,
  putCall: mockPutCall,
  deleteCall: mockDeleteCall
}));

vi.mock('../../../src/utilities/constants', () => ({
  API_VERSION: 'v2',
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {}
}));

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => 'mock-app-token')
}));

import {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getMigratedStacks,
  getAuditData
} from '../../../src/services/api/project.service';

describe('services/api/project.service', () => {
  const orgId = 'org-123';
  const projectId = 'proj-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllProjects', () => {
    it('should call getCall with the correct URL and options', async () => {
      const mockResponse = { status: 200, data: { projects: [] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getAllProjects(orgId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProject', () => {
    it('should call getCall with org and project ID', async () => {
      const mockResponse = { status: 200, data: { project: {} } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getProject(orgId, projectId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createProject', () => {
    it('should call postCall with project data', async () => {
      const data = { name: 'New Project' };
      const mockResponse = { status: 201, data: { project: data } };
      mockPostCall.mockResolvedValue(mockResponse);

      const result = await createProject(orgId, data);
      expect(mockPostCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateProject', () => {
    it('should call putCall with updated data', async () => {
      const data = { name: 'Updated Project' };
      const mockResponse = { status: 200, data: {} };
      mockPutCall.mockResolvedValue(mockResponse);

      const result = await updateProject(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteProject', () => {
    it('should call deleteCall with the correct URL', async () => {
      const mockResponse = { status: 204, data: {} };
      mockDeleteCall.mockResolvedValue(mockResponse);

      const result = await deleteProject(orgId, projectId);
      expect(mockDeleteCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getMigratedStacks', () => {
    it('should call getCall for migrated stacks', async () => {
      const mockResponse = { status: 200, data: { stacks: [] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getMigratedStacks(orgId, projectId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/get-migrated-stacks`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAuditData', () => {
    it('should call getCall with all parameters in the URL', async () => {
      const mockResponse = { status: 200, data: { logs: [] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getAuditData(orgId, projectId, 'stack-1', 'content_types', 0, 10, 0, 10, 'search', 'all');
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/migration/get_audit_data/${orgId}/${projectId}/stack-1/content_types/0/10/0/10/search/all`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw with message when getCall throws an Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('fail'); });
      await expect(getAuditData(orgId, projectId, 's', 'm', 0, 10, 0, 10, '', 'all'))
        .rejects.toThrow('Error in fetching audit data: fail');
    });

    it('should throw generic message when getCall throws a non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw null; });
      await expect(getAuditData(orgId, projectId, 's', 'm', 0, 10, 0, 10, '', 'all'))
        .rejects.toThrow('Unknown error in fetching audit data');
    });
  });

  describe('error handling for all project service functions', () => {
    it('getAllProjects should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getAllProjects(orgId)).rejects.toThrow('Error in userSession: err');
    });

    it('getAllProjects should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getAllProjects(orgId)).rejects.toThrow('Unknown error in userSession');
    });

    it('getProject should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getProject(orgId, projectId)).rejects.toThrow('Error in userSession: err');
    });

    it('getProject should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getProject(orgId, projectId)).rejects.toThrow('Unknown error in userSession');
    });

    it('createProject should throw on Error', async () => {
      mockPostCall.mockImplementation(() => { throw new Error('err'); });
      await expect(createProject(orgId, {})).rejects.toThrow('Error in userSession: err');
    });

    it('createProject should throw generic on non-Error', async () => {
      mockPostCall.mockImplementation(() => { throw 0; });
      await expect(createProject(orgId, {})).rejects.toThrow('Unknown error in userSession');
    });

    it('updateProject should throw on Error', async () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      await expect(updateProject(orgId, projectId, {})).rejects.toThrow('Error in userSession: err');
    });

    it('updateProject should throw generic on non-Error', async () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      await expect(updateProject(orgId, projectId, {})).rejects.toThrow('Unknown error in userSession');
    });

    it('deleteProject should throw on Error', async () => {
      mockDeleteCall.mockImplementation(() => { throw new Error('err'); });
      await expect(deleteProject(orgId, projectId)).rejects.toThrow('Error in userSession: err');
    });

    it('deleteProject should throw generic on non-Error', async () => {
      mockDeleteCall.mockImplementation(() => { throw 0; });
      await expect(deleteProject(orgId, projectId)).rejects.toThrow('Unknown error in userSession');
    });

    it('getMigratedStacks should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getMigratedStacks(orgId, projectId)).rejects.toThrow('Error in userSession: err');
    });

    it('getMigratedStacks should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getMigratedStacks(orgId, projectId)).rejects.toThrow('Unknown error in userSession');
    });
  });
});
