import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/projects.controller.js', () => ({
  projectController: {
    getAllProjects: vi.fn((_req: any, res: any) => res.status(200).json([])),
    getProject: vi.fn((_req: any, res: any) => res.status(200).json({})),
    exportProject: vi.fn((_req: any, res: any) => res.status(200).json({})),
    importProject: vi.fn((_req: any, res: any) => res.status(201).json({})),
    createProject: vi.fn((_req: any, res: any) => res.status(201).json({})),
    updateProject: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateLegacyCMS: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateAffix: vi.fn((_req: any, res: any) => res.status(200).json({})),
    affixConfirmation: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateFileFormat: vi.fn((_req: any, res: any) => res.status(200).json({})),
    fileformatConfirmation: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateDestinationStack: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateCurrentStep: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateSourceConfig: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateAuditSelections: vi.fn((_req: any, res: any) => res.status(200).json({})),
    deleteProject: vi.fn((_req: any, res: any) => res.status(200).json({})),
    revertProject: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateStackDetails: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateMigrationExecution: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getMigratedStacks: vi.fn((_req: any, res: any) => res.status(200).json({})),
  },
}));

vi.mock('../../../src/validators/index.js', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('multer', () => {
  const multer: any = () => ({
    single: () => (_req: any, _res: any, next: any) => next(),
  });
  multer.memoryStorage = () => ({});
  return { default: multer };
});

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('projects.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/projects.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register GET /', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get && layer.route.path === '/')
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should register GET /:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId');
  });

  it('should register POST /', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post && layer.route.path === '/')
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/');
  });

  it('should register PUT /:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put && layer.route.path === '/:projectId')
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId');
  });

  it('should register PUT /:projectId/legacy-cms', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/legacy-cms');
  });

  it('should register PUT /:projectId/affix', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/affix');
  });

  it('should register PUT /:projectId/affix_confirmation', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/affix_confirmation');
  });

  it('should register PUT /:projectId/file-format', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/file-format');
  });

  it('should register PUT /:projectId/fileformat_confirmation', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/fileformat_confirmation');
  });

  it('should register PUT /:projectId/destination-stack', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/destination-stack');
  });

  it('should register PUT /:projectId/current-step', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/current-step');
  });

  it('should register DELETE /:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.delete)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId');
  });

  it('should register PATCH /:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.patch)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId');
  });

  it('should register PATCH /:projectId/stack-details', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.patch)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/stack-details');
  });

  it('should register PUT /:projectId/migration-excution', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/migration-excution');
  });

  it('should register GET /:projectId/get-migrated-stacks', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/get-migrated-stacks');
  });

  it('should register GET /:projectId/export', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/export');
  });

  it('should register POST /import', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post && layer.route.path === '/import')
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/import');
  });
});
