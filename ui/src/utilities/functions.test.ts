import { describe, it, expect } from 'vitest';
import { getFileExtension } from './functions';

describe('getFileExtension', () => {
  // Regression: SAP SmartEdit declares both "directory" and "impex" as allowed file
  // formats, but the valid-extension allowlist here never included "impex" — so a real
  // .impex file path always fell through to the "no extension found" branch, and the
  // Legacy CMS step's File Format field stayed stuck showing whatever format was already
  // selected (usually "Folder") instead of "ImpEx".
  it('recognizes a .impex path as a valid extension', () => {
    expect(getFileExtension('/Users/qa/export/catalog.impex')).toBe('impex');
  });

  it('is case-insensitive for .impex', () => {
    expect(getFileExtension('/Users/qa/export/catalog.IMPEX')).toBe('impex');
  });

  it('still recognizes the other already-supported extensions', () => {
    expect(getFileExtension('/tmp/export.zip')).toBe('zip');
    expect(getFileExtension('/tmp/export.json')).toBe('json');
    expect(getFileExtension('/tmp/export.xml')).toBe('xml');
    expect(getFileExtension('/tmp/export.pdf')).toBe('pdf');
  });

  it('returns empty string for an unrecognized extension', () => {
    expect(getFileExtension('/tmp/export.docx')).toBe('');
  });

  it('returns empty string for a path with no extension (e.g. a folder)', () => {
    expect(getFileExtension('/Users/qa/export/comprehensive-test-catalog')).toBe('');
  });
});
