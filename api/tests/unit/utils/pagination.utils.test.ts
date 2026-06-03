import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockSsoRequest } = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockSsoRequest: vi.fn(),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({
  default: mockHttps,
}));

vi.mock('../../../src/utils/sso-request.utils.js', () => ({
  requestWithSsoTokenRefresh: (...args: unknown[]) => mockSsoRequest(...args),
}));

vi.mock('../../../src/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    safePromise: (promise: Promise<any>) =>
      promise.then((res: any) => [null, res]).catch((err: any) => [err]),
  };
});

import fetchAllPaginatedData from '../../../src/utils/pagination.utils.js';

describe('pagination.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSsoRequest.mockResolvedValue([null, { data: { items: [] } }]);
  });

  it('should fetch a single page of data', async () => {
    mockHttps.mockResolvedValue({
      data: { items: [{ id: 1 }, { id: 2 }] },
    });

    const result = await fetchAllPaginatedData(
      'https://api.example.com/data',
      { Authorization: 'Bearer token' },
      100,
      'testFunc',
      'items'
    );

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockHttps).toHaveBeenCalledTimes(1);
  });

  it('should fetch multiple pages of data', async () => {
    mockHttps
      .mockResolvedValueOnce({
        data: { items: Array.from({ length: 2 }, (_, i) => ({ id: i })) },
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: 2 }] },
      });

    const result = await fetchAllPaginatedData(
      'https://api.example.com/data',
      {},
      2,
      'testFunc',
      'items'
    );

    expect(result).toHaveLength(3);
    expect(mockHttps).toHaveBeenCalledTimes(2);
  });

  it('should throw on API error', async () => {
    const apiError = Object.assign(new Error('API Error'), {
      response: { data: 'Bad Request' },
    });
    mockHttps.mockRejectedValue(apiError);

    await expect(
      fetchAllPaginatedData('https://api.example.com/data', {}, 100, 'testFunc', 'items')
    ).rejects.toThrow('Error in testFunc');
  });

  it('should throw when responseKey is not iterable', async () => {
    mockHttps.mockResolvedValue({
      data: { items: 'not-an-array' },
    });

    await expect(
      fetchAllPaginatedData('https://api.example.com/data', {}, 100, 'testFunc', 'items')
    ).rejects.toThrow('is not iterable');
  });

  it('uses requestWithSsoTokenRefresh when is_sso token payload is passed', async () => {
    mockSsoRequest.mockResolvedValue([null, { data: { items: [{ id: 'a' }] } }]);

    const result = await fetchAllPaginatedData(
      'https://api.example.com/data',
      {},
      100,
      'ssoFunc',
      'items',
      { region: 'NA', user_id: 'u1', is_sso: true }
    );

    expect(mockSsoRequest).toHaveBeenCalled();
    expect(mockHttps).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'a' }]);
  });
});
