import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockMkdir, mockWriteFile, mockExistsSync, mockReaddirSync,
  mockLstatSync, mockUnlinkSync, mockRmdirSync, mockParseStringPromise, mockReadFile,
} = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockLstatSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockRmdirSync: vi.fn(),
  mockParseStringPromise: vi.fn().mockResolvedValue({ rss: { channel: { item: [] } } }),
}));

vi.mock('../../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: (...a: any[]) => mockExistsSync(...a),
    readdirSync: (...a: any[]) => mockReaddirSync(...a),
    lstatSync: (...a: any[]) => mockLstatSync(...a),
    unlinkSync: (...a: any[]) => mockUnlinkSync(...a),
    rmdirSync: (...a: any[]) => mockRmdirSync(...a),
    promises: {
      mkdir: (...a: any[]) => mockMkdir(...a),
      writeFile: (...a: any[]) => mockWriteFile(...a),
      readFile: (...a: any[]) => mockReadFile(...a),
    },
  },
  existsSync: (...a: any[]) => mockExistsSync(...a),
  readdirSync: (...a: any[]) => mockReaddirSync(...a),
  lstatSync: (...a: any[]) => mockLstatSync(...a),
  unlinkSync: (...a: any[]) => mockUnlinkSync(...a),
  rmdirSync: (...a: any[]) => mockRmdirSync(...a),
  promises: {
    mkdir: (...a: any[]) => mockMkdir(...a),
    writeFile: (...a: any[]) => mockWriteFile(...a),
    readFile: (...a: any[]) => mockReadFile(...a),
  },
}));

vi.mock('xml2js', () => ({
  default: {
    Parser: class MockParser { parseStringPromise = mockParseStringPromise; },
  },
}));

vi.mock('jszip', () => {
  const Cls = vi.fn().mockImplementation(function (this: any) {
    this.files = {};
    this.loadAsync = vi.fn().mockResolvedValue({ files: {} });
  });
  return { default: Cls, __esModule: true };
});

import logger from '../../../src/utils/logger';
import {
  getFileName,
  saveJson,
  parseXmlToJson,
  deleteFolderSync,
  saveZip,
  updateConfigFile,
  filterMediaDocsToReferenced,
} from '../../../src/helper/index';

