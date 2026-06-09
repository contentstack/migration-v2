import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../../src/config/index.js', () => ({
  config: { APP_TOKEN_KEY: 'test-secret-key' },
}));

import { authenticateUser } from '../../../src/middlewares/auth.middleware.js';

describe('auth.middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      get: vi.fn(),
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should return 401 when app_token header is missing or empty', () => {
    req.get.mockReturnValue(undefined);

    authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized - Token missing' })
    );
    expect(next).not.toHaveBeenCalled();

    vi.clearAllMocks();
    req.get.mockReturnValue('');
    authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when JWT verification fails', () => {
    req.get.mockReturnValue('invalid-token');

    authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized - Invalid token' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and set token_payload on valid token', () => {
    const payload = { region: 'NA', user_id: 'user-123' };
    const token = jwt.sign(payload, 'test-secret-key');
    req.get.mockReturnValue(token);

    authenticateUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.token_payload).toBeDefined();
    expect(req.body.token_payload.region).toBe('NA');
    expect(req.body.token_payload.user_id).toBe('user-123');
  });
});
