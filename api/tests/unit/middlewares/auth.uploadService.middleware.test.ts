import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/config/index.js', () => ({
  config: { FILE_UPLOAD_KEY: 'valid-upload-key' },
}));

import { authenticateUploadService } from '../../../src/middlewares/auth.uploadService.middleware.js';

describe('auth.uploadService.middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { get: vi.fn() };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should return 401 when secret_key header is missing', () => {
    req.get.mockReturnValue(undefined);

    authenticateUploadService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized - Please provide a valid key' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when secret_key does not match', () => {
    req.get.mockReturnValue('wrong-key');

    authenticateUploadService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next when secret_key matches', () => {
    req.get.mockReturnValue('valid-upload-key');

    authenticateUploadService(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
