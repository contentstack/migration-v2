import { describe, it, expect, vi } from 'vitest';
import { requestHeadersMiddleware } from '../../../src/middlewares/req-headers.middleware.js';

describe('req-headers.middleware', () => {
  const createRes = () => ({
    header: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  it('should set CORS headers on all requests', () => {
    const req = { method: 'GET' } as any;
    const res = createRes();
    const next = vi.fn();

    requestHeadersMiddleware(req, res as any, next);

    expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Origin, Content-Type, Accept, app_token'
    );
  });

  it('should return 200 with empty JSON for OPTIONS requests', () => {
    const req = { method: 'OPTIONS' } as any;
    const res = createRes();
    const next = vi.fn();

    requestHeadersMiddleware(req, res as any, next);

    expect(res.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({});
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next for non-OPTIONS requests', () => {
    const req = { method: 'POST' } as any;
    const res = createRes();
    const next = vi.fn();

    requestHeadersMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
