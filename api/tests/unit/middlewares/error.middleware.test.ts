import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { errorMiddleware } from '../../../src/middlewares/error.middleware.js';
import { AppError, BadRequestError, NotFoundError } from '../../../src/utils/custom-errors.utils.js';

describe('error.middleware', () => {
  const req = {} as any;
  const next = vi.fn();

  const createRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  it('should return statusCode and message for AppError instances', () => {
    const res = createRes();
    const error = new BadRequestError('Invalid input');

    errorMiddleware(error, req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 400, message: 'Invalid input' },
    });
  });

  it('should return 404 for NotFoundError', () => {
    const res = createRes();
    const error = new NotFoundError('Resource not found');

    errorMiddleware(error, req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 404, message: 'Resource not found' },
    });
  });

  it('should return 500 for generic errors', () => {
    const res = createRes();
    const error = new Error('Something broke');

    errorMiddleware(error, req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 500, message: 'Internal Server Error' },
    });
  });

  it('should handle AppError with custom statusCode', () => {
    const res = createRes();
    const error = new AppError(503, 'Service unavailable');

    errorMiddleware(error, req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 503, message: 'Service unavailable' },
    });
  });
});
