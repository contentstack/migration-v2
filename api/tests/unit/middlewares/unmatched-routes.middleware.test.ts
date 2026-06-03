import { describe, it, expect, vi } from 'vitest';
import { unmatchedRoutesMiddleware } from '../../../src/middlewares/unmatched-routes.middleware.js';

describe('unmatched-routes.middleware', () => {
  it('returns 404 JSON payload', () => {
    const req = {} as any;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as any;

    unmatchedRoutesMiddleware(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 404 }),
      })
    );
  });
});
