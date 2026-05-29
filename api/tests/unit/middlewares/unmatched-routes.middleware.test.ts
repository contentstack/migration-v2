import { describe, it, expect, vi } from 'vitest';
import { unmatchedRoutesMiddleware } from '../../../src/middlewares/unmatched-routes.middleware.js';

describe('unmatched-routes.middleware', () => {
  it('should return 404 with route error message', () => {
    const req = {} as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    unmatchedRoutesMiddleware(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 404,
        message: 'Sorry, the requested resource is not available.',
      },
    });
  });
});
