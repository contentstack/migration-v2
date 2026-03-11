import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCall, mockPostCall } = vi.hoisted(() => ({
  mockGetCall: vi.fn(),
  mockPostCall: vi.fn()
}));

vi.mock('../../../src/services/api/service', () => ({
  getCall: mockGetCall,
  postCall: mockPostCall
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
  getAllStacksInOrg,
  createStacksInOrg,
  getStackStatus,
  getStackLocales
} from '../../../src/services/api/stacks.service';

describe('services/api/stacks.service', () => {
  const orgId = 'org-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllStacksInOrg', () => {
    it('should call getCall with org and search text', async () => {
      const mockResponse = { status: 200, data: { stacks: [] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getAllStacksInOrg(orgId, 'test');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/org/org-123/stacks/test?',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error on failure', async () => {
      const error = new Error('Network error');
      mockGetCall.mockRejectedValue(error);

      const result = await getAllStacksInOrg(orgId, '');
      expect(result).toEqual(error);
    });
  });

  describe('createStacksInOrg', () => {
    it('should call postCall with stack data', async () => {
      const stackData = { name: 'New Stack', master_locale: 'en-us' };
      const mockResponse = { status: 201, data: { stack: stackData } };
      mockPostCall.mockResolvedValue(mockResponse);

      const result = await createStacksInOrg(orgId, stackData as any);
      expect(mockPostCall).toHaveBeenCalledWith(
        'v2/org/org-123/stacks',
        stackData,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getStackStatus', () => {
    it('should call postCall with stack_api_key', async () => {
      const mockResponse = { status: 200, data: { status: 'active' } };
      mockPostCall.mockResolvedValue(mockResponse);

      const result = await getStackStatus(orgId, 'stack-api-key-123');
      expect(mockPostCall).toHaveBeenCalledWith(
        'v2/org/org-123/stack_status',
        { stack_api_key: 'stack-api-key-123' },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getStackLocales', () => {
    it('should call getCall with locales endpoint', async () => {
      const mockResponse = { status: 200, data: { locales: ['en-us'] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getStackLocales(orgId);
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/org/org-123/locales',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw with message on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('Locale fetch failed'); });
      await expect(getStackLocales(orgId)).rejects.toThrow('Locale fetch failed');
    });

    it('should throw generic message on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw null; });
      await expect(getStackLocales(orgId)).rejects.toThrow('Unknown error');
    });
  });

  describe('createStacksInOrg - error handling', () => {
    it('should throw with message on Error', async () => {
      mockPostCall.mockImplementation(() => { throw new Error('Create failed'); });
      await expect(createStacksInOrg(orgId, { name: 'x' } as any))
        .rejects.toThrow('Error in userSession: Create failed');
    });

    it('should throw generic message on non-Error', async () => {
      mockPostCall.mockImplementation(() => { throw 0; });
      await expect(createStacksInOrg(orgId, { name: 'x' } as any))
        .rejects.toThrow('Unknown error in userSession');
    });
  });

  describe('getStackStatus - error handling', () => {
    it('should throw with message on Error', async () => {
      mockPostCall.mockImplementation(() => { throw new Error('Status failed'); });
      await expect(getStackStatus(orgId, 'key'))
        .rejects.toThrow('Error in userSession: Status failed');
    });

    it('should throw generic message on non-Error', async () => {
      mockPostCall.mockImplementation(() => { throw 0; });
      await expect(getStackStatus(orgId, 'key'))
        .rejects.toThrow('Unknown error in userSession');
    });
  });
});
