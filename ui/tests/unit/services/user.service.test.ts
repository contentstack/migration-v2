import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCall, mockPutCall, mockDeleteCall } = vi.hoisted(() => ({
  mockGetCall: vi.fn(),
  mockPutCall: vi.fn(),
  mockDeleteCall: vi.fn()
}));

vi.mock('../../../src/services/api/service', () => ({
  getCall: mockGetCall,
  putCall: mockPutCall,
  deleteCall: mockDeleteCall
}));

vi.mock('../../../src/utilities/constants', () => ({
  API_VERSION: 'v2',
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {}
}));

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => 'mock-app-token')
}));

import {
  getUser,
  getAllLocales,
  fetchSourceSession,
  saveSourceSession,
  removeSourceSession
} from '../../../src/services/api/user.service';

describe('services/api/user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUser', () => {
    it('should call getCall with user profile endpoint', async () => {
      const mockResponse = {
        status: 200,
        data: { user: { email: 'test@example.com', first_name: 'Test' } }
      };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getUser();
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/user/profile',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 401, data: { message: 'Unauthorized' } };
      mockGetCall.mockResolvedValue(errorResponse);

      const result = await getUser();
      expect(result).toEqual(errorResponse);
    });
  });

  describe('getAllLocales', () => {
    it('should call getCall with locales endpoint for the given org', async () => {
      const mockResponse = { status: 200, data: { locales: ['en-us', 'fr-fr'] } };
      mockGetCall.mockResolvedValue(mockResponse);

      const result = await getAllLocales('org-123');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/org/org-123/locales',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw with message when getCall throws an Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('Timeout'); });
      await expect(getAllLocales('org-123')).rejects.toThrow('Error in userSession: Timeout');
    });

    it('should throw generic message when getCall throws a non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw null; });
      await expect(getAllLocales('org-123')).rejects.toThrow('Unknown error in userSession');
    });
  });

  describe('getUser - error handling', () => {
    it('should throw with message when getCall throws an Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('Auth error'); });
      await expect(getUser()).rejects.toThrow('Error in userSession: Auth error');
    });

    it('should throw generic message when getCall throws a non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw undefined; });
      await expect(getUser()).rejects.toThrow('Unknown error in userSession');
    });
  });

  describe('source-session API', () => {
    describe('fetchSourceSession', () => {
      it('returns the source_session from the response payload', async () => {
        mockGetCall.mockResolvedValue({
          data: { source_session: { region: 'EU', appToken: 'tok' } }
        });
        const result = await fetchSourceSession();
        expect(mockGetCall).toHaveBeenCalledWith(
          'v2/user/source-session',
          expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
        );
        expect(result).toEqual({ region: 'EU', appToken: 'tok' });
      });

      it('returns null when payload lacks source_session', async () => {
        mockGetCall.mockResolvedValue({ data: {} });
        expect(await fetchSourceSession()).toBeNull();
      });

      it('returns null on thrown error', async () => {
        mockGetCall.mockImplementation(() => { throw new Error('boom'); });
        expect(await fetchSourceSession()).toBeNull();
      });
    });

    describe('saveSourceSession', () => {
      it('PUTs region + appToken to the endpoint', async () => {
        mockPutCall.mockResolvedValue({ status: 200 });
        await saveSourceSession('EU', 'tok');
        expect(mockPutCall).toHaveBeenCalledWith(
          'v2/user/source-session',
          { region: 'EU', appToken: 'tok' },
          expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
        );
      });

      it('swallows errors so callers stay best-effort', async () => {
        mockPutCall.mockImplementation(() => { throw new Error('boom'); });
        await expect(saveSourceSession('EU', 'tok')).resolves.toBeUndefined();
      });
    });

    describe('removeSourceSession', () => {
      it('DELETEs the endpoint', async () => {
        mockDeleteCall.mockResolvedValue({ status: 200 });
        await removeSourceSession();
        expect(mockDeleteCall).toHaveBeenCalledWith(
          'v2/user/source-session',
          expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
        );
      });

      it('swallows errors', async () => {
        mockDeleteCall.mockImplementation(() => { throw new Error('boom'); });
        await expect(removeSourceSession()).resolves.toBeUndefined();
      });
    });
  });
});
