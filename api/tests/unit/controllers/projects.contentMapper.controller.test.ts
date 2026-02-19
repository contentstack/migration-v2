import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockContentMapperService } = vi.hoisted(() => ({
  mockContentMapperService: {
    putTestData: vi.fn(),
    getContentTypes: vi.fn(),
    getFieldMapping: vi.fn(),
    getExistingContentTypes: vi.fn(),
    getExistingGlobalFields: vi.fn(),
    getExistingTaxonomies: vi.fn(),
    updateContentType: vi.fn(),
    resetToInitialMapping: vi.fn(),
    removeContentMapper: vi.fn(),
    getSingleContentTypes: vi.fn(),
    getSingleGlobalField: vi.fn(),
    updateContentMapper: vi.fn(),
  },
}));

vi.mock('../../../src/services/contentMapper.service.js', () => ({
  contentMapperService: mockContentMapperService,
}));

import { contentMapperController } from '../../../src/controllers/projects.contentMapper.controller.js';

describe('projects.contentMapper.controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: { projectId: 'proj-123' }, body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  const testDelegation = (
    controllerMethod: string,
    serviceMethod: string,
    expectedStatus?: number
  ) => {
    it(`${controllerMethod} should delegate to service`, async () => {
      const serviceResp = { status: 200, data: { ok: true } };
      (mockContentMapperService as any)[serviceMethod].mockResolvedValue(serviceResp);

      await (contentMapperController as any)[controllerMethod](req, res);

      expect((mockContentMapperService as any)[serviceMethod]).toHaveBeenCalledWith(req);
    });
  };

  testDelegation('putTestData', 'putTestData');
  testDelegation('getContentTypes', 'getContentTypes');
  testDelegation('getFieldMapping', 'getFieldMapping');
  testDelegation('putContentTypeFields', 'updateContentType');
  testDelegation('resetContentType', 'resetToInitialMapping');
  testDelegation('removeContentMapper', 'removeContentMapper');
  testDelegation('updateContentMapper', 'updateContentMapper');

  it('getExistingContentTypes should return 201', async () => {
    mockContentMapperService.getExistingContentTypes.mockResolvedValue({ contentTypes: [] });

    await contentMapperController.getExistingContentTypes(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('getExistingGlobalFields should return 201', async () => {
    mockContentMapperService.getExistingGlobalFields.mockResolvedValue({ globalFields: [] });

    await contentMapperController.getExistingGlobalFields(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('getExistingTaxonomies should return status from response or default 200', async () => {
    mockContentMapperService.getExistingTaxonomies.mockResolvedValue({ status: 200, taxonomies: [] });

    await contentMapperController.getExistingTaxonomies(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getSingleContentTypes should return 201', async () => {
    mockContentMapperService.getSingleContentTypes.mockResolvedValue({ title: 'Blog' });

    await contentMapperController.getSingleContentTypes(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('getSingleGlobalField should return 201', async () => {
    mockContentMapperService.getSingleGlobalField.mockResolvedValue({ title: 'SEO' });

    await contentMapperController.getSingleGlobalField(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
