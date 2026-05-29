import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  marketplace: vi.fn(),
};

vi.mock('@contentstack/marketplace-sdk', () => ({
  client: vi.fn(() => mockClient),
}));

vi.mock('../../../src/constants/index.js', () => ({
  DEVURLS: {
    NA: 'developerhub-api.contentstack.com',
    EU: 'eu-developerhub-api.contentstack.com',
  },
}));

import { client as marketplaceClient } from '@contentstack/marketplace-sdk';
import {
  getAllApps,
  getAppManifestAndAppConfig,
  fetchMarketplaceInstallationsForStack,
} from '../../../src/utils/market-app.utils.js';

describe('market-app.utils', () => {
  const originalConsoleInfo = console.info;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.marketplace.mockReturnValue({
      findAllApps: vi.fn(),
      app: vi.fn(),
      installation: vi.fn(() => ({
        fetchAll: vi.fn(),
      })),
    });
  });

  describe('getAllApps', () => {
    it('should return items when findAllApps succeeds', async () => {
      const mockItems = [{ uid: 'app-1' }, { uid: 'app-2' }];
      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn().mockResolvedValue({ items: mockItems }),
      });

      const result = await getAllApps({
        organizationUid: 'org-123',
        authtoken: 'token-xyz',
        region: 'NA',
      });

      expect(result).toEqual(mockItems);
      expect(marketplaceClient).toHaveBeenCalledWith({
        authtoken: 'token-xyz',
        host: 'developerhub-api.contentstack.com',
      });
      expect(mockClient.marketplace).toHaveBeenCalledWith('org-123');
    });

    it('should use EU host when region is EU', async () => {
      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn().mockResolvedValue({ items: [] }),
      });

      await getAllApps({
        organizationUid: 'org-123',
        authtoken: 'token',
        region: 'EU',
      });

      expect(marketplaceClient).toHaveBeenCalledWith({
        authtoken: 'token',
        host: 'eu-developerhub-api.contentstack.com',
      });
    });

    it('routes SSO Bearer tokens to the SDK `authorization` option (not `authtoken`)', async () => {
      // SSO callers historically forward a `Bearer <access_token>` string in
      // the `authtoken` arg. Routing that into the SDK's `authtoken` option
      // puts a Bearer value into the wrong HTTP header and Developer Hub
      // rejects it, which is what caused marketplace-app custom fields to
      // silently disappear from SSO migrations.
      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn().mockResolvedValue({ items: [] }),
      });

      await getAllApps({
        organizationUid: 'org-123',
        authtoken: 'Bearer sso-access-token',
        region: 'NA',
      });

      expect(marketplaceClient).toHaveBeenCalledWith({
        authorization: 'Bearer sso-access-token',
        host: 'developerhub-api.contentstack.com',
      });
      expect(marketplaceClient).not.toHaveBeenCalledWith(
        expect.objectContaining({ authtoken: 'Bearer sso-access-token' }),
      );
    });

    it('should return undefined and log when error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      const result = await getAllApps({
        organizationUid: 'org-123',
        authtoken: 'token',
        region: 'NA',
      });

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getAppManifestAndAppConfig', () => {
    it('should return app data when fetch succeeds', async () => {
      const mockAppData = { uid: 'manifest-1', title: 'Test App' };
      mockClient.marketplace.mockReturnValue({
        app: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(mockAppData),
        }),
      });

      const result = await getAppManifestAndAppConfig({
        organizationUid: 'org-123',
        authtoken: 'token',
        region: 'NA',
        manifestUid: 'manifest-1',
      });

      expect(result).toEqual(mockAppData);
      const appFn = mockClient.marketplace().app;
      expect(appFn).toHaveBeenCalledWith('manifest-1');
    });

    it('should return undefined and log when error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      mockClient.marketplace.mockReturnValue({
        app: vi.fn().mockReturnValue({
          fetch: vi.fn().mockRejectedValue(new Error('Not found')),
        }),
      });

      const result = await getAppManifestAndAppConfig({
        organizationUid: 'org-123',
        authtoken: 'token',
        region: 'NA',
        manifestUid: 'invalid',
      });

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('routes SSO Bearer tokens to the SDK `authorization` option (not `authtoken`)', async () => {
      mockClient.marketplace.mockReturnValue({
        app: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ uid: 'manifest-1' }),
        }),
      });

      await getAppManifestAndAppConfig({
        organizationUid: 'org-123',
        authtoken: 'Bearer sso-access-token',
        region: 'NA',
        manifestUid: 'manifest-1',
      });

      expect(marketplaceClient).toHaveBeenCalledWith({
        authorization: 'Bearer sso-access-token',
        host: 'developerhub-api.contentstack.com',
      });
    });
  });

  describe('fetchMarketplaceInstallationsForStack', () => {
    const baseParams = {
      organizationUid: 'org-456',
      stackUid: 'bltStackKey',
      authtoken: 'auth-token',
      region: 'NA' as const,
    };

    it('aggregates pagination and returns installs for matching stack UID (case-insensitive)', async () => {
      const matching = {
        uid: 'ins-1',
        target: { uid: 'bltstackkey', type: 'stack' },
      };
      const otherStack = {
        uid: 'ins-2',
        target: { uid: 'other', type: 'stack' },
      };
      const wrongType = {
        uid: 'ins-3',
        target: { uid: 'bltStackKey', type: 'organization' },
      };

      let call = 0;
      const fetchAll = vi.fn().mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.resolve({
            items: [...Array.from({ length: 100 }, () => ({ filler: true })), otherStack],
          });
        }
        return Promise.resolve({
          items: [matching, wrongType],
        });
      });

      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn(),
        app: vi.fn(),
        installation: vi.fn(() => ({ fetchAll })),
      });

      const result = await fetchMarketplaceInstallationsForStack(baseParams);

      expect(fetchAll).toHaveBeenCalled();
      expect(result).toEqual([matching]);
    });

    it('routes SSO Bearer tokens to the SDK `authorization` option (not `authtoken`)', async () => {
      const fetchAll = vi.fn().mockResolvedValue({ items: [] });
      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn(),
        app: vi.fn(),
        installation: vi.fn(() => ({ fetchAll })),
      });

      await fetchMarketplaceInstallationsForStack({
        ...baseParams,
        authtoken: 'Bearer sso-access-token',
      });

      expect(marketplaceClient).toHaveBeenCalledWith({
        authorization: 'Bearer sso-access-token',
        host: 'developerhub-api.contentstack.com',
      });
    });

    it('uses fallback fetchAll() when paginated fetchAll rejects', async () => {
      const item = {
        uid: 'ins-fb',
        target: { uid: 'bltStackKey', type: 'stack' },
      };

      const fetchAll = vi
        .fn()
        .mockRejectedValueOnce(new Error('no pagination'))
        .mockResolvedValueOnce({ items: [item] });

      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn(),
        app: vi.fn(),
        installation: vi.fn(() => ({ fetchAll })),
      });

      const result = await fetchMarketplaceInstallationsForStack(baseParams);

      expect(fetchAll).toHaveBeenCalledTimes(2);
      expect(result).toEqual([item]);
    });

    it('returns [] and logs on outer failure', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const brokenClient = {
        marketplace: vi.fn(() => {
          throw new Error('SDK init failed');
        }),
      };

      vi.mocked(marketplaceClient).mockReturnValueOnce(brokenClient as never);

      const result = await fetchMarketplaceInstallationsForStack(baseParams);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns [] when filter matches nothing', async () => {
      const fetchAll = vi.fn().mockResolvedValue({
        items: [{ target: { uid: 'nope', type: 'stack' } }],
      });

      mockClient.marketplace.mockReturnValue({
        findAllApps: vi.fn(),
        app: vi.fn(),
        installation: vi.fn(() => ({ fetchAll })),
      });

      const result = await fetchMarketplaceInstallationsForStack(baseParams);

      expect(result).toEqual([]);
    });

    it('logs non-Error throws with String(err) in outer catch', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      vi.mocked(marketplaceClient).mockReturnValueOnce({
        marketplace: vi.fn(() => {
          throw 'string err';
        }),
      } as never);

      const result = await fetchMarketplaceInstallationsForStack(baseParams);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in fetchMarketplaceInstallationsForStack:',
        'string err',
      );
      consoleSpy.mockRestore();
    });
  });
});
