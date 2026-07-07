import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockExtractLocale, mockExtractTaxonomy, mockCreateInitialMapper, mockExtractAssets } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockExtractLocale: vi.fn().mockResolvedValue(new Set()),
  mockExtractTaxonomy: vi.fn().mockResolvedValue(undefined),
  mockCreateInitialMapper: vi.fn().mockResolvedValue({ contentTypes: [] }),
  mockExtractAssets: vi.fn().mockResolvedValue([]),
}));

// Mock the connector explicitly (the service imports from 'migration-drupal').
vi.mock('migration-drupal', () => ({
  extractLocale: mockExtractLocale,
  extractTaxonomy: mockExtractTaxonomy,
  createInitialMapper: mockCreateInitialMapper,
  extractAssets: mockExtractAssets,
}));
vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false), promises: { readFile: vi.fn() } },
  existsSync: vi.fn().mockReturnValue(false),
  promises: { readFile: vi.fn() },
}));

import createDrupalMapper from '../../../src/services/drupal/index';
const extractAssets = mockExtractAssets;

describe('createDrupalMapper', () => {
  const config: any = {
    mysql: { host: 'localhost', user: 'root', password: 'pw', database: 'drupal' },
    assetsConfig: { base_url: 'http://test.com', public_path: '/files' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createDrupalMapper).toBe('function');
  });

  it('should handle errors gracefully when extraction fails', async () => {
    await expect(
      createDrupalMapper(config, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle missing mysql config gracefully', async () => {
    const badConfig: any = { mysql: {} };
    await expect(
      createDrupalMapper(badConfig, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle null config values', async () => {
    const nullConfig: any = { mysql: null };
    await expect(
      createDrupalMapper(nullConfig, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle API error response', async () => {
    mockAxiosRequest.mockRejectedValue({ response: { data: 'API Error' } });
    await expect(
      createDrupalMapper(config, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('sends the extracted assetMapping in the createDummyData payload', async () => {
    const assetRows = [
      { id: '5', otherCmsAssetUid: '5', filename: 'a.jpg', title: 'a.jpg', file_size: '10', assetPath: '2023', isUpdate: false },
    ];
    (extractAssets as any).mockResolvedValueOnce(assetRows);
    // localeMapper POST first, createDummyData POST second.
    mockAxiosRequest
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } });

    await createDrupalMapper(config, 'proj-1', 'token', 'csm');

    expect(extractAssets).toHaveBeenCalledWith(config);
    const dummyDataCall = mockAxiosRequest.mock.calls.find(
      ([req]) => typeof req?.url === 'string' && req.url.includes('createDummyData')
    );
    expect(dummyDataCall).toBeTruthy();
    const payload = JSON.parse((dummyDataCall as any[])[0].data as string);
    expect(payload.assetMapping).toEqual(assetRows);
  });
});
