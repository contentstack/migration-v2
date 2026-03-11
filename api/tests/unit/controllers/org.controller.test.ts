import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOrgService } = vi.hoisted(() => ({
  mockOrgService: {
    getAllStacks: vi.fn(),
    createStack: vi.fn(),
    getLocales: vi.fn(),
    getStackStatus: vi.fn(),
    getStackLocale: vi.fn(),
    getOrgDetails: vi.fn(),
  },
}));

vi.mock('../../../src/services/org.service.js', () => ({
  orgService: mockOrgService,
}));

import { orgController } from '../../../src/controllers/org.controller.js';

describe('org.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: { orgId: 'org-123' }, body: { token_payload: { region: 'NA', user_id: 'user-123' } } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  const testControllerMethod = (methodName: keyof typeof orgController, serviceName: keyof typeof mockOrgService) => {
    it(`${methodName} should delegate to service and return resp.status/resp.data`, async () => {
      mockOrgService[serviceName].mockResolvedValue({ status: 200, data: { result: 'ok' } });

      await orgController[methodName](req, res);

      expect(mockOrgService[serviceName]).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ result: 'ok' });
    });
  };

  testControllerMethod('getAllStacks', 'getAllStacks');
  testControllerMethod('createStack', 'createStack');
  testControllerMethod('getLocales', 'getLocales');
  testControllerMethod('getStackStatus', 'getStackStatus');
  testControllerMethod('getStackLocale', 'getStackLocale');
  testControllerMethod('getOrgDetails', 'getOrgDetails');
});
