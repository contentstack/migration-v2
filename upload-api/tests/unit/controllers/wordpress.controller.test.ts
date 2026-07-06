import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockDeleteFolderSync, mockExtractLocale, mockExtractContentTypes, mockExtractEntries, mockExtractAssets } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockDeleteFolderSync: vi.fn(),
  mockExtractLocale: vi.fn().mockResolvedValue([]),
  mockExtractContentTypes: vi.fn().mockResolvedValue(null),
  // `extractEntries` is called between extractContentTypes and the POST to enrich each
  // content type with its entry list. Default: pass the input through unchanged.
  mockExtractEntries: vi.fn().mockImplementation((_p: string, ct: any) => ct),
  // `extractAssets` builds the assetMapping rows sent with the createDummyData payload.
  mockExtractAssets: vi.fn().mockResolvedValue([]),
}));

vi.mock('migration-wordpress', () => ({
  extractLocale: mockExtractLocale,
  extractContentTypes: mockExtractContentTypes,
  extractEntries: mockExtractEntries,
  extractAssets: mockExtractAssets,
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/helper', () => ({ deleteFolderSync: mockDeleteFolderSync, fileOperationLimiter: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import createWordpressMapper from '../../../src/controllers/wordpress/index';

describe('createWordpressMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract content types and send mapper to API', async () => {
    mockExtractLocale.mockResolvedValue(['en']);
    mockExtractContentTypes.mockResolvedValue([{ uid: 'post', title: 'Post' }]);
    // localeMapper runs first; createDummyData second—order must match controller
    mockAxiosRequest
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } });

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});

    expect(mockExtractLocale).toHaveBeenCalledWith('/path');
    expect(mockAxiosRequest).toHaveBeenCalledTimes(2);
    expect(mockDeleteFolderSync).toHaveBeenCalled();
  });

  it('should only send localeMapper when contentTypeData is falsy', async () => {
    mockExtractLocale.mockResolvedValue([]);
    mockExtractContentTypes.mockResolvedValue(null);

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});
    // Locale mapper is always POSTed; content-type mapper is skipped when extract returns falsy
    expect(mockAxiosRequest).toHaveBeenCalledTimes(1);
    expect(mockAxiosRequest.mock.calls[0][0].url).toContain('localeMapper');
  });

  it('should handle error gracefully', async () => {
    mockExtractLocale.mockRejectedValue(new Error('Extract failed'));
    await expect(createWordpressMapper('/path', 'proj-1', 'token', 'csm', {})).resolves.toBeUndefined();
  });

  it('should handle API error gracefully', async () => {
    mockExtractLocale.mockResolvedValue(['en']);
    mockExtractContentTypes.mockResolvedValue([{ uid: 'page' }]);
    mockAxiosRequest.mockRejectedValue({ response: { data: 'API error' } });
    await expect(createWordpressMapper('/path', 'proj-1', 'token', 'csm', {})).resolves.toBeUndefined();
  });

  it('should set type=content_type on each content type', async () => {
    mockExtractLocale.mockResolvedValue(['en']);
    mockExtractContentTypes.mockResolvedValue([{ uid: 'post' }, { uid: 'page' }]);
    mockAxiosRequest
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } });

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});

    const contentTypeRequest = mockAxiosRequest.mock.calls[1][0];
    expect(contentTypeRequest.url).toContain('createDummyData');
    const payload = JSON.parse(contentTypeRequest.data as string);
    expect(payload.contentTypes[0].type).toBe('content_type');
    expect(payload.contentTypes[1].type).toBe('content_type');
  });
});
