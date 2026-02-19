import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/migration.controller.js', () => ({
  migrationController: {
    startTestMigration: vi.fn((_req: any, res: any) => res.status(200).json({})),
    deleteTestStack: vi.fn((_req: any, res: any) => res.status(200).json({})),
    createTestStack: vi.fn((_req: any, res: any) => res.status(200).json({})),
    startMigration: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getLogs: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getAuditData: vi.fn((_req: any, res: any) => res.status(200).json({})),
    saveLocales: vi.fn((_req: any, res: any) => res.status(200).json({})),
    saveMappedLocales: vi.fn((_req: any, res: any) => res.status(200).json({})),
  },
}));

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('migration.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/migration.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register POST /test-stack/:orgId/:projectId (startTestMigration)', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/test-stack/:orgId/:projectId');
  });

  it('should register POST /test-stack/:projectId (deleteTestStack)', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/test-stack/:projectId');
  });

  it('should register POST /create-test-stack/:orgId/:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/create-test-stack/:orgId/:projectId');
  });

  it('should register POST /start/:orgId/:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/start/:orgId/:projectId');
  });

  it('should register GET /get_migration_logs/...', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain(
      '/get_migration_logs/:orgId/:projectId/:stackId/:skip/:limit/:startIndex/:stopIndex/:searchText/:filter'
    );
  });

  it('should register GET /get_audit_data/...', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain(
      '/get_audit_data/:orgId/:projectId/:stackId/:moduleName/:skip/:limit/:startIndex/:stopIndex/:searchText/:filter'
    );
  });

  it('should register POST /localeMapper/:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/localeMapper/:projectId');
  });

  it('should register POST /updateLocales/:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/updateLocales/:projectId');
  });
});
