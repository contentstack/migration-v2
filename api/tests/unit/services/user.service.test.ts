import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockHttps,
  mockAuthModelRead,
  mockAuthModelWrite,
  mockChainValue,
  mockRequestWithSsoTokenRefresh,
} = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockAuthModelRead: vi.fn(),
  mockAuthModelWrite: vi.fn(),
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
    write: mockAuthModelWrite,
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
    mockAuthModelWrite.mockResolvedValue(undefined);
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

  describe('source-session endpoints', () => {
    const createReq = (extra: any = {}) => ({
      body: {
        token_payload: { region: 'NA', user_id: 'user-123', is_sso: false },
        ...extra,
      },
    });

    describe('getSourceSession', () => {
      it('returns null when the user record is not found', async () => {
        mockChainValue.mockReturnValue(-1);
        const res = await userService.getSourceSession(createReq() as any);
        expect(res.status).toBe(200);
        expect(res.data.source_session).toBeNull();
      });

      it('returns the stored session when present', async () => {
        mockChainValue.mockReturnValue(0);
        AuthenticationModel.data.users[0] = {
          ...AuthenticationModel.data.users[0],
          source_session: { region: 'EU', appToken: 'src-tok' },
        } as any;
        const res = await userService.getSourceSession(createReq() as any);
        expect(res.status).toBe(200);
        expect(res.data.source_session).toEqual({ region: 'EU', appToken: 'src-tok' });
      });

      it('returns null when the user record has no source_session', async () => {
        mockChainValue.mockReturnValue(0);
        delete (AuthenticationModel.data.users[0] as any).source_session;
        const res = await userService.getSourceSession(createReq() as any);
        expect(res.data.source_session).toBeNull();
      });
    });

    describe('setSourceSession', () => {
      it('throws when region is missing', async () => {
        mockChainValue.mockReturnValue(0);
        await expect(
          userService.setSourceSession(
            createReq({ appToken: 'tok' }) as any
          )
        ).rejects.toThrow('region and appToken are required');
        expect(mockAuthModelWrite).not.toHaveBeenCalled();
      });

      it('throws when appToken is missing', async () => {
        mockChainValue.mockReturnValue(0);
        await expect(
          userService.setSourceSession(createReq({ region: 'EU' }) as any)
        ).rejects.toThrow('region and appToken are required');
      });

      it('throws when the authenticated user is not found', async () => {
        mockChainValue.mockReturnValue(-1);
        await expect(
          userService.setSourceSession(
            createReq({ region: 'EU', appToken: 'tok' }) as any
          )
        ).rejects.toThrow();
      });

      it('persists region/appToken and bumps updated_at', async () => {
        mockChainValue.mockReturnValue(0);
        delete (AuthenticationModel.data.users[0] as any).source_session;
        const before = AuthenticationModel.data.users[0].updated_at;
        const res = await userService.setSourceSession(
          createReq({ region: '  EU  ', appToken: 'tok-xyz' }) as any
        );
        expect(res.status).toBe(200);
        expect(res.data.source_session).toEqual({ region: 'EU', appToken: 'tok-xyz' });
        expect((AuthenticationModel.data.users[0] as any).source_session).toEqual({
          region: 'EU',
          appToken: 'tok-xyz',
        });
        expect(AuthenticationModel.data.users[0].updated_at).not.toBe(before);
        expect(mockAuthModelWrite).toHaveBeenCalled();
      });
    });

    describe('clearSourceSession', () => {
      it('is a no-op when the user is not found', async () => {
        mockChainValue.mockReturnValue(-1);
        const res = await userService.clearSourceSession(createReq() as any);
        expect(res.status).toBe(200);
        expect(res.data.source_session).toBeNull();
        expect(mockAuthModelWrite).not.toHaveBeenCalled();
      });

      it('is a no-op when the user has no source_session', async () => {
        mockChainValue.mockReturnValue(0);
        delete (AuthenticationModel.data.users[0] as any).source_session;
        const res = await userService.clearSourceSession(createReq() as any);
        expect(res.data.source_session).toBeNull();
        expect(mockAuthModelWrite).not.toHaveBeenCalled();
      });

      it('deletes the source_session and writes when present', async () => {
        mockChainValue.mockReturnValue(0);
        (AuthenticationModel.data.users[0] as any).source_session = {
          region: 'EU',
          appToken: 'tok',
        };
        const res = await userService.clearSourceSession(createReq() as any);
        expect(res.data.source_session).toBeNull();
        expect(
          (AuthenticationModel.data.users[0] as any).source_session
        ).toBeUndefined();
        expect(mockAuthModelWrite).toHaveBeenCalled();
      });
    });
  });
});
