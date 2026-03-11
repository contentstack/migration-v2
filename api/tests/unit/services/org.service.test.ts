import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockGetAuthToken } = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockGetAuthToken: vi.fn(),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/auth.utils.js', () => ({ default: mockGetAuthToken }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: {
    CS_API: { NA: 'https://api.contentstack.io/v3' },
  },
}));

const { mockProjectRead, mockChainGet } = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockChainGet: vi.fn(),
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: {
      get: (...args: unknown[]) => mockChainGet(...args),
    },
    data: { projects: [] },
  },
}));

import { orgService } from '../../../src/services/org.service.js';

const createMockReq = (overrides: Record<string, unknown> = {}) =>
  ({
    params: { orgId: 'org-123' },
    body: { token_payload: { region: 'NA', user_id: 'user-123', org_uid: 'org-123' } },
    ...overrides,
  }) as any;

describe('org.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthToken.mockResolvedValue('cs-auth-token');
    mockProjectRead.mockResolvedValue(undefined);
  });

  describe('getAllStacks', () => {
    it('should return stacks from CS API', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          stacks: [
            { api_key: 'stack-1', name: 'Stack 1', description: 'Desc 1' },
            { api_key: 'stack-2', name: 'Stack 2', description: 'Desc 2' },
          ],
        },
      });
      mockChainGet.mockReturnValue({
        flatMap: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue([]) }),
      });

      const req = createMockReq({ params: { orgId: 'org-123' } });
      const result = await orgService.getAllStacks(req);

      expect(result.status).toBe(200);
      expect(result.data.stacks).toHaveLength(2);
    });

    it('should filter stacks by searchText', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          stacks: [
            { api_key: 's1', name: 'Foo Stack', description: 'A' },
            { api_key: 's2', name: 'Bar Stack', description: 'B' },
            { api_key: 's3', name: 'Other', description: 'Foo bar' },
          ],
        },
      });
      mockChainGet.mockReturnValue({
        flatMap: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue([]) }),
      });

      const req = createMockReq({
        params: { orgId: 'org-123', searchText: 'foo' },
      });
      const result = await orgService.getAllStacks(req);

      expect(result.data.stacks).toHaveLength(2);
    });

    it('should exclude test stacks from results', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          stacks: [
            { api_key: 'stack-1', name: 'Stack 1' },
            { api_key: 'stack-2', name: 'Stack 2' },
          ],
        },
      });
      mockChainGet.mockReturnValue({
        flatMap: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue([{ stackUid: 'stack-1' }]),
        }),
      });

      const req = createMockReq();
      const result = await orgService.getAllStacks(req);

      expect(result.data.stacks).toHaveLength(1);
      expect(result.data.stacks[0].api_key).toBe('stack-2');
    });

    it('should return error when https returns error tuple', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      const origSafePromise = safePromiseModule.safePromise;
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 403, data: { error: 'Forbidden' } } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: { stacks: [] } });
      mockChainGet.mockReturnValue({
        flatMap: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue([]) }),
      });

      const req = createMockReq();
      const result = await orgService.getAllStacks(req);
      expect(result.status).toBe(403);
      expect(result.data).toEqual({ error: 'Forbidden' });
    });
  });

  describe('createStack', () => {
    it('should create a stack via CS API', async () => {
      mockHttps.mockResolvedValue({
        status: 201,
        data: { stack: { api_key: 'new-stack', name: 'New Stack' } },
      });

      const req = createMockReq({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          name: 'New Stack',
          description: 'Test stack',
          master_locale: 'en-us',
        },
      });
      const result = await orgService.createStack(req);

      expect(result.status).toBe(201);
      expect(result.data.stack.api_key).toBe('new-stack');
    });

    it('should return error response when create stack API returns error', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 400, data: { error: 'Bad request' } } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 201, data: {} });

      const req = createMockReq({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          name: 'New Stack',
          description: 'Test',
          master_locale: 'en-us',
        },
      });
      const result = await orgService.createStack(req);

      expect(result.status).toBe(400);
    });
  });

  describe('getLocales', () => {
    it('should return locales from CS API', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: { locales: [{ code: 'en-us', name: 'English' }] },
      });

      const req = createMockReq();
      const result = await orgService.getLocales(req);

      expect(result.status).toBe(200);
      expect(result.data.locales).toHaveLength(1);
    });

    it('should return error when get locales API returns error', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 401, data: { error: 'Unauthorized' } } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: {} });

      const req = createMockReq();
      const result = await orgService.getLocales(req);

      expect(result.status).toBe(401);
    });
  });

  describe('getStackStatus', () => {
    it('should return stack status with content type count', async () => {
      mockHttps
        .mockResolvedValueOnce({
          status: 200,
          data: { stacks: [{ api_key: 'stack-1', name: 'Stack 1' }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { count: 5 },
        });

      const req = createMockReq({
        params: { orgId: 'org-123' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          stack_api_key: 'stack-1',
        },
      });
      const result = await orgService.getStackStatus(req);

      expect(result.status).toBe(200);
      expect(result.data.contenttype_count).toBe(5);
    });

    it('should return error when stacks fetch fails', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 500, data: {} } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: { stacks: [] } });

      const req = createMockReq({
        params: { orgId: 'org-123' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          stack_api_key: 'stack-1',
        },
      });
      const result = await orgService.getStackStatus(req);

      expect(result.status).toBe(500);
      expect(result.data.message).toBeDefined();
    });

    it('should throw when stack not found', async () => {
      mockHttps.mockResolvedValueOnce({
        status: 200,
        data: { stacks: [{ api_key: 'other-stack' }] },
      });

      const req = createMockReq({
        params: { orgId: 'org-123' },
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          stack_api_key: 'stack-1',
        },
      });
      await expect(orgService.getStackStatus(req)).rejects.toThrow();
    });
  });

  describe('getStackLocale', () => {
    it('should return stack locales', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: { locales: [{ code: 'en-us', name: 'English' }] },
      });

      const req = createMockReq({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          stack_api_key: 'stack-1',
        },
      });
      const result = await orgService.getStackLocale(req);

      expect(result.status).toBe(200);
      expect(result.data.locales).toHaveLength(1);
    });

    it('should return error when get stack locale fails', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 404, data: {} } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: {} });

      const req = createMockReq({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123' },
          stack_api_key: 'stack-1',
        },
      });
      const result = await orgService.getStackLocale(req);

      expect(result.status).toBe(404);
    });
  });

  describe('getOrgDetails', () => {
    it('should return org details with plan', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: { organization: { uid: 'org-123', name: 'Test Org' } },
      });

      const req = createMockReq({ params: { orgId: 'org-123' } });
      const result = await orgService.getOrgDetails(req);

      expect(result.status).toBe(200);
      expect(result.data.organization.uid).toBe('org-123');
    });

    it('should return error when get org details fails', async () => {
      const safePromiseModule = await import('../../../src/utils/index.js');
      vi.spyOn(safePromiseModule, 'safePromise').mockImplementation((p: Promise<unknown>) =>
        p.then(() => [{ response: { status: 404, data: {} } }, null] as any)
      );

      mockHttps.mockResolvedValue({ status: 200, data: {} });

      const req = createMockReq({ params: { orgId: 'org-123' } });
      const result = await orgService.getOrgDetails(req);

      expect(result.status).toBe(404);
    });
  });
});
