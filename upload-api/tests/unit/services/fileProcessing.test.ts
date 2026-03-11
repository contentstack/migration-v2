import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockValidator, mockSaveZip, mockSaveJson, mockParseXmlToJson } = vi.hoisted(() => ({
  mockValidator: vi.fn(),
  mockSaveZip: vi.fn(),
  mockSaveJson: vi.fn(),
  mockParseXmlToJson: vi.fn(),
}));

vi.mock('../../../src/validators/index', () => ({ default: mockValidator }));
vi.mock('../../../src/helper/index', () => ({
  saveZip: mockSaveZip,
  saveJson: mockSaveJson,
  parseXmlToJson: mockParseXmlToJson,
  fileOperationLimiter: vi.fn(),
  deleteFolderSync: vi.fn(),
  getFileName: vi.fn(),
}));

vi.mock('../../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/config/index', () => ({
  default: {
    cmsType: 'wordpress',
    mysql: { host: 'localhost', user: 'root', password: 'pw', database: 'db', port: '3306' },
    assetsConfig: { base_url: 'http://test.com', public_path: '/files' },
  },
}));

vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    this.loadAsync = vi.fn().mockResolvedValue(this);
  }),
}));

import handleFileProcessing from '../../../src/services/fileProcessing';

describe('handleFileProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('zip files', () => {
    it('should return OK on valid zip with successful save', async () => {
      mockValidator.mockResolvedValue(true);
      mockSaveZip.mockResolvedValue({ isSaved: true, filePath: 'extracted' });

      const result = await handleFileProcessing('zip', Buffer.from('fake-zip'), 'sitecore', 'test');
      expect(result?.status).toBe(200);
      expect(result?.message).toContain('validated successfully');
      expect(result?.file).toBe('extracted');
    });

    it('should return UNAUTHORIZED on invalid zip', async () => {
      mockValidator.mockResolvedValue(false);

      const result = await handleFileProcessing('zip', Buffer.from('bad-zip'), 'sitecore', 'test');
      expect(result?.status).toBe(401);
      expect(result?.message).toContain('validation failed');
    });

    it('should return undefined when zip is valid but save fails', async () => {
      mockValidator.mockResolvedValue(true);
      mockSaveZip.mockResolvedValue({ isSaved: false });

      const result = await handleFileProcessing('zip', Buffer.from('fake-zip'), 'sitecore', 'test');
      expect(result).toBeUndefined();
    });
  });

  describe('xml files', () => {
    it('should return OK for valid wordpress XML', async () => {
      mockValidator.mockResolvedValue(true);
      mockParseXmlToJson.mockResolvedValue({ rss: {} });
      mockSaveJson.mockResolvedValue(true);

      const result = await handleFileProcessing('xml', Buffer.from('<xml/>'), 'wordpress', 'test');
      expect(result?.status).toBe(200);
    });

    it('should return UNAUTHORIZED when XML save fails', async () => {
      mockValidator.mockResolvedValue(true);
      mockParseXmlToJson.mockResolvedValue({ rss: {} });
      mockSaveJson.mockResolvedValue(false);

      const result = await handleFileProcessing('xml', Buffer.from('<xml/>'), 'wordpress', 'test');
      expect(result?.status).toBe(401);
    });

    it('should return undefined when XML validation fails', async () => {
      mockValidator.mockResolvedValue(false);

      const result = await handleFileProcessing('xml', Buffer.from('<xml/>'), 'wordpress', 'test');
      expect(result).toBeUndefined();
    });

    it('should handle drupal XML', async () => {
      mockValidator.mockResolvedValue(true);
      mockParseXmlToJson.mockResolvedValue({ data: {} });
      mockSaveJson.mockResolvedValue(true);

      const result = await handleFileProcessing('xml', Buffer.from('<xml/>'), 'drupal', 'test');
      expect(result?.status).toBe(200);
    });
  });

  describe('folder', () => {
    it('should return OK for valid folder', async () => {
      mockValidator.mockResolvedValue(true);

      const result = await handleFileProcessing('folder', '/path/to/aem', 'aem', 'aem-folder');
      expect(result?.status).toBe(200);
    });

    it('should return UNAUTHORIZED for invalid folder', async () => {
      mockValidator.mockResolvedValue(false);

      const result = await handleFileProcessing('folder', '/path/to/aem', 'aem', 'aem-folder');
      expect(result?.status).toBe(401);
    });
  });

  describe('sql', () => {
    it('should return OK on valid SQL connection (boolean true)', async () => {
      mockValidator.mockResolvedValue(true);

      const result = await handleFileProcessing('sql', null, 'drupal', 'sql');
      expect(result?.status).toBe(200);
      expect(result?.message).toBe('File validated successfully');
    });

    it('should return OK on valid SQL connection (object { success: true })', async () => {
      mockValidator.mockResolvedValue({ success: true });

      const result = await handleFileProcessing('sql', null, 'drupal', 'sql');
      expect(result?.status).toBe(200);
    });

    it('should return UNAUTHORIZED on failed SQL connection', async () => {
      mockValidator.mockResolvedValue({ success: false, error: 'DB error' });

      const result = await handleFileProcessing('sql', null, 'drupal', 'sql');
      expect(result?.status).toBe(401);
      expect(result?.message).toBe('DB error');
    });

    it('should return SERVER_ERROR on exception', async () => {
      mockValidator.mockRejectedValue(new Error('Connection timeout'));

      const result = await handleFileProcessing('sql', null, 'drupal', 'sql');
      expect(result?.status).toBe(500);
    });
  });

  describe('other file types (json/default)', () => {
    it('should return OK for valid JSON file', async () => {
      mockValidator.mockResolvedValue(true);

      const result = await handleFileProcessing(
        'json',
        Buffer.from('{"contentTypes":[]}'),
        'contentful',
        'test'
      );
      expect(result?.status).toBe(200);
    });

    it('should return UNAUTHORIZED for invalid JSON file', async () => {
      mockValidator.mockResolvedValue(false);

      const result = await handleFileProcessing('json', Buffer.from('bad'), 'contentful', 'test');
      expect(result?.status).toBe(401);
    });

    it('should return UNAUTHORIZED when buffer is null for non-SQL file', async () => {
      const result = await handleFileProcessing('json', null, 'contentful', 'test');
      expect(result?.status).toBe(401);
      expect(result?.message).toBe('File data is missing');
    });
  });
});
