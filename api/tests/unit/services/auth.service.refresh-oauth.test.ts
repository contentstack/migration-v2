import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthRead,
  mockAuthUpdate,
  mockChainGet,
  mockFindValue,
  mockExistsSync,
  mockReadFileSync,
  mockAxiosPost,
} = vi.hoisted(() => {
  const mockFindValue = vi.fn();
  const mockChainGet = vi.fn(() => ({
    find: vi.fn().mockReturnValue({ value: mockFindValue }),
  }));
  return {
    mockAuthRead: vi.fn(),
    mockAuthUpdate: vi.fn(),
    mockChainGet,
    mockFindValue,
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockAxiosPost: vi.fn(),
  };
});

vi.mock('axios', () => ({
  default: { post: (...args: unknown[]) => mockAxiosPost(...args) },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/utils/crypto.utils.js', () => ({
  decryptAppConfig: (c: Record<string, unknown>) => c,
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    update: mockAuthUpdate,
    chain: {
      get: mockChainGet,
    },
  },
}));

import { refreshOAuthToken } from '../../../src/services/auth.service.js';

describe('auth.service refreshOAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
    mockAuthUpdate.mockImplementation((fn: (d: { users: unknown[] }) => void) => {
      fn({ users: [{ user_id: 'u1', refresh_token: 'rt', email: 'a@b.com', region: 'NA' }] });
    });
    mockFindValue.mockReturnValue({
      user_id: 'u1',
      refresh_token: 'rt-old',
      email: 'a@b.com',
      region: 'NA',
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        oauthData: {
          client_id: 'cid',
          client_secret: 'sec',
          redirect_uri: 'https://cb',
        },
      })
    );
    mockAxiosPost.mockResolvedValue({
      data: { access_token: 'new-at', refresh_token: 'new-rt' },
    });
  });

  it('throws when user record missing', async () => {
    mockFindValue.mockReturnValue(null);
    await expect(refreshOAuthToken('u1')).rejects.toThrow('User record not found');
  });

  it('throws when refresh_token missing on user', async () => {
    mockFindValue.mockReturnValue({ user_id: 'u1', email: 'a@b.com' });
    await expect(refreshOAuthToken('u1')).rejects.toThrow('No refresh token available');
  });

  it('throws when app.json missing', async () => {
    mockExistsSync.mockReturnValue(false);
    await expect(refreshOAuthToken('u1')).rejects.toThrow('app.json file not found');
  });

  it('throws when OAuth client fields missing', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ oauthData: {} }));
    await expect(refreshOAuthToken('u1')).rejects.toThrow('client_id or client_secret');
  });

  it('posts refresh request and returns new access_token', async () => {
    const token = await refreshOAuthToken('u1');
    expect(token).toBe('new-at');
    expect(mockAxiosPost).toHaveBeenCalled();
    expect(mockAuthUpdate).toHaveBeenCalled();
  });

  it('wraps axios failures with friendly error', async () => {
    mockAxiosPost.mockRejectedValue(new Error('network'));
    await expect(refreshOAuthToken('u1')).rejects.toThrow('Failed to refresh token');
  });
});
