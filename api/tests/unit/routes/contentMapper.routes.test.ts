import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../../src/controllers/projects.contentMapper.controller.js', () => ({
  contentMapperController: {
    putTestData: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getContentTypes: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getFieldMapping: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getExistingContentTypes: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getExistingGlobalFields: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getExistingTaxonomies: vi.fn((_req: any, res: any) => res.status(200).json({})),
    putContentTypeFields: vi.fn((_req: any, res: any) => res.status(200).json({})),
    resetContentType: vi.fn((_req: any, res: any) => res.status(200).json({})),
    removeContentMapper: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateContentMapper: vi.fn((_req: any, res: any) => res.status(200).json({})),
    getEntryMapping: vi.fn((_req: any, res: any) => res.status(200).json({})),
    updateEntryStatus: vi.fn((_req: any, res: any) => res.status(200).json({})),
  },
}));

vi.mock('../../../src/utils/async-router.utils.js', () => ({
  asyncRouter: (fn: any) => fn,
}));

describe('contentMapper.routes', () => {
  let router: any;

  beforeAll(async () => {
    const mod = await import('../../../src/routes/contentMapper.routes.js');
    router = mod.default;
  });

  it('should export an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register POST /createDummyData/:projectId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.post)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/createDummyData/:projectId');
  });

  it('should register GET /contentTypes/:projectId/:skip/:limit/:searchText?', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/contentTypes/:projectId/:skip/:limit/:searchText?');
  });

  it('should register GET /fieldMapping/:projectId/:contentTypeId/:skip/:limit/:searchText?', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/fieldMapping/:projectId/:contentTypeId/:skip/:limit/:searchText?');
  });

  it('should register GET /:projectId/contentTypes/:contentTypeUid?', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/contentTypes/:contentTypeUid?');
  });

  it('should register GET /:projectId/globalFields/:globalFieldUid?', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/globalFields/:globalFieldUid?');
  });

  it('should register GET /:projectId/taxonomies', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:projectId/taxonomies');
  });

  it('should register PUT /contentTypes/:orgId/:projectId/:contentTypeId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/contentTypes/:orgId/:projectId/:contentTypeId');
  });

  it('should register PUT /resetFields/:orgId/:projectId/:contentTypeId', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.put)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/resetFields/:orgId/:projectId/:contentTypeId');
  });

  it('should register GET /:orgId/:projectId/content-mapper', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:orgId/:projectId/content-mapper');
  });

  it('should register PATCH /:orgId/:projectId/mapper_keys', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route?.methods?.patch)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain('/:orgId/:projectId/mapper_keys');
  });
});
