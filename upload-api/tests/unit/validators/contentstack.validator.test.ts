import { describe, it, expect } from 'vitest';
import contentstackValidator from '../../../src/validators/contentstack';

describe('contentstackValidator', () => {
  describe('zip extension', () => {
    it('should return true when zip contains schema.json and export-info.json', async () => {
      const zip = {
        files: {
          'content_types/schema.json': {},
          'export-info.json': {},
          'entries/blog/en-us/something.json': {},
        },
      };
      const result = await contentstackValidator({ data: zip, extension: 'zip' });
      expect(result).toBe(true);
    });

    it('should return true when nested branch folder contains both required files', async () => {
      const zip = {
        files: {
          'main/content_types/schema.json': {},
          'main/export-info.json': {},
        },
      };
      const result = await contentstackValidator({ data: zip, extension: 'zip' });
      expect(result).toBe(true);
    });

    it('should return false when schema.json is missing', async () => {
      const zip = {
        files: {
          'export-info.json': {},
          'entries/foo.json': {},
        },
      };
      const result = await contentstackValidator({ data: zip, extension: 'zip' });
      expect(result).toBe(false);
    });

    it('should return false when export-info.json is missing', async () => {
      const zip = {
        files: {
          'content_types/schema.json': {},
        },
      };
      const result = await contentstackValidator({ data: zip, extension: 'zip' });
      expect(result).toBe(false);
    });

    it('should return false for an empty zip', async () => {
      const zip = { files: {} };
      const result = await contentstackValidator({ data: zip, extension: 'zip' });
      expect(result).toBe(false);
    });

    it('should handle missing files property safely', async () => {
      const result = await contentstackValidator({ data: {} as any, extension: 'zip' });
      expect(result).toBe(false);
    });
  });

  describe('json extension', () => {
    it('should return true for a valid JSON object string', async () => {
      const result = await contentstackValidator({
        data: JSON.stringify({ foo: 'bar' }),
        extension: 'json',
      });
      expect(result).toBe(true);
    });

    it('should return true for a valid JSON array string', async () => {
      const result = await contentstackValidator({
        data: JSON.stringify([{ a: 1 }]),
        extension: 'json',
      });
      expect(result).toBe(true);
    });

    it('should return true when data is already an object', async () => {
      const result = await contentstackValidator({
        data: { foo: 'bar' },
        extension: 'json',
      });
      expect(result).toBe(true);
    });

    it('should return true when data is already an array', async () => {
      const result = await contentstackValidator({
        data: [1, 2, 3],
        extension: 'json',
      });
      expect(result).toBe(true);
    });

    it('should return false for an invalid JSON string', async () => {
      const result = await contentstackValidator({
        data: 'not-json',
        extension: 'json',
      });
      expect(result).toBe(false);
    });

    it('should return a falsy value for null data', async () => {
      const result = await contentstackValidator({
        data: null,
        extension: 'json',
      });
      expect(result).toBeFalsy();
    });
  });

  describe('unsupported extensions', () => {
    it('should return false for an unknown extension', async () => {
      const result = await contentstackValidator({ data: 'anything', extension: 'xml' });
      expect(result).toBe(false);
    });

    it('should return false for an empty extension', async () => {
      const result = await contentstackValidator({ data: 'anything', extension: '' });
      expect(result).toBe(false);
    });
  });
});
