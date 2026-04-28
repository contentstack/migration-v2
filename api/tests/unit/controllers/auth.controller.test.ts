import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogin, mockRequestSms, mockSaveOAuthToken } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRequestSms: vi.fn(),
  mockSaveOAuthToken: vi.fn(),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
  authService: {
    login: mockLogin,
    requestSms: mockRequestSms,
    saveOAuthToken: mockSaveOAuthToken,
  },
}));

import { authController } from '../../../src/controllers/auth.controller.js';

describe('auth.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('login', () => {
    it('should return service response status and data on success', async () => {
      mockLogin.mockResolvedValue({ status: 200, data: { app_token: 'token' } });
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ app_token: 'token' });
    });

    it('should return error status and message on service throw', async () => {
      mockLogin.mockRejectedValue({ statusCode: 400, message: 'Invalid credentials' });
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('should default to 500 when error has no statusCode', async () => {
      mockLogin.mockRejectedValue({ message: 'Unknown error' });
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should default to "Login failed" when error has no message', async () => {
      mockLogin.mockRejectedValue({});
      await authController.login(req, res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Login failed' });
    });

    it('should default to 500 when response has no status', async () => {
      mockLogin.mockResolvedValue({ data: { ok: true } });
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('RequestSms', () => {
    it('should return service response on success', async () => {
      mockRequestSms.mockResolvedValue({ status: 200, data: { message: 'SMS sent' } });
      await authController.RequestSms(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'SMS sent' });
    });

    it('should return error on failure', async () => {
      mockRequestSms.mockRejectedValue({ statusCode: 429, message: 'Too many requests' });
      await authController.RequestSms(req, res);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should default to 500 when no statusCode', async () => {
      mockRequestSms.mockRejectedValue({ message: 'Fail' });
      await authController.RequestSms(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('saveOAuthToken', () => {
    it('should send HTML success page when service resolves', async () => {
      mockSaveOAuthToken.mockResolvedValue(undefined);
      req.query = { region: 'NA' };
      await authController.saveOAuthToken(req, res);
      expect(mockSaveOAuthToken).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.type).toHaveBeenCalledWith('html');
      expect(res.send).toHaveBeenCalled();
      const body = (res.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(body).toContain('Successfully Authorized!');
    });

    it('should send HTML error page when service throws', async () => {
      mockSaveOAuthToken.mockRejectedValue({
        statusCode: 400,
        message: 'Missing code',
      });
      req.query = { region: 'NA' };
      await authController.saveOAuthToken(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.type).toHaveBeenCalledWith('html');
      const body = (res.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(body).toContain('Missing code');
    });
  });
});
