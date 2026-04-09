import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockDeleteFolderSync, mockExtractLocale, mockExtractContentTypes, mockExtractEntries } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockDeleteFolderSync: vi.fn(),
  mockExtractLocale: vi.fn().mockResolvedValue([]),
  mockExtractContentTypes: vi.fn().mockResolvedValue(null),
  mockExtractEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock('migration-wordpress', () => ({
  extractLocale: mockExtractLocale,
  extractContentTypes: mockExtractContentTypes,
  extractEntries: mockExtractEntries,
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
    mockAxiosRequest
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } })
      .mockResolvedValueOnce({ status: 200 });

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});

    expect(mockExtractLocale).toHaveBeenCalledWith('/path');
    expect(mockAxiosRequest).toHaveBeenCalledTimes(2);
    expect(mockDeleteFolderSync).toHaveBeenCalled();
  });

  it('should not send mapper when contentTypeData is falsy', async () => {
    mockExtractLocale.mockResolvedValue([]);
    mockExtractContentTypes.mockResolvedValue(null);

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});
    expect(mockAxiosRequest).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } })
      .mockResolvedValueOnce({ status: 200 });

    await createWordpressMapper('/path', 'proj-1', 'token', 'csm', {});

    const payload = JSON.parse(mockAxiosRequest.mock.calls[0][0].data);
    expect(payload.contentTypes[0].type).toBe('content_type');
    expect(payload.contentTypes[1].type).toBe('content_type');
  });
});
