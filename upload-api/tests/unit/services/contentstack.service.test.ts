import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockResolveRoot, mockExtractLocales } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockResolveRoot: vi.fn(),
  mockExtractLocales: vi.fn(),
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../src/services/contentstack/locales', () => ({
  resolveContentstackExportRoot: mockResolveRoot,
  extractContentstackLocales: mockExtractLocales,
}));

import createContentstackMapper from '../../../src/services/contentstack/index';

describe('createContentstackMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createContentstackMapper).toBe('function');
  });

  it('should return false when export root cannot be resolved and filePath is empty', async () => {
    mockResolveRoot.mockReturnValue(null);
    const result = await createContentstackMapper('', 'proj-1', 'token');
    expect(result).toBe(false);
    expect(mockExtractLocales).not.toHaveBeenCalled();
  });

  it('should return false when no locales are extracted', async () => {
    mockResolveRoot.mockReturnValue('/export/main');
    mockExtractLocales.mockResolvedValue([]);
    const result = await createContentstackMapper('/export', 'proj-1', 'token');
    expect(result).toBe(false);
    expect(mockAxiosRequest).not.toHaveBeenCalled();
  });

  it('should POST locales and return true on 200 response', async () => {
    mockResolveRoot.mockReturnValue('/export/main');
    mockExtractLocales.mockResolvedValue([
      { label: 'English (en-us)', value: 'en-us', uid: 'u', code: 'en-us', name: 'English' },
    ]);
    mockAxiosRequest.mockResolvedValue({ status: 200 });

    const result = await createContentstackMapper('/export', 'proj-1', 'token');

    expect(result).toBe(true);
    expect(mockAxiosRequest).toHaveBeenCalledTimes(1);
    const call = mockAxiosRequest.mock.calls[0][0];
    expect(call.method).toBe('post');
    expect(call.url).toContain('/v2/migration/localeMapper/proj-1');
    expect(call.headers.app_token).toBe('token');
    expect(call.data.extractPath).toBe('/export/main');
    expect(call.data.locale).toHaveLength(1);
  });

  it('should return false when API responds with non-200 status', async () => {
    mockResolveRoot.mockReturnValue('/export/main');
    mockExtractLocales.mockResolvedValue([
      { label: 'English (en-us)', value: 'en-us', uid: 'u', code: 'en-us', name: 'English' },
    ]);
    mockAxiosRequest.mockResolvedValue({ status: 500 });

    const result = await createContentstackMapper('/export', 'proj-1', 'token');
    expect(result).toBe(false);
  });

  it('should swallow axios errors and return false', async () => {
    mockResolveRoot.mockReturnValue('/export/main');
    mockExtractLocales.mockResolvedValue([
      { label: 'English (en-us)', value: 'en-us', uid: 'u', code: 'en-us', name: 'English' },
    ]);
    mockAxiosRequest.mockRejectedValue({
      message: 'network down',
      response: { data: 'API Error' },
    });

    const result = await createContentstackMapper('/export', 'proj-1', 'token');
    expect(result).toBe(false);
  });

  it('should fall back to filePath when resolveContentstackExportRoot returns null but filePath is set', async () => {
    mockResolveRoot.mockReturnValue(null);
    mockExtractLocales.mockResolvedValue([
      { label: 'English (en-us)', value: 'en-us', uid: 'u', code: 'en-us', name: 'English' },
    ]);
    mockAxiosRequest.mockResolvedValue({ status: 200 });

    const result = await createContentstackMapper('/export', 'proj-1', 'token');

    expect(result).toBe(true);
    const call = mockAxiosRequest.mock.calls[0][0];
    expect(call.data.extractPath).toBe('/export');
  });
});
