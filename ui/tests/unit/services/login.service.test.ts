import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPostCall } = vi.hoisted(() => ({
  mockPostCall: vi.fn()
}));

vi.mock('../../../src/services/api/service', () => ({
  postCall: mockPostCall
}));

vi.mock('../../../src/utilities/constants', () => ({
  AUTH_ROUTES: 'v2/auth',
  API_VERSION: 'v2',
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {}
}));

import { userSession, requestSMSToken } from '../../../src/services/api/login.service';

describe('services/api/login.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('userSession', () => {
    it('should call postCall with user-session endpoint and data', async () => {
      const mockResponse = { status: 200, data: { notice: 'Login successful' } };
      mockPostCall.mockResolvedValue(mockResponse);

      const userData = { email: 'test@example.com', password: 'pass123' };
      const result = await userSession(userData);

      expect(mockPostCall).toHaveBeenCalledWith('v2/auth/user-session', userData);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate the response from postCall', async () => {
      const mockResponse = { status: 401, data: { error_message: 'Invalid credentials' } };
      mockPostCall.mockResolvedValue(mockResponse);

      const result = await userSession({ email: 'test@example.com', password: 'wrong' });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('requestSMSToken', () => {
    it('should call postCall with request-token-sms endpoint', async () => {
      const mockResponse = { status: 200, data: { notice: 'SMS sent' } };
      mockPostCall.mockResolvedValue(mockResponse);

      const smsData = { email: 'test@example.com', password: 'pass123', region: 'NA' };
      const result = await requestSMSToken(smsData);

      expect(mockPostCall).toHaveBeenCalledWith('v2/auth/request-token-sms', smsData);
      expect(result).toEqual(mockResponse);
    });

    it('should throw with error message when postCall throws an Error', () => {
      mockPostCall.mockImplementation(() => { throw new Error('Network failure'); });

      expect(() => requestSMSToken({ email: 'a@b.com', password: 'p', region: 'NA' }))
        .toThrow('Error in requestSMSToken: Network failure');
    });

    it('should throw generic message when postCall throws a non-Error', () => {
      mockPostCall.mockImplementation(() => { throw 'something'; });

      expect(() => requestSMSToken({ email: 'a@b.com', password: 'p', region: 'NA' }))
        .toThrow('Unknown error in requestSMSToken');
    });
  });

  describe('userSession - error handling', () => {
    it('should throw with error message when postCall throws an Error', () => {
      mockPostCall.mockImplementation(() => { throw new Error('Connection refused'); });

      expect(() => userSession({ email: 'a@b.com', password: 'p' }))
        .toThrow('Error in userSession: Connection refused');
    });

    it('should throw generic message when postCall throws a non-Error', () => {
      mockPostCall.mockImplementation(() => { throw 42; });

      expect(() => userSession({ email: 'a@b.com', password: 'p' }))
        .toThrow('Unknown error in userSession');
    });
  });
});
