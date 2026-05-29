import { describe, it, expect } from 'vitest';
import { sanitizeStackId, getSafePath } from '../../../src/utils/sanitize-path.utils.js';
import path from 'path';

describe('sanitize-path.utils', () => {
  describe('sanitizeStackId', () => {
    it('should return the same string for valid alphanumeric input', () => {
      expect(sanitizeStackId('blt1234abcd')).toBe('blt1234abcd');
    });

    it('should allow dots, hyphens, and underscores', () => {
      expect(sanitizeStackId('stack-id_v2.0')).toBe('stack-id_v2.0');
    });

    it('should return null for null input', () => {
      expect(sanitizeStackId(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeStackId(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeStackId('')).toBeNull();
    });

    it('should return null for path traversal with ../', () => {
      expect(sanitizeStackId('../etc/passwd')).toBeNull();
    });

    it('should return null for backslash path traversal', () => {
      expect(sanitizeStackId('..\\windows\\system32')).toBeNull();
    });

    it('should return null for null bytes', () => {
      expect(sanitizeStackId('valid\0malicious')).toBeNull();
    });

    it('should return null for forward slashes', () => {
      expect(sanitizeStackId('path/to/file')).toBeNull();
    });

    it('should return null for strings longer than 256 characters', () => {
      const longString = 'a'.repeat(257);
      expect(sanitizeStackId(longString)).toBeNull();
    });

    it('should accept strings of exactly 256 characters', () => {
      const maxString = 'a'.repeat(256);
      expect(sanitizeStackId(maxString)).toBe(maxString);
    });

    it('should return null for non-string input', () => {
      expect(sanitizeStackId(123 as any)).toBeNull();
    });

    it('should return null for special characters', () => {
      expect(sanitizeStackId('stack@id!')).toBeNull();
    });
  });

  describe('getSafePath', () => {
    it('should resolve an absolute path', () => {
      const result = getSafePath('/tmp/test.log');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should sanitize the filename', () => {
      const result = getSafePath('/tmp/test@file!.log');
      expect(result).not.toContain('@');
      expect(result).not.toContain('!');
    });

    it('should prevent directory escape when baseDir is provided', () => {
      const result = getSafePath('../../etc/passwd', '/tmp/logs');
      expect(result).toContain('/tmp/logs');
    });

    it('should return default.log on error with baseDir', () => {
      const result = getSafePath('', '/tmp/logs');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should handle relative paths with baseDir', () => {
      const result = getSafePath('subdir/file.log', '/tmp/logs');
      expect(result).toContain('file.log');
      expect(path.isAbsolute(result)).toBe(true);
    });
  });
});
