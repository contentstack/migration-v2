import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetUserProfile,
  mockGetSourceSession,
  mockSetSourceSession,
  mockClearSourceSession,
} = vi.hoisted(() => ({
  mockGetUserProfile: vi.fn(),
  mockGetSourceSession: vi.fn(),
  mockSetSourceSession: vi.fn(),
  mockClearSourceSession: vi.fn(),
}));

vi.mock('../../../src/services/user.service.js', () => ({
  userService: {
    getUserProfile: mockGetUserProfile,
    getSourceSession: mockGetSourceSession,
    setSourceSession: mockSetSourceSession,
    clearSourceSession: mockClearSourceSession,
  },
}));

import { userController } from '../../../src/controllers/user.controller.js';

describe('user.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { body: { token_payload: { region: 'NA', user_id: 'user-123' } } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('getUserProfile', () => {
    it('should return resp.status and resp.data from service', async () => {
      mockGetUserProfile.mockResolvedValue({
        status: 200,
        data: { user: { email: 'test@example.com' } },
      });

      await userController.getUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ user: { email: 'test@example.com' } });
    });
  });

  describe('source-session handlers', () => {
    it('getSourceSession forwards service response', async () => {
      mockGetSourceSession.mockResolvedValue({
        status: 200,
        data: { source_session: { region: 'EU', appToken: 't' } },
      });
      await userController.getSourceSession(req, res);
      expect(mockGetSourceSession).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        source_session: { region: 'EU', appToken: 't' },
      });
    });

    it('setSourceSession forwards service response', async () => {
      mockSetSourceSession.mockResolvedValue({
        status: 200,
        data: { source_session: { region: 'EU', appToken: 't' } },
      });
      await userController.setSourceSession(req, res);
      expect(mockSetSourceSession).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('clearSourceSession forwards service response', async () => {
      mockClearSourceSession.mockResolvedValue({
        status: 200,
        data: { source_session: null },
      });
      await userController.clearSourceSession(req, res);
      expect(mockClearSourceSession).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ source_session: null });
    });
  });
});
