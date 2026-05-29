import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUserProfile } = vi.hoisted(() => ({ mockGetUserProfile: vi.fn() }));

vi.mock('../../../src/services/user.service.js', () => ({
  userService: {
    getUserProfile: mockGetUserProfile,
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
});
