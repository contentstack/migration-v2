import { describe, it, expect, vi, beforeEach } from 'vitest';

const ORG_MISMATCH_GENERIC =
  'Organization mismatch: the authorized org does not match the Migration Tool SSO configuration.';

const {
  mockGenerateToken,
  mockAuthRead,
  mockAuthUpdate,
  mockFindIndexInner,
  mockFindInner,
  mockExistsSync,
  mockReadFileSync,
  mockGetAppOrgUid,
  mockGetAppOrganization,
  mockChainGet,
} = vi.hoisted(() => {
  const mockFindIndexInner = vi.fn();
  const mockFindInner = vi.fn();
  const mockChainGet = vi.fn(() => ({
    findIndex: vi.fn().mockReturnValue({ value: mockFindIndexInner }),
    find: vi.fn().mockReturnValue({ value: mockFindInner }),
  }));
  return {
    mockGenerateToken: vi.fn(() => 'app-jwt'),
    mockAuthRead: vi.fn(),
    mockAuthUpdate: vi.fn(),
    mockFindIndexInner,
    mockFindInner,
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockGetAppOrgUid: vi.fn(() => 'org-match'),
    mockGetAppOrganization: vi.fn(() => {
      throw new Error('App organization metadata unavailable in test');
    }),
    mockChainGet,
  };
});

vi.mock('../../../src/utils/jwt.utils.js', () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    update: mockAuthUpdate,
    chain: {
      get: mockChainGet,
    },
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('../../../src/utils/crypto.utils.js', () => ({
  decryptAppConfig: (c: Record<string, unknown>) => c,
}));

vi.mock('../../../src/utils/auth.utils.js', () => ({
  getAppOrganizationUID: () => mockGetAppOrgUid(),
  getAppOrganization: () => mockGetAppOrganization(),
}));

import { getAppData, checkSSOAuthStatus } from '../../../src/services/auth.service.js';
import { authService } from '../../../src/services/auth.service.js';

describe('auth.service SSO helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppOrganization.mockImplementation(() => {
      throw new Error('App organization metadata unavailable in test');
    });
    mockAuthRead.mockResolvedValue(undefined);
    mockAuthUpdate.mockImplementation(async (fn: (d: { users: unknown[] }) => void) => {
      fn({ users: [] });
    });
    mockFindIndexInner.mockReturnValue(-1);
    mockFindInner.mockReturnValue(null);
  });

  describe('getAppData', () => {
    it('throws when app.json is missing', async () => {
      mockExistsSync.mockReturnValue(false);
      await expect(getAppData()).rejects.toThrow('app.json file not found');
    });

    it('throws when isDefault is true', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ isDefault: true }));
      await expect(getAppData()).rejects.toThrow('SSO is not configured');
    });

    it('returns config when valid', async () => {
      mockExistsSync.mockReturnValue(true);
      const cfg = { isDefault: false, oauthData: { client_id: 'c' } };
      mockReadFileSync.mockReturnValue(JSON.stringify(cfg));
      await expect(getAppData()).resolves.toMatchObject(cfg);
    });

    it('throws on invalid JSON', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ not json');
      await expect(getAppData()).rejects.toThrow('Invalid JSON format');
    });
  });

  describe('checkSSOAuthStatus', () => {
    it('returns not authenticated when user missing', async () => {
      mockFindInner.mockReturnValue(null);
      await expect(checkSSOAuthStatus('u1')).resolves.toEqual({
        authenticated: false,
        message: 'SSO authentication not completed',
      });
    });

    it('returns not authenticated when no access_token', async () => {
      mockFindInner.mockReturnValue({ user_id: 'u1', email: 'a@b.com' });
      await expect(checkSSOAuthStatus('u1')).resolves.toMatchObject({
        authenticated: false,
      });
    });

    it('returns not authenticated when org mismatch', async () => {
      mockGetAppOrgUid.mockReturnValueOnce('org-match');
      mockFindInner.mockReturnValue({
        user_id: 'u1',
        access_token: 'tok',
        organization_uid: 'other-org',
        region: 'NA',
        email: 'a@b.com',
        updated_at: new Date().toISOString(),
      });
      await expect(checkSSOAuthStatus('u1')).resolves.toMatchObject({
        authenticated: false,
        message: ORG_MISMATCH_GENERIC,
      });
    });

    it('returns not authenticated with Contentstack org hint when app org name resolves', async () => {
      mockGetAppOrgUid.mockReturnValueOnce('org-match');
      mockGetAppOrganization.mockReturnValueOnce({ name: 'Configured Contentstack Org' });
      mockFindInner.mockReturnValue({
        user_id: 'u1',
        access_token: 'tok',
        organization_uid: 'other-org',
        region: 'NA',
        email: 'a@b.com',
        updated_at: new Date().toISOString(),
      });
      await expect(checkSSOAuthStatus('u1')).resolves.toMatchObject({
        authenticated: false,
        message:
          'Organization mismatch: authorize "Configured Contentstack Org" in Contentstack (same org as SSO setup), then try again.',
      });
    });

    it('returns not authenticated when organization_uid is missing', async () => {
      mockFindInner.mockReturnValue({
        user_id: 'u1',
        access_token: 'tok',
        region: 'NA',
        email: 'a@b.com',
        updated_at: new Date().toISOString(),
      });
      await expect(checkSSOAuthStatus('u1')).resolves.toEqual({
        authenticated: false,
        message: 'Organization not linked to user',
      });
    });

    it('returns not authenticated when SSO token is older than 10 minutes', async () => {
      mockGetAppOrgUid.mockReturnValue('org-match');
      const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString();
      mockFindInner.mockReturnValue({
        user_id: 'u1',
        access_token: 'tok',
        organization_uid: 'org-match',
        region: 'NA',
        email: 'a@b.com',
        updated_at: stale,
      });
      await expect(checkSSOAuthStatus('u1')).resolves.toEqual({
        authenticated: false,
        message: 'SSO authentication expired',
      });
    });

    it('returns success when token fresh and org matches', async () => {
      mockGetAppOrgUid.mockReturnValue('org-match');
      mockFindInner.mockReturnValue({
        user_id: 'u1',
        access_token: 'tok',
        organization_uid: 'org-match',
        region: 'NA',
        email: 'a@b.com',
        updated_at: new Date().toISOString(),
      });

      const out = await checkSSOAuthStatus('u1');
      expect(out.authenticated).toBe(true);
      expect(out).toHaveProperty('app_token', 'app-jwt');
      expect(mockGenerateToken).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('throws when email missing', async () => {
      await expect(authService.logout({ body: {} } as any)).rejects.toThrow('User not found');
    });

    it('throws when user not in DB', async () => {
      mockFindInner.mockReturnValue(null);
      await expect(
        authService.logout({ body: { email: 'missing@x.com' } } as any)
      ).rejects.toThrow();
    });

    it('removes user and returns 200', async () => {
      mockFindInner.mockReturnValue({ email: 'a@b.com', user_id: 'u1' });
      const r = await authService.logout({ body: { email: 'a@b.com' } } as any);
      expect(r.status).toBe(200);
      expect(mockAuthUpdate).toHaveBeenCalled();
    });
  });
});
