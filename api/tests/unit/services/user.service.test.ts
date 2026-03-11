import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockAuthModelRead, mockChainValue } = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockAuthModelRead: vi.fn(),
  mockChainValue: vi.fn(),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: {
    CS_API: { NA: 'https://api.contentstack.io/v3' },
  },
}));
vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthModelRead,
    chain: {
      get: vi.fn().mockReturnValue({
        findIndex: vi.fn().mockReturnValue({ value: mockChainValue }),
      }),
    },
    data: {
      users: [{ user_id: 'user-123', region: 'NA', authtoken: 'cs-token' }],
    },
  },
}));

import { userService } from '../../../src/services/user.service.js';

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthModelRead.mockResolvedValue(undefined);
  });

  describe('getUserProfile', () => {
    const createReq = () => ({
      body: { token_payload: { region: 'NA', user_id: 'user-123' } },
    });

    it('should return user profile with orgs', async () => {
      mockChainValue.mockReturnValue(0);
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            organizations: [
              { uid: 'org-1', name: 'Org 1', org_roles: [{ admin: true }], is_owner: false },
              { uid: 'org-2', name: 'Org 2', org_roles: [], is_owner: true },
            ],
          },
        },
      });

      const result = await userService.getUserProfile(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.user.orgs).toHaveLength(2);
    });

    it('should throw when user not found in AuthenticationModel', async () => {
      mockChainValue.mockReturnValue(-1);

      await expect(
        userService.getUserProfile(createReq() as any)
      ).rejects.toThrow();
    });

    it('should return error response when CS API fails', async () => {
      mockChainValue.mockReturnValue(0);
      mockHttps.mockRejectedValue({
        response: { data: { error: 'Token expired' }, status: 401 },
      });

      const result = await userService.getUserProfile(createReq() as any);

      expect(result.status).toBe(401);
    });

    it('should throw when CS API returns no user', async () => {
      mockChainValue.mockReturnValue(0);
      mockHttps.mockResolvedValue({
        status: 200,
        data: {},
      });

      await expect(
        userService.getUserProfile(createReq() as any)
      ).rejects.toThrow();
    });
  });
});
