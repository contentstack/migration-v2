import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttps, mockRefresh } = vi.hoisted(() => ({
  mockHttps: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
vi.mock('../../../src/services/auth.service.js', () => ({
  refreshOAuthToken: mockRefresh,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('sso-request.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns first [err,res] when request succeeds', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    mockHttps.mockResolvedValueOnce({ status: 200, data: {} });
    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET' }
    );
    expect(out[0]).toBeNull();
    expect(out[1]?.status).toBe(200);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('returns [err,res] when not SSO without refresh', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    mockHttps.mockRejectedValueOnce({ response: { status: 401, data: { error_code: 105 } } });
    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: false },
      { url: 'https://x', method: 'GET' }
    );
    expect(out[0]).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes token and retries on 401 for SSO', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    const err401 = { response: { status: 401, data: { error_code: 105 } } };
    mockHttps.mockRejectedValueOnce(err401).mockResolvedValueOnce({ status: 200, data: { ok: true } });
    mockRefresh.mockResolvedValue('new-access');

    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET', headers: {} }
    );

    expect(mockRefresh).toHaveBeenCalledWith('u1');
    expect(mockHttps).toHaveBeenCalledTimes(2);
    expect(out[1]?.data?.ok).toBe(true);
  });

  it('returns original error when refresh throws', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    const err401 = { response: { status: 401, data: { code: 105 } } };
    mockHttps.mockRejectedValueOnce(err401);
    mockRefresh.mockRejectedValue(new Error('refresh failed'));

    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET' }
    );
    expect(out[0]).toBe(err401);
  });

  it('refreshes on 401 even when error body has no code', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    mockHttps
      .mockRejectedValueOnce({ response: { status: 401, data: {} } })
      .mockResolvedValueOnce({ status: 200, data: { ok: 1 } });
    mockRefresh.mockResolvedValue('tok2');

    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET' }
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(out[1]?.data?.ok).toBe(1);
  });

  it('does not refresh when error is not a token error', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    const err403 = { response: { status: 403, data: {} } };
    mockHttps.mockRejectedValueOnce(err403);
    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET' }
    );
    expect(out[0]).toBe(err403);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes when error_code is 105 even if HTTP status is not 401', async () => {
    const { requestWithSsoTokenRefresh } = await import('../../../src/utils/sso-request.utils.js');
    mockHttps
      .mockRejectedValueOnce({ response: { status: 500, data: { error_code: 105 } } })
      .mockResolvedValueOnce({ status: 200, data: { ok: 2 } });
    mockRefresh.mockResolvedValue('tok3');

    const out = await requestWithSsoTokenRefresh(
      { region: 'NA', user_id: 'u1', is_sso: true },
      { url: 'https://x', method: 'GET' }
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(out[1]?.data?.ok).toBe(2);
  });
});
