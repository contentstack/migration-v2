import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/user.controller.js', () => ({
  userController: {
    getUserProfile: vi.fn((_req: any, res: any) => res.status(200).json({ ok: true })),
  },
}));

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('user.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/user.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register GET /profile', () => {
    const getRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/profile');
  });
});
