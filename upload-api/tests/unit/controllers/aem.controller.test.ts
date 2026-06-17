import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockContentTypes, mockLocales } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockContentTypes: vi.fn(),
  mockLocales: vi.fn(),
}));

vi.mock('migration-aem', () => ({
  contentTypes: mockContentTypes,
  locales: mockLocales,
  validator: vi.fn(),
  extractEntries: vi.fn().mockResolvedValue(undefined),
  extractAssets: vi.fn().mockResolvedValue([]),
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { createAemMapper } from '../../../src/controllers/aem/index';

describe('createAemMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create AEM mapper and send to API', async () => {
    const mockConvertAndCreate = vi.fn().mockResolvedValue([{ uid: 'page' }]);
    const mockProcessAndSave = vi.fn().mockResolvedValue(['en-US']);
    mockContentTypes.mockReturnValue({ convertAndCreate: mockConvertAndCreate });
    mockLocales.mockReturnValue({ processAndSave: mockProcessAndSave });
    mockAxiosRequest
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ data: { data: { content_mapper: [1] } } });

    await createAemMapper('/path/to/aem', 'proj-1', 'token', 'csm');

    expect(mockContentTypes).toHaveBeenCalled();
    expect(mockLocales).toHaveBeenCalled();
    expect(mockAxiosRequest).toHaveBeenCalledTimes(2);
  });

  it('should handle error gracefully', async () => {
    mockContentTypes.mockImplementation(() => { throw new Error('AEM error'); });
    await expect(createAemMapper('/path', 'proj-1', 'token', 'csm')).resolves.toBeUndefined();
  });

  it('should handle API send failure', async () => {
    const mockConvertAndCreate = vi.fn().mockResolvedValue([]);
    const mockProcessAndSave = vi.fn().mockResolvedValue([]);
    mockContentTypes.mockReturnValue({ convertAndCreate: mockConvertAndCreate });
    mockLocales.mockReturnValue({ processAndSave: mockProcessAndSave });
    mockAxiosRequest.mockRejectedValue(new Error('Network error'));

    await expect(createAemMapper('/path', 'proj-1', 'token')).resolves.toBeUndefined();
  }, 30000);
});
