import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRead, mockChain, mockExistsSync, mockReadFileSync, mockDecryptAppConfig } = vi.hoisted(() => {
  const mockChain = {
    get: vi.fn().mockReturnThis(),
    findIndex: vi.fn().mockReturnThis(),
    value: vi.fn(),
  };
  return {
    mockRead: vi.fn(),
    mockChain,
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockDecryptAppConfig: vi.fn((c: Record<string, unknown>) => c),
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}));

vi.mock('../../../src/utils/crypto.utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/crypto.utils.js')>();
  return {
    ...actual,
    decryptAppConfig: (c: Record<string, unknown>) => mockDecryptAppConfig(c),
  };
});

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockRead,
    chain: mockChain,
    data: { users: [] },
  },
}));

vi.mock('../../../src/utils/custom-errors.utils.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return actual;
});

import getAuthToken from '../../../src/utils/auth.utils.js';
import {
  getAccessToken,
  getAppOrganizationUID,
  getAppOrganization,
  getAppConfig,
} from '../../../src/utils/auth.utils.js';
import AuthenticationModel from '../../../src/models/authentication.js';

describe('auth.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');
    mockDecryptAppConfig.mockImplementation((c: Record<string, unknown>) => c);
  });

  it('should return authtoken for a valid user', async () => {
    mockChain.value.mockReturnValue(0);
    (AuthenticationModel as any).data = {
      users: [{ region: 'NA', user_id: 'user-123', authtoken: 'valid-token' }],
    };

    const token = await getAuthToken('NA', 'user-123');
    expect(token).toBe('valid-token');
    expect(mockRead).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not found', async () => {
    mockChain.value.mockReturnValue(-1);
    (AuthenticationModel as any).data = { users: [] };

    await expect(getAuthToken('NA', 'unknown-user')).rejects.toThrow();
  });

  it('should throw UnauthorizedError when authtoken is missing', async () => {
    mockChain.value.mockReturnValue(0);
    (AuthenticationModel as any).data = {
      users: [{ region: 'NA', user_id: 'user-123', authtoken: '' }],
    };

    await expect(getAuthToken('NA', 'user-123')).rejects.toThrow();
  });

  describe('getAccessToken', () => {
    it('returns access_token for valid user', async () => {
      mockChain.value.mockReturnValue(0);
      (AuthenticationModel as any).data = {
        users: [{ region: 'EU', user_id: 'u2', access_token: 'at-1' }],
      };
      await expect(getAccessToken('EU', 'u2')).resolves.toBe('at-1');
    });

    it('throws when user missing or no access_token', async () => {
      mockChain.value.mockReturnValue(-1);
      (AuthenticationModel as any).data = { users: [] };
      await expect(getAccessToken('NA', 'x')).rejects.toThrow();
    });
  });

  describe('loadAppConfig consumers', () => {
    it('getAppOrganizationUID returns uid', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ organization: { uid: 'org-uid', name: 'N' } })
      );
      expect(getAppOrganizationUID()).toBe('org-uid');
    });

    it('getAppOrganizationUID throws when uid missing', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ organization: { name: 'N' } }));
      expect(() => getAppOrganizationUID()).toThrow('Organization UID not found');
    });

    it('getAppOrganization returns uid and name', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ organization: { uid: 'o1', name: 'Org' } })
      );
      expect(getAppOrganization()).toEqual({ uid: 'o1', name: 'Org' });
    });

    it('getAppOrganization throws when org incomplete', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ organization: { uid: 'o1' } }));
      expect(() => getAppOrganization()).toThrow('Organization details not found');
    });

    it('getAppConfig returns config when oauthData present', () => {
      const cfg = { oauthData: { client_id: 'c' } };
      mockReadFileSync.mockReturnValue(JSON.stringify(cfg));
      expect(getAppConfig()).toMatchObject(cfg);
    });

    it('getAppConfig throws when oauthData missing', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));
      expect(() => getAppConfig()).toThrow('SSO is not configured');
    });

    it('loadAppConfig throws when app.json missing', () => {
      mockExistsSync.mockReturnValue(false);
      expect(() => getAppOrganizationUID()).toThrow('app.json file not found');
    });
  });
});
