import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockExtractLocale, mockExtractContentTypes, mockCreateInitialMapper, mockExtractTaxonomy, mockExtractAssets } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockExtractLocale: vi.fn().mockResolvedValue([]),
  mockExtractContentTypes: vi.fn().mockResolvedValue(undefined),
  mockCreateInitialMapper: vi.fn().mockResolvedValue({ contentTypes: [] }),
  mockExtractTaxonomy: vi.fn().mockResolvedValue(undefined),
  mockExtractAssets: vi.fn().mockReturnValue([]),
}));

// Mock the connector explicitly (the service uses require('migration-contentful')).
vi.mock('migration-contentful', () => ({
  extractLocale: mockExtractLocale,
  extractContentTypes: mockExtractContentTypes,
  createInitialMapper: mockCreateInitialMapper,
  extractTaxonomy: mockExtractTaxonomy,
  extractAssets: mockExtractAssets,
}));
vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import createContentfulMapper from '../../../src/services/contentful/index';
const extractAssets = mockExtractAssets;

describe('createContentfulMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createContentfulMapper).toBe('function');
  });

  it('should handle error gracefully when extractLocale fails', async () => {
    const config: any = { localPath: '/nonexistent/path' };
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle empty localPath', async () => {
    const config: any = { localPath: '' };
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle undefined config values', async () => {
    const config: any = {};
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle API error response', async () => {
    const config: any = { localPath: '/tmp/nonexistent' };
    mockAxiosRequest.mockRejectedValue({ response: { data: 'API Error' } });
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('sends the extracted assetMapping in the createDummyData payload', async () => {
    const config: any = { localPath: '/tmp/export.json' };
    const assetRows = [
      { id: 'a1', otherCmsAssetUid: 'a1', filename: 'a.png', title: 'a', file_size: 1, assetPath: 'https://x/a.png', isUpdate: false },
    ];
    (extractAssets as any).mockReturnValueOnce(assetRows);
    // localeMapper POST first, createDummyData POST second.
    mockAxiosRequest
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } });

    await createContentfulMapper('proj-1', 'token', 'csm', config);

    expect(extractAssets).toHaveBeenCalledWith('/tmp/export.json');
    const dummyDataCall = mockAxiosRequest.mock.calls.find(
      ([req]) => typeof req?.url === 'string' && req.url.includes('createDummyData')
    );
    expect(dummyDataCall).toBeTruthy();
    const payload = JSON.parse((dummyDataCall as any[])[0].data as string);
    expect(payload.assetMapping).toEqual(assetRows);
  });
});
