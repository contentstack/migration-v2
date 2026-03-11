import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/auth.controller.js', () => ({
  authController: {
    login: vi.fn((_req: any, res: any) => res.status(200).json({ ok: true })),
    RequestSms: vi.fn((_req: any, res: any) => res.status(200).json({ ok: true })),
  },
}));

vi.mock('../../../src/validators/index.js', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('auth.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/auth.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register POST /user-session', () => {
    const postRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(postRoutes).toContain('/user-session');
  });

  it('should register POST /request-token-sms', () => {
    const postRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(postRoutes).toContain('/request-token-sms');
  });
});
