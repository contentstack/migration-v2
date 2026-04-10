import { describe, it, expect, vi, beforeEach } from 'vitest';
import authUtils, { getAccessToken } from '../../../src/utils/auth.utils.js';
import { UnauthorizedError } from '../../../src/utils/custom-errors.utils.js';

// Mock dependencies
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  }
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: vi.fn().mockResolvedValue(undefined),
    chain: {
      get: vi.fn().mockReturnValue({
        findIndex: vi.fn()
      })
    },
    data: {
      users: []
    }
  }
}));

vi.mock('../../../src/utils/crypto.utils.js', () => ({
  decryptAppConfig: vi.fn().mockImplementation((config) => config)
}));

describe('auth.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default export (authUtils)', () => {
    it('should return auth token for valid user', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user found at index 0
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'us',
          user_id: 'user123',
          authtoken: 'valid-auth-token'
        }
      ];

      const result = await authUtils('us', 'user123');

      expect(result).toBe('valid-auth-token');
      expect(AuthenticationModel.read).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when user not found', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user not found (index -1)
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(-1)
        })
      });

      AuthenticationModel.data.users = [];

      await expect(authUtils('us', 'nonexistent')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });

    it('should throw UnauthorizedError when auth token is missing', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user found but without auth token
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'us',
          user_id: 'user123',
          authtoken: null // Missing token
        }
      ];

      await expect(authUtils('us', 'user123')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });

    it('should throw UnauthorizedError when auth token is empty string', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'us',
          user_id: 'user123',
          authtoken: '' // Empty token
        }
      ];

      await expect(authUtils('us', 'user123')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return access token for valid user', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user found at index 0
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'eu',
          user_id: 'user456',
          access_token: 'valid-access-token'
        }
      ];

      const result = await getAccessToken('eu', 'user456');

      expect(result).toBe('valid-access-token');
      expect(AuthenticationModel.read).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when user not found', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user not found (index -1)
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(-1)
        })
      });

      AuthenticationModel.data.users = [];

      await expect(getAccessToken('eu', 'nonexistent')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });

    it('should throw UnauthorizedError when access token is missing', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock user found but without access token
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'eu',
          user_id: 'user456',
          access_token: null // Missing token
        }
      ];

      await expect(getAccessToken('eu', 'user456')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });

    it('should throw UnauthorizedError when access token is empty string', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue({
          value: vi.fn().mockReturnValue(0)
        })
      });

      AuthenticationModel.data.users = [
        {
          region: 'eu',
          user_id: 'user456',
          access_token: '' // Empty token
        }
      ];

      await expect(getAccessToken('eu', 'user456')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });

    it('should handle optional chaining gracefully', async () => {
      const { default: AuthenticationModel } = await import('../../../src/models/authentication.js');
      
      // Mock chain.get returning undefined to test optional chaining
      (AuthenticationModel.chain.get as ReturnType<typeof vi.fn>).mockReturnValue({
        findIndex: vi.fn().mockReturnValue(undefined)
      });

      AuthenticationModel.data.users = [];

      await expect(getAccessToken('eu', 'user456')).rejects.toMatchObject({
        statusCode: 401,
        message: "You're unauthorized to access this resource."
      });
    });
  });
});