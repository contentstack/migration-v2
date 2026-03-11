import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/org.controller.js', () => ({
  orgController: {
    getAllStacks: vi.fn((_req: any, res: any) => res.status(200).json([])),
    createStack: vi.fn((_req: any, res: any) => res.status(201).json({})),
    getLocales: vi.fn((_req: any, res: any) => res.status(200).json([])),
    getStackStatus: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getStackLocale: vi.fn((_req: any, res: any) => res.status(200).json([])),
    getOrgDetails: vi.fn((_req: any, res: any) => res.status(200).json({})),
  },
}));

vi.mock('../../../src/validators/index.js', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('org.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/org.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register GET /stacks/:searchText?', () => {
    const getRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/stacks/:searchText?');
  });

  it('should register POST /stacks', () => {
    const postRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(postRoutes).toContain('/stacks');
  });

  it('should register GET /locales', () => {
    const getRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/locales');
  });

  it('should register POST /stack_status', () => {
    const postRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(postRoutes).toContain('/stack_status');
  });

  it('should register GET /get_stack_locales', () => {
    const getRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/get_stack_locales');
  });

  it('should register GET /get_org_details', () => {
    const getRoutes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/get_org_details');
  });
});
