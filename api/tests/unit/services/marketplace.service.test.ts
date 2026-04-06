import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthRead,
  mockGetAppManifestAndAppConfig,
  mockFsPromisesAccess,
  mockFsPromisesMkdir,
  mockFsPromisesWriteFile,
  mockFsPromisesReadFile,
  mockPathJoin,
} = vi.hoisted(() => ({
  mockAuthRead: vi.fn(),
  mockGetAppManifestAndAppConfig: vi.fn(),
  mockFsPromisesAccess: vi.fn(),
  mockFsPromisesMkdir: vi.fn(),
  mockFsPromisesWriteFile: vi.fn(),
  mockFsPromisesReadFile: vi.fn(),
  mockPathJoin: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockAuthRead,
    chain: {
      get: vi.fn(() => ({
        findIndex: vi.fn(() => ({
          value: () => 0,
        })),
      })),
    },
    data: {
      users: [{ user_id: 'user-1', region: 'NA', authtoken: 'cs-auth-token' }],
    },
  },
}));
vi.mock('../../../src/utils/market-app.utils.js', () => ({
  getAppManifestAndAppConfig: mockGetAppManifestAndAppConfig,
}));
vi.mock('fs', () => ({
  default: {
    promises: {
      access: mockFsPromisesAccess,
      mkdir: mockFsPromisesMkdir,
      writeFile: mockFsPromisesWriteFile,
      readFile: mockFsPromisesReadFile,
    },
  },
}));
vi.mock('path', () => ({ default: { join: mockPathJoin } }));
vi.mock('../../../src/constants/index.js', () => ({
  MIGRATION_DATA_CONFIG: {
    DATA: './cmsMigrationData',
    EXTENSIONS_MAPPER_DIR_NAME: 'extension-mapper.json',
    MARKETPLACE_APPS_DIR_NAME: 'marketplace_apps',
    MARKETPLACE_APPS_FILE_NAME: 'marketplace_apps.json',
  },
  KEYTOREMOVE: ['update', 'fetch', 'delete'],
}));

vi.stubGlobal('process', { ...process, cwd: vi.fn(() => '/test/cwd') });

import { marketPlaceAppService } from '../../../src/services/marketplace.service.js';

describe('marketplace.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRead.mockResolvedValue(undefined);
    mockFsPromisesAccess.mockResolvedValue(undefined);
    mockFsPromisesReadFile.mockResolvedValue(
      JSON.stringify([
        { appUid: 'app-1', extensionUid: 'ext-1-field' },
        { appUid: 'app-1', extensionUid: 'ext-2-widget' },
      ])
    );
    mockGetAppManifestAndAppConfig.mockResolvedValue({
      uid: 'app-1',
      name: 'Test App',
      ui_location: {
        locations: [
          { type: 'field', meta: [{ extension_uid: 'ext-1' }] },
          { type: 'widget', meta: [{ extension_uid: 'ext-2' }] },
          { type: 'cs.cm.stack.config', meta: [{}] },
        ],
      },
    });
  });

  describe('createAppManifest', () => {
    it('should create app manifest and write to file', async () => {
      await marketPlaceAppService.createAppManifest({
        destinationStackId: 'stack-123',
        region: 'NA',
        userId: 'user-1',
        orgId: 'org-1',
      });

      expect(mockFsPromisesReadFile).toHaveBeenCalled();
      expect(mockGetAppManifestAndAppConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationUid: 'org-1',
          authtoken: 'cs-auth-token',
          region: 'NA',
          manifestUid: 'app-1',
        })
      );
      expect(mockFsPromisesWriteFile).toHaveBeenCalled();
    });

    it('should create directory when it does not exist', async () => {
      mockFsPromisesAccess.mockRejectedValue(new Error('ENOENT'));

      await marketPlaceAppService.createAppManifest({
        destinationStackId: 'stack-456',
        region: 'NA',
        userId: 'user-2',
        orgId: 'org-2',
      });

      expect(mockFsPromisesMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should not process when extension mapper file is not found', async () => {
      mockFsPromisesReadFile.mockRejectedValue(new Error('ENOENT'));

      await marketPlaceAppService.createAppManifest({
        destinationStackId: 'stack-789',
        region: 'NA',
        userId: 'user-3',
        orgId: 'org-3',
      });

      expect(mockGetAppManifestAndAppConfig).not.toHaveBeenCalled();
      expect(mockFsPromisesWriteFile).not.toHaveBeenCalled();
    });

    it('should remove KEYTOREMOVE keys from manifest data', async () => {
      mockGetAppManifestAndAppConfig.mockResolvedValue({
        uid: 'app-1',
        update: 'should-be-removed',
        fetch: 'should-be-removed',
        ui_location: { locations: [{ type: 'field', meta: [{}] }] },
      });

      await marketPlaceAppService.createAppManifest({
        destinationStackId: 'stack-abc',
        region: 'NA',
        userId: 'user-4',
        orgId: 'org-4',
      });

      const [, writtenData] = mockFsPromisesWriteFile.mock.calls[0];
      const parsed = JSON.parse(writtenData);
      expect(parsed[0]).not.toHaveProperty('update');
      expect(parsed[0]).not.toHaveProperty('fetch');
    });

    it('should handle writeFile error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFsPromisesWriteFile.mockRejectedValue(new Error('Write failed'));

      await marketPlaceAppService.createAppManifest({
        destinationStackId: 'stack-err',
        region: 'NA',
        userId: 'user-5',
        orgId: 'org-5',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
