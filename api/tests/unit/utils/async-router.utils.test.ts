import { describe, it, expect, vi } from 'vitest';
import { asyncRouter } from '../../../src/utils/async-router.utils.js';

describe('async-router.utils', () => {
  const mockReq = {} as any;
  const mockRes = {} as any;
  const mockNext = vi.fn();

  it('should call the wrapped function with req, res, next', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncRouter(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should catch rejected promises and pass error to next', async () => {
    const error = new Error('Async failure');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncRouter(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should not call next on success if handler does not call it', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn();
    const wrapped = asyncRouter(handler);

    await wrapped(mockReq, mockRes, next);

    expect(next).not.toHaveBeenCalled();
  });
});
