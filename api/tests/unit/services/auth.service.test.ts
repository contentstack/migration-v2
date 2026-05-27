import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockGenerateToken, mockAuthModelRead, mockAuthModelUpdate, mockChainValue } = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockGenerateToken: vi.fn(),
  mockAuthModelRead: vi.fn(),
  mockAuthModelUpdate: vi.fn(),
  mockChainValue: vi.fn(),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/utils/jwt.utils.js', () => ({ generateToken: mockGenerateToken }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../src/config/index.js', () => ({
  config: {
    CS_API: { NA: 'https://api.contentstack.io/v3', EU: 'https://eu-api.contentstack.io/v3' },
    APP_TOKEN_KEY: 'test-secret',
    APP_TOKEN_EXP: '2d',
  },
}));
vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthModelRead,
    update: mockAuthModelUpdate,
    chain: {
      get: vi.fn().mockReturnValue({
        findIndex: vi.fn().mockReturnValue({ value: mockChainValue }),
      }),
    },
  },
}));

import { authService } from '../../../src/services/auth.service.js';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthModelRead.mockResolvedValue(undefined);
    mockAuthModelUpdate.mockImplementation((fn: any) => fn({ users: [] }));
    mockChainValue.mockReturnValue(-1);
  });

  describe('login', () => {
    const createReq = (body: any = {}) => ({
      body: {
        email: 'test@example.com',
        password: 'password123',
        region: 'NA',
        ...body,
      },
    });

    it('should return app_token on successful login with admin org', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            uid: 'user-123',
            email: 'test@example.com',
            authtoken: 'cs-token',
            organizations: [
              { uid: 'org-1', name: 'Org 1', org_roles: [{ admin: true }], is_owner: false },
            ],
          },
        },
      });
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.app_token).toBe('jwt-token');
      expect(result.data.message).toBe('Login Successful.');
      expect(mockGenerateToken).toHaveBeenCalledWith({
        region: 'NA',
        user_id: 'user-123',
        is_sso: false,
      });
    });

    it('should return app_token for owner org', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            uid: 'user-123',
            email: 'test@example.com',
            authtoken: 'cs-token',
            organizations: [
              { uid: 'org-1', name: 'Org 1', org_roles: [], is_owner: true },
            ],
          },
        },
      });
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.app_token).toBe('jwt-token');
    });

    it('should return app_token when user has org membership without admin flags (role payload fallback)', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            uid: 'user-123',
            email: 'test@example.com',
            authtoken: 'cs-token',
            organizations: [
              { uid: 'org-1', name: 'Org 1', org_roles: [{ admin: false }], is_owner: false },
            ],
          },
        },
      });
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.app_token).toBe('jwt-token');
    });

    it('should throw BadRequestError when user has no organizations', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            uid: 'user-123',
            email: 'test@example.com',
            authtoken: 'cs-token',
            organizations: [],
          },
        },
      });

      await expect(authService.login(createReq() as any)).rejects.toThrow(
        'You are not a member of any Contentstack organization in this region (or organization list is empty).'
      );
    });

    it('should return error data when CS API returns error', async () => {
      mockHttps.mockRejectedValue({
        response: { data: { error_message: 'Invalid credentials' }, status: 401 },
      });

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(401);
      expect(result.data.error_message).toBe('Invalid credentials');
    });

    it('should handle SUPPORT_DOC status response', async () => {
      mockHttps.mockResolvedValue({
        status: 294,
        data: { notice: 'Support doc needed' },
      });

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(294);
      expect(result.data.notice).toBe('Support doc needed');
    });

    it('should handle 2FA token flow', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: {
          user: {
            uid: 'user-123',
            email: 'test@example.com',
            authtoken: 'cs-token',
            organizations: [
              { uid: 'org-1', name: 'Org 1', org_roles: [{ admin: true }], is_owner: false },
            ],
          },
        },
      });
      mockGenerateToken.mockReturnValue('jwt-2fa');

      const result = await authService.login(
        createReq({ tfa_token: '123456' }) as any
      );

      expect(result.status).toBe(200);
      expect(result.data.app_token).toBe('jwt-2fa');
      expect(mockHttps).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user: expect.objectContaining({ tfa_token: '123456' }),
          }),
        })
      );
    });

    it('should return raw response when organizations is undefined', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: { user: { uid: 'u1' } },
      });

      const result = await authService.login(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ user: { uid: 'u1' } });
    });
  });

  describe('requestSms', () => {
    const createReq = (body: any = {}) => ({
      body: {
        email: 'test@example.com',
        password: 'password123',
        region: 'NA',
        ...body,
      },
    });

    it('should return success response on successful SMS request', async () => {
      mockHttps.mockResolvedValue({
        status: 200,
        data: { message: 'SMS sent' },
      });

      const result = await authService.requestSms(createReq() as any);

      expect(result.status).toBe(200);
      expect(result.data.message).toBe('SMS sent');
    });

    it('should return error data when CS API returns error', async () => {
      mockHttps.mockRejectedValue({
        response: { data: { error_message: 'Rate limited' }, status: 429 },
      });

      const result = await authService.requestSms(createReq() as any);

      expect(result.status).toBe(429);
    });

    it('should throw InternalServerError on unexpected exception', async () => {
      mockHttps.mockImplementation(() => {
        throw new Error('Unexpected');
      });

      await expect(authService.requestSms(createReq() as any)).rejects.toThrow();
    });
  });
});