describe('helper/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseStringPromise.mockResolvedValue({ rss: { channel: { item: [] } } });
    mockReadFile.mockResolvedValue(JSON.stringify({ localPath: '/tmp/old', mode: 'test' }));
  });

  describe('getFileName', () => {
    it('should extract filename and extension from S3 key', () => {
      const result = (getFileName as any)({ Key: 'folder/subfolder/test.zip' });
      expect(result.fileName).toBe('test.zip');
      expect(result.fileExt).toBe('zip');
    });

    it('should handle keys without slashes', () => {
      const result = (getFileName as any)({ Key: 'myfile.xml' });
      expect(result.fileName).toBe('myfile.xml');
      expect(result.fileExt).toBe('xml');
    });

    it('should handle keys with multiple dots', () => {
      const result = (getFileName as any)({ Key: 'path/file.v2.tar.gz' });
      expect(result.fileName).toBe('file.v2.tar.gz');
      expect(result.fileExt).toBe('gz');
    });

    it('should handle empty Key', () => {
      const result = (getFileName as any)({ Key: '' });
      expect(result.fileName).toBe('');
    });
  });

  describe('saveJson', () => {
    it('should save JSON content to file', async () => {
      const result = await saveJson('{"key":"value"}', 'test.json');
      expect(result).toBe(true);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should stringify object content', async () => {
      const result = await saveJson({ key: 'value' } as any, 'test.json');
      expect(result).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String), JSON.stringify({ key: 'value' }, null, 4), 'utf8'
      );
    });

    it('should handle falsy content with empty JSON fallback', async () => {
      const result = await saveJson('' as any, 'test.json');
      expect(result).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), '{}', 'utf8');
    });

    it('should return false on write error', async () => {
      mockMkdir.mockRejectedValueOnce(new Error('write fail'));
      const result = await saveJson('data', 'test.json');
      expect(result).toBe(false);
    });
  });

  describe('parseXmlToJson', () => {
    it('should parse valid XML to JSON', async () => {
      const result = await parseXmlToJson('<rss><channel><item></item></channel></rss>');
      expect(result).toEqual({ rss: { channel: { item: [] } } });
    });

    it('should strip XML comments before parsing', async () => {
      const result = await parseXmlToJson('<!-- comment --><rss/>');
      expect(result).toBeDefined();
    });

    it('should strip DOCTYPE before parsing', async () => {
      const result = await parseXmlToJson('<!DOCTYPE rss><rss/>');
      expect(result).toBeDefined();
    });

    it('should return false when parsing fails', async () => {
      mockParseStringPromise.mockRejectedValueOnce(new Error('parse error'));
      const result = await parseXmlToJson('bad');
      expect(result).toBe(false);
    });
  });

  describe('filterMediaDocsToReferenced', () => {
    const doc = (items: any[]) => ({ rss: { channel: { item: items } } });
    const attachment = (id: string, url: string) => ({
      'wp:post_id': id,
      'wp:post_type': 'attachment',
      'wp:attachment_url': url,
    });

    it('keeps only media attachments referenced by structured postmeta, drops the rest', () => {
      const content = doc([
        {
          'wp:post_id': '900',
          'wp:post_type': 'case_study',
          'wp:postmeta': [
            { 'wp:meta_key': 'customer_logo', 'wp:meta_value': '12423' },
            { 'wp:meta_key': '_thumbnail_id', 'wp:meta_value': '555' },
            { 'wp:meta_key': 'case_study_content', 'wp:meta_value': '5' }, // numeric but NOT a reference key
          ],
        },
      ]);
      const media = doc([
        attachment('12423', 'https://x/logo.png'),
        attachment('555', 'https://x/hero.jpg'),
        attachment('5', 'https://x/unrelated.jpg'), // matches a counter value, but key wasn't a ref key
        attachment('99999', 'https://x/unreferenced.jpg'),
      ]);
      const { docs, kept, dropped } = filterMediaDocsToReferenced([content], [media]);
      expect(kept).toBe(2);
      expect(dropped).toBe(2);
      const keptIds = docs[0].rss.channel.item.map((i: any) => i['wp:post_id']).sort();
      expect(keptIds).toEqual(['12423', '555']);
    });

    it('returns no docs when nothing is referenced', () => {
      const content = doc([{ 'wp:post_id': '1', 'wp:post_type': 'post', 'wp:postmeta': [] }]);
      const media = doc([attachment('12423', 'https://x/logo.png')]);
      const { docs, kept } = filterMediaDocsToReferenced([content], [media]);
      expect(kept).toBe(0);
      expect(docs).toHaveLength(0);
    });
  });

  describe('deleteFolderSync', () => {
    it('should do nothing if folder does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      deleteFolderSync('/fake/path');
      expect(mockReaddirSync).not.toHaveBeenCalled();
    });

    it('should delete files and folder recursively', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValueOnce(['file1.txt', 'subdir']).mockReturnValueOnce([]);
      mockLstatSync
        .mockReturnValueOnce({ isDirectory: () => false })
        .mockReturnValueOnce({ isDirectory: () => true });

      deleteFolderSync('/test/folder');
      expect(mockUnlinkSync).toHaveBeenCalled();
      expect(mockRmdirSync).toHaveBeenCalled();
    });
  });

  describe('saveZip', () => {
    it('should extract regular files from zip', async () => {
      const zip = {
        files: {
          'folder/file.txt': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('content')) },
        },
      };

      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should skip directory entries', async () => {
      const zip = { files: { 'folder/': { dir: true } } };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should skip __MACOSX files', async () => {
      const zip = {
        files: {
          '__MACOSX/file.txt': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('x')) },
        },
      };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should set filePath for non-sitecore folder files', async () => {
      const zip = {
        files: {
          'customfolder/page.json': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('{}')) },
        },
      };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
      expect(result.filePath).toBe('customfolder');
    });

    it('should not set filePath for sitecore folder files', async () => {
      const zip = {
        files: {
          'items/master/test.json': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('{}')) },
        },
      };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
      expect(result.filePath).toBeUndefined();
    });

    it('should skip filePath for files already under the main folder', async () => {
      const zip = {
        files: {
          'test-project/file.txt': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('x')) },
        },
      };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
    });

    it('should handle nested zip files (non-sitecore)', async () => {
      const zip = {
        files: {
          'nested.zip': { dir: false, async: vi.fn().mockResolvedValue(Buffer.from('zipdata')) },
        },
      };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
    });

    it('should return isSaved false on error', async () => {
      const result = await saveZip(null as any, 'test');
      expect(result.isSaved).toBe(false);
      expect(result.filePath).toBeUndefined();
    });

    it('should handle empty zip files object', async () => {
      const zip = { files: {} };
      const result = await saveZip(zip, 'test-project');
      expect(result.isSaved).toBe(true);
    });
  });

  describe('updateConfigFile', () => {
    it('returns existing config when filePath is empty', async () => {
      const result = await updateConfigFile('');
      expect(result).toEqual({ localPath: '/tmp/old', mode: 'test' });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('updates localPath and writes config when filePath is provided', async () => {
      const result = await updateConfigFile('/tmp/new-path');
      expect(result).toBeDefined();
      expect(result.localPath).toBe('/tmp/new-path');
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('src/config/index.json'),
        expect.stringContaining('"localPath": "/tmp/new-path"'),
        'utf8'
      );
    });

    it('returns undefined when config read fails', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('read fail'));
      const result = await updateConfigFile('/tmp/new-path');
      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Error updating config file',
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });
});
