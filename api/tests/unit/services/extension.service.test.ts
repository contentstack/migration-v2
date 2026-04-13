import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFsPromises,
  mockPathJoin,
} = vi.hoisted(() => ({
  mockFsPromises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
  mockPathJoin: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('fs', () => ({
  default: { promises: mockFsPromises },
}));
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      join: mockPathJoin,
    },
  };
});
vi.mock('../../../src/constants/index.js', () => ({
  MIGRATION_DATA_CONFIG: {
    DATA: './cmsMigrationData',
    EXTENSION_APPS_DIR_NAME: 'extensions',
    EXTENSION_APPS_FILE_NAME: 'extensions.json',
    CUSTOM_MAPPER_FILE_NAME: 'custmon-mapper.json',
  },
  LIST_EXTENSION_UID: 'blt0000000000000000',
}));

vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn(() => '/test/cwd'),
});

import { extensionService } from '../../../src/services/extension.service.js';

describe('extension.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsPromises.access.mockResolvedValue(undefined);
    mockFsPromises.mkdir.mockResolvedValue(undefined);
    mockFsPromises.writeFile.mockResolvedValue(undefined);
    mockFsPromises.readFile.mockResolvedValue(undefined);
    mockPathJoin.mockImplementation((...args: string[]) => args.join('/'));
  });

  describe('createExtension', () => {
    it('should create extension file when custom mapper has LIST_EXTENSION_UID', async () => {
      const customMapperContent = JSON.stringify([
        { extensionUid: 'blt0000000000000000' },
      ]);
      mockFsPromises.readFile.mockResolvedValue(customMapperContent);

      await extensionService.createExtension({
        destinationStackId: 'stack-123',
      });

      expect(mockFsPromises.readFile).toHaveBeenCalled();
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('extensions'),
        expect.stringContaining('blt0000000000000000')
      );
    });

    it('should create extension file with unique extension UIDs only', async () => {
      const customMapperContent = JSON.stringify([
        { extensionUid: 'blt0000000000000000' },
        { extensionUid: 'blt0000000000000000' },
      ]);
      mockFsPromises.readFile.mockResolvedValue(customMapperContent);

      await extensionService.createExtension({
        destinationStackId: 'stack-456',
      });

      expect(mockFsPromises.writeFile).toHaveBeenCalled();
      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      expect(Object.keys(writtenData)).toHaveLength(1);
      expect(writtenData['blt0000000000000000']).toBeDefined();
    });

    it('should create directory when it does not exist', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockFsPromises.readFile.mockResolvedValue(
        JSON.stringify([{ extensionUid: 'blt0000000000000000' }])
      );

      await extensionService.createExtension({
        destinationStackId: 'stack-789',
      });

      expect(mockFsPromises.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should not write file when custom mapper is undefined (file not found)', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));

      await extensionService.createExtension({
        destinationStackId: 'stack-999',
      });

      expect(mockFsPromises.writeFile).not.toHaveBeenCalled();
    });

    it('should skip extensions not matching LIST_EXTENSION_UID', async () => {
      const customMapperContent = JSON.stringify([
        { extensionUid: 'unknown-extension-uid' },
      ]);
      mockFsPromises.readFile.mockResolvedValue(customMapperContent);

      await extensionService.createExtension({
        destinationStackId: 'stack-abc',
      });

      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1]);
        expect(Object.keys(writtenData)).toHaveLength(0);
      }
    });

    it('should handle writeFile error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFsPromises.readFile.mockResolvedValue(
        JSON.stringify([{ extensionUid: 'blt0000000000000000' }])
      );
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'));

      await extensionService.createExtension({
        destinationStackId: 'stack-err',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle mkdir error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockFsPromises.mkdir.mockRejectedValue(new Error('Mkdir failed'));
      mockFsPromises.readFile.mockResolvedValue(
        JSON.stringify([{ extensionUid: 'blt0000000000000000' }])
      );

      await extensionService.createExtension({
        destinationStackId: 'stack-mkdir-err',
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockFsPromises.writeFile).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
