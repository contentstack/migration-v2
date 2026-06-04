import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();

vi.mock('@contentstack/cli-utilities', () => ({
  configHandler: {
    set: mockSet,
  },
}));

describe('config-handler.util', () => {
  beforeEach(() => {
    mockSet.mockClear();
  });

  it('setOAuthConfig writes expected keys', async () => {
    const { setOAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    const userData = {
      access_token: 'at',
      refresh_token: 'rt',
      updated_at: '2024-01-01',
      email: 'a@b.com',
      user_id: 'u1',
      organization_uid: 'org1',
    };
    setOAuthConfig(userData);
    expect(mockSet).toHaveBeenCalledWith('oauthAccessToken', 'at');
    expect(mockSet).toHaveBeenCalledWith('oauthRefreshToken', 'rt');
    expect(mockSet).toHaveBeenCalledWith('authorisationType', 'OAUTH');
  });

  it('setOAuthConfig uses created_at when updated_at missing', async () => {
    const { setOAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    setOAuthConfig({
      access_token: 'a',
      refresh_token: 'b',
      created_at: '2023-01-01',
      email: 'e',
      user_id: 'u',
      organization_uid: 'o',
    });
    expect(mockSet).toHaveBeenCalledWith('oauthDateTime', '2023-01-01');
  });

  it('setBasicAuthConfig writes authtoken and BASIC', async () => {
    const { setBasicAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    setBasicAuthConfig({ authtoken: 'tok', email: 'e@e.com' });
    expect(mockSet).toHaveBeenCalledWith('authtoken', 'tok');
    expect(mockSet).toHaveBeenCalledWith('authorisationType', 'BASIC');
  });

  it('setOAuthConfig uses Date when neither updated_at nor created_at is set', async () => {
    const { setOAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    setOAuthConfig({
      access_token: 'a',
      refresh_token: 'b',
      email: 'e',
      user_id: 'u',
      organization_uid: 'o',
    });
    expect(mockSet).toHaveBeenCalledWith('oauthDateTime', expect.any(Date));
  });

  it('setOAuthConfig tolerates empty object', async () => {
    const { setOAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    setOAuthConfig({});
    expect(mockSet).toHaveBeenCalledWith('oauthAccessToken', undefined);
  });

  it('setBasicAuthConfig tolerates empty object', async () => {
    const { setBasicAuthConfig } = await import('../../../src/utils/config-handler.util.js');
    setBasicAuthConfig({});
    expect(mockSet).toHaveBeenCalledWith('authtoken', undefined);
    expect(mockSet).toHaveBeenCalledWith('email', undefined);
  });
});
