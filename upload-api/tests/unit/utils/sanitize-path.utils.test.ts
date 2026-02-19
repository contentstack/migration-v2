import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  sanitizeFilename,
  isValidPathSegment,
  sanitizeId,
  isPathWithinBase,
  getSafePath,
} from '../../../src/utils/sanitize-path.utils';

describe('sanitize-path.utils', () => {
  describe('sanitizeFilename', () => {
    it('should return basename of a safe filename', () => {
      expect(sanitizeFilename('file.txt')).toBe('file.txt');
    });

    it('should strip directory components', () => {
      expect(sanitizeFilename('/path/to/file.txt')).toBe('file.txt');
    });

    it('should remove unsafe characters', () => {
      expect(sanitizeFilename('file@name!.txt')).toBe('filename.txt');
    });

    it('should return empty string for null/undefined', () => {
      expect(sanitizeFilename(null as any)).toBe('');
      expect(sanitizeFilename(undefined as any)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeFilename(123 as any)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should allow spaces, hyphens, underscores, and dots', () => {
      expect(sanitizeFilename('my file_v2.0-final.txt')).toBe('my file_v2.0-final.txt');
    });

    it('should handle path traversal attempts', () => {
      const result = sanitizeFilename('../../../etc/passwd');
      expect(result).toBe('passwd');
    });

    it('should handle filenames with mixed path separators', () => {
      const result = sanitizeFilename('some/path/file.txt');
      expect(result).toBe('file.txt');
    });
  });

  describe('isValidPathSegment', () => {
    it('should return true for alphanumeric strings', () => {
      expect(isValidPathSegment('abc123')).toBe(true);
    });

    it('should allow underscores, hyphens, and dots', () => {
      expect(isValidPathSegment('my-file_v2.0')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidPathSegment('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidPathSegment(null as any)).toBe(false);
      expect(isValidPathSegment(undefined as any)).toBe(false);
    });

    it('should return false for strings with slashes', () => {
      expect(isValidPathSegment('path/to/file')).toBe(false);
    });

    it('should return false for strings with special characters', () => {
      expect(isValidPathSegment('file@name!')).toBe(false);
    });

    it('should return false for strings with spaces', () => {
      expect(isValidPathSegment('has space')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidPathSegment(123 as any)).toBe(false);
    });
  });

  describe('sanitizeId', () => {
    it('should return sanitized string for valid input', () => {
      expect(sanitizeId('blt1234abcd')).toBe('blt1234abcd');
    });

    it('should handle array input by using first element', () => {
      expect(sanitizeId(['id-123', 'id-456'])).toBe('id-123');
    });

    it('should strip directory components', () => {
      expect(sanitizeId('path/to/id')).toBe('id');
    });

    it('should remove special characters', () => {
      expect(sanitizeId('id@special!')).toBe('idspecial');
    });

    it('should return empty string for null/undefined', () => {
      expect(sanitizeId(null as any)).toBe('');
      expect(sanitizeId(undefined as any)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(sanitizeId('')).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(sanitizeId([])).toBe('');
    });

    it('should allow dots, hyphens, and underscores', () => {
      expect(sanitizeId('stack-id_v2.0')).toBe('stack-id_v2.0');
    });
  });

  describe('isPathWithinBase', () => {
    it('should return true when path is within base', () => {
      expect(isPathWithinBase('/tmp/base/file.txt', '/tmp/base')).toBe(true);
    });

    it('should return true for nested paths', () => {
      expect(isPathWithinBase('/tmp/base/sub/dir/file.txt', '/tmp/base')).toBe(true);
    });

    it('should return false for path traversal', () => {
      expect(isPathWithinBase('/tmp/base/../other/file.txt', '/tmp/base')).toBe(false);
    });

    it('should return false for paths outside base', () => {
      expect(isPathWithinBase('/other/path/file.txt', '/tmp/base')).toBe(false);
    });

    it('should return true when path equals base', () => {
      expect(isPathWithinBase('/tmp/base', '/tmp/base')).toBe(true);
    });
  });

  describe('getSafePath', () => {
    it('should return an absolute path', () => {
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

    it('should handle relative paths with baseDir', () => {
      const result = getSafePath('subdir/file.log', '/tmp/logs');
      expect(result).toContain('file.log');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should return default.log on empty input with baseDir', () => {
      const result = getSafePath('', '/tmp/logs');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should return default.log when path is outside baseDir', () => {
      const result = getSafePath('/outside/path.log', '/tmp/logs');
      expect(result).toContain('default.log');
    });
  });
});
