import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnsureDir = vi.fn();
const mockCopy = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: (...args: any[]) => mockEnsureDir(...args),
    copy: (...args: any[]) => mockCopy(...args),
    existsSync: (...args: any[]) => mockExistsSync(...args),
    promises: {
      readFile: (...args: any[]) => mockReadFile(...args),
      writeFile: (...args: any[]) => mockWriteFile(...args),
    },
  },
}));

const mockMkdirp = vi.fn();
vi.mock('mkdirp', () => ({
  mkdirp: (...args: any[]) => mockMkdirp(...args),
}));

const mockHttps = vi.fn();
vi.mock('../../../src/utils/https.utils.js', () => ({
  default: (...args: any[]) => mockHttps(...args),
}));

vi.mock('../../../src/config/index.js', () => ({
  config: { CS_API: { NA: 'https://api.contentstack.io/v3' } },
}));

describe('utils/index - copyDirectory, createDirectoryAndFile, getAllLocales', () => {
  let copyDirectory: any;
  let createDirectoryAndFile: any;
  let getAllLocales: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/utils/index.js');
    copyDirectory = mod.copyDirectory;
    createDirectoryAndFile = mod.createDirectoryAndFile;
    getAllLocales = mod.getAllLocales;
  });

  describe('copyDirectory', () => {
    it('should copy directory from src to dest', async () => {
      mockEnsureDir.mockResolvedValue(undefined);
      mockCopy.mockResolvedValue(undefined);
      await copyDirectory('/src', '/dest');
      expect(mockEnsureDir).toHaveBeenCalledWith('/dest');
      expect(mockCopy).toHaveBeenCalledWith('/src', '/dest');
    });

    it('should handle errors gracefully', async () => {
      mockEnsureDir.mockRejectedValue(new Error('fail'));
      await copyDirectory('/src', '/dest');
    });
  });

  describe('createDirectoryAndFile', () => {
    it('should create directory and file when file does not exist', async () => {
      mockMkdirp.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockResolvedValue('content');
      mockWriteFile.mockResolvedValue(undefined);
      await createDirectoryAndFile('/dir/file.txt', '/source.txt');
      expect(mockMkdirp).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalledWith('/source.txt', 'utf8');
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should skip file creation when file already exists', async () => {
      mockMkdirp.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      await createDirectoryAndFile('/dir/file.txt', '/source.txt');
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockMkdirp.mockRejectedValue(new Error('fail'));
      await createDirectoryAndFile('/dir/file.txt', '/source.txt');
    });
  });

  describe('getAllLocales', () => {
    it('should return locales on success', async () => {
      mockHttps.mockResolvedValue({ data: { locales: [{ code: 'en-us' }] } });
      const [err, locales] = await getAllLocales();
      expect(err).toBeNull();
      expect(locales).toEqual([{ code: 'en-us' }]);
    });

    it('should return error on failure', async () => {
      mockHttps.mockRejectedValue(new Error('network error'));
      const [err, locales] = await getAllLocales();
      expect(err).toBeDefined();
      expect(locales).toBeUndefined();
    });
  });
});
