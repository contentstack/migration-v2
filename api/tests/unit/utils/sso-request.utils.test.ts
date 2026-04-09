import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestWithSsoTokenRefresh } from '../../../src/utils/sso-request.utils.js';
import { AppTokenPayload } from '../../../src/models/types.js';

// Mock dependencies
vi.mock('../../../src/services/auth.service.js', () => ({
  refreshOAuthToken: vi.fn()
}));

vi.mock('../../../src/utils/index.js', () => ({
  safePromise: vi.fn()
}));

vi.mock('../../../src/utils/https.utils.js', () => ({
  default: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('sso-request.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestWithSsoTokenRefresh', () => {
    const mockTokenPayload: AppTokenPayload = {
      is_sso: true,
      access_token: 'old-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      user_id: 'test-user-id'
    };

    const mockRequestConfig = {
      url: 'https://api.contentstack.io/v3/stacks',
      method: 'GET',
      headers: { 'Authorization': 'Bearer old-token' }
    };

    it('should return response directly if no error', async () => {
      const mockResponse = { data: { stacks: [] } };
      const { safePromise } = await import('../../../src/utils/index.js');
      (safePromise as ReturnType<typeof vi.fn>).mockResolvedValue([null, mockResponse]);

      const [err, res] = await requestWithSsoTokenRefresh(mockTokenPayload, mockRequestConfig);

      expect(err).toBeNull();
      expect(res).toEqual(mockResponse);
      expect(safePromise).toHaveBeenCalledTimes(1);
    });

    it('should return error directly if not SSO token', async () => {
      const nonSsoToken = { ...mockTokenPayload, is_sso: false };
      const mockError = new Error('Network error');
      const { safePromise } = await import('../../../src/utils/index.js');
      (safePromise as ReturnType<typeof vi.fn>).mockResolvedValue([mockError, null]);

      const [err, res] = await requestWithSsoTokenRefresh(nonSsoToken, mockRequestConfig);

      expect(err).toEqual(mockError);
      expect(res).toBeNull();
    });

    it('should return error directly if not 401 status', async () => {
      const mockError = { response: { status: 500, data: {} } };
      const { safePromise } = await import('../../../src/utils/index.js');
      (safePromise as ReturnType<typeof vi.fn>).mockResolvedValue([mockError, null]);

      const [err, res] = await requestWithSsoTokenRefresh(mockTokenPayload, mockRequestConfig);

      expect(err).toEqual(mockError);
      expect(res).toBeNull();
    });

    it('should attempt token refresh on 401 error for SSO token', async () => {
      const mockError = { response: { status: 401, data: {} } };
      const mockSuccessResponse = { data: { stacks: [] } };

      const { safePromise } = await import('../../../src/utils/index.js');
      const { refreshOAuthToken } = await import('../../../src/services/auth.service.js');

      // First call fails with 401, second call succeeds
      (safePromise as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([mockError, null])
        .mockResolvedValueOnce([null, mockSuccessResponse]);

      (refreshOAuthToken as ReturnType<typeof vi.fn>).mockResolvedValue('new-token');

      const [err, res] = await requestWithSsoTokenRefresh(mockTokenPayload, mockRequestConfig);

      expect(refreshOAuthToken).toHaveBeenCalledWith(mockTokenPayload.user_id);
      expect(safePromise).toHaveBeenCalledTimes(2);
      expect(err).toBeNull();
      expect(res).toEqual(mockSuccessResponse);
    });

    it('should return original error if token refresh fails', async () => {
      const mockError = { response: { status: 401, data: {} } };
      const refreshError = new Error('Refresh failed');

      const { safePromise } = await import('../../../src/utils/index.js');
      const { refreshOAuthToken } = await import('../../../src/services/auth.service.js');

      (safePromise as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockError, null]);
      (refreshOAuthToken as ReturnType<typeof vi.fn>).mockRejectedValue(refreshError);

      const [err, res] = await requestWithSsoTokenRefresh(mockTokenPayload, mockRequestConfig);

      expect(err).toEqual(mockError); // Returns original error when refresh fails
      expect(res).toBeNull();
    });

    it('should handle error code 105 as refresh trigger', async () => {
      const mockError = { response: { status: 200, data: { error_code: 105 } } };
      const mockSuccessResponse = { data: { stacks: [] } };

      const { safePromise } = await import('../../../src/utils/index.js');
      const { refreshOAuthToken } = await import('../../../src/services/auth.service.js');

      (safePromise as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([mockError, null])
        .mockResolvedValueOnce([null, mockSuccessResponse]);

      (refreshOAuthToken as ReturnType<typeof vi.fn>).mockResolvedValue('new-token');

      const [err, res] = await requestWithSsoTokenRefresh(mockTokenPayload, mockRequestConfig);

      expect(refreshOAuthToken).toHaveBeenCalled();
      expect(err).toBeNull();
      expect(res).toEqual(mockSuccessResponse);
    });
  });
});