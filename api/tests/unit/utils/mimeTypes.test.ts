import { describe, it, expect, vi } from 'vitest';

import {
  EXT_TO_MIME_MAP,
  getMimeTypeFromExtension,
  default as defaultExport,
} from '../../../src/utils/mimeTypes.js';

describe('mimeTypes', () => {
  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME type for known image extensions', () => {
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('png')).toBe('image/png');
      expect(getMimeTypeFromExtension('gif')).toBe('image/gif');
      expect(getMimeTypeFromExtension('webp')).toBe('image/webp');
      expect(getMimeTypeFromExtension('svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME type for video extensions', () => {
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('webm')).toBe('video/webm');
      expect(getMimeTypeFromExtension('mov')).toBe('video/quicktime');
    });

    it('should return correct MIME type for audio extensions', () => {
      expect(getMimeTypeFromExtension('mp3')).toBe('audio/mpeg');
      expect(getMimeTypeFromExtension('wav')).toBe('audio/wav');
    });

    it('should return correct MIME type for document extensions', () => {
      expect(getMimeTypeFromExtension('pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('json')).toBe('application/json');
      expect(getMimeTypeFromExtension('txt')).toBe('text/plain');
    });

    it('should be case-insensitive', () => {
      expect(getMimeTypeFromExtension('JPG')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('PNG')).toBe('image/png');
      expect(getMimeTypeFromExtension('PDF')).toBe('application/pdf');
    });

    it('should return undefined for unknown extension', () => {
      expect(getMimeTypeFromExtension('unknown')).toBeUndefined();
      expect(getMimeTypeFromExtension('xyz')).toBeUndefined();
      expect(getMimeTypeFromExtension('')).toBeUndefined();
    });

    it('should handle empty string', () => {
      expect(getMimeTypeFromExtension('')).toBeUndefined();
    });
  });

  describe('EXT_TO_MIME_MAP', () => {
    it('should export expected MIME type mappings', () => {
      expect(EXT_TO_MIME_MAP).toBeDefined();
      expect(typeof EXT_TO_MIME_MAP).toBe('object');
      expect(Object.keys(EXT_TO_MIME_MAP).length).toBeGreaterThan(0);
    });

    it('should have valid MIME type format for entries', () => {
      for (const [ext, mime] of Object.entries(EXT_TO_MIME_MAP)) {
        expect(typeof ext).toBe('string');
        expect(typeof mime).toBe('string');
        expect(mime).toMatch(/.+\/.+/);
      }
    });
  });

  describe('default export', () => {
    it('should export EXT_TO_MIME_MAP as default', () => {
      expect(defaultExport).toBe(EXT_TO_MIME_MAP);
    });
  });
});
