import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  marketplace: vi.fn(),
};

vi.mock('@contentstack/marketplace-sdk', () => ({
  default: {
    client: vi.fn(() => mockClient),
  },
}));

vi.mock('../../../src/constants/index.js', () => ({
  DEVURLS: {
    NA: 'developerhub-api.contentstack.com',
    EU: 'eu-developerhub-api.contentstack.com',
  },
}));

import contentstack from '@contentstack/marketplace-sdk';
import {
  getAllApps,
  getAppManifestAndAppConfig,
} from '../../../src/utils/market-app.utils.js';

describe('market-app.utils', () => {
  const originalConsoleInfo = console.info;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.marketplace.mockReturnValue({
      findAllApps: vi.fn(),
      app: vi.fn(),
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
      expect(contentstack.client).toHaveBeenCalledWith({
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

      expect(contentstack.client).toHaveBeenCalledWith({
        authtoken: 'token',
        host: 'eu-developerhub-api.contentstack.com',
      });
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
  });
});
