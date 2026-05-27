import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockAuthModelRead, mockChainValue, mockRequestWithSsoTokenRefresh } =
  vi.hoisted(() => ({
    mockHttps: vi.fn(),
    mockAuthModelRead: vi.fn(),
    mockChainValue: vi.fn(),
    mockRequestWithSsoTokenRefresh: vi.fn(),
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
      users: [
        {
          user_id: 'user-123',
          region: 'NA',
          authtoken: 'cs-token',
          access_token: 'sso-access-token',
        },
      ],
    },
  },
}));
vi.mock('../../../src/utils/auth.utils.js', () => ({
  getAppOrganization: vi.fn(() => ({ uid: 'org-1', name: 'Test Org' })),
}));
vi.mock('../../../src/utils/sso-request.utils.js', () => ({
  requestWithSsoTokenRefresh: mockRequestWithSsoTokenRefresh,
}));

import AuthenticationModel from '../../../src/models/authentication.js';
import { getAppOrganization } from '../../../src/utils/auth.utils.js';
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
      expect(result.data.user.region).toBe('NA');
      expect(result.data.user.orgs).toHaveLength(2);
      expect(getAppOrganization).not.toHaveBeenCalled();
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

    it('should return profile with empty orgs when CS API returns no user object', async () => {
      mockChainValue.mockReturnValue(0);
      mockHttps.mockResolvedValue({
        status: 200,
        data: {},
      });

      const result = await userService.getUserProfile(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.user.email).toBeUndefined();
      expect(result.data.user.orgs).toEqual([]);
    });

    it('should return SSO user profile when org matches app organization', async () => {
      mockChainValue.mockReturnValue(0);
      mockRequestWithSsoTokenRefresh.mockResolvedValue([
        null,
        {
          status: 200,
          data: {
            user: {
              email: 'sso@example.com',
              first_name: 'S',
              last_name: 'O',
              organizations: [{ uid: 'org-1', name: 'Org 1' }],
            },
          },
        },
      ]);

      const result = await userService.getUserProfile({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: true },
        },
      } as any);

      expect(result?.status).toBe(200);
      expect(result?.data?.user?.email).toBe('sso@example.com');
      expect(result?.data?.user?.region).toBe('NA');
      expect(result?.data?.user?.orgs).toEqual([
        { org_id: 'org-1', org_name: 'Test Org' },
      ]);
    });

    it('should throw when SSO user has no access token', async () => {
      mockChainValue.mockReturnValue(0);
      const user = AuthenticationModel.data.users[0] as {
        access_token?: string;
      };
      const prev = user?.access_token;
      delete user.access_token;

      await expect(
        userService.getUserProfile({
          body: {
            token_payload: { region: 'NA', user_id: 'user-123', is_sso: true },
          },
        } as any)
      ).rejects.toMatchObject({ message: 'SSO authentication not completed' });

      user.access_token = prev;
    });

    it('should return error payload when SSO CS request fails', async () => {
      mockChainValue.mockReturnValue(0);
      mockRequestWithSsoTokenRefresh.mockResolvedValue([
        { response: { data: { error: 'bad' }, status: 403 } },
        null,
      ]);

      const result = await userService.getUserProfile({
        body: {
          token_payload: { region: 'NA', user_id: 'user-123', is_sso: true },
        },
      } as any);

      expect(result?.status).toBe(403);
      expect(result?.data).toEqual({ error: 'bad' });
    });

    it('should throw when SSO user org list does not include app org', async () => {
      mockChainValue.mockReturnValue(0);
      mockRequestWithSsoTokenRefresh.mockResolvedValue([
        null,
        {
          status: 200,
          data: {
            user: {
              organizations: [{ uid: 'other-org', name: 'Other' }],
            },
          },
        },
      ]);

      await expect(
        userService.getUserProfile({
          body: {
            token_payload: { region: 'NA', user_id: 'user-123', is_sso: true },
          },
        } as any)
      ).rejects.toMatchObject({ message: 'Organization access revoked' });
    });

    it('should wrap unexpected errors in ExceptionFunction (SSO path reads app org)', async () => {
      mockChainValue.mockReturnValue(0);
      vi.mocked(getAppOrganization).mockImplementationOnce(() => {
        throw new Error('unexpected');
      });

      await expect(
        userService.getUserProfile({
          body: {
            token_payload: { region: 'NA', user_id: 'user-123', is_sso: true },
          },
        } as any)
      ).rejects.toMatchObject({ message: 'unexpected' });
    });
  });
});
