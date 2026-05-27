import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: fsMock,
  ...fsMock,
}));

import {
  resolveContentstackExportRoot,
  extractContentstackLocales,
} from '../../../src/services/contentstack/locales';

const requiredFiles = [
  'content_types/schema.json',
  'entries',
  'assets',
  'global_fields',
  'locales/locales.json',
];

const allRequiredPresentUnder = (base: string) =>
  new Set(requiredFiles.map((rel) => path.join(base, rel)));

describe('resolveContentstackExportRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when exportPath is empty', () => {
    expect(resolveContentstackExportRoot('')).toBe(null);
  });

  it('should return null when exportPath does not exist', () => {
    fsMock.existsSync.mockReturnValue(false);
    expect(resolveContentstackExportRoot('/nope')).toBe(null);
  });

  it('should return exportPath itself when all required files exist there', () => {
    const root = '/export';
    const present = allRequiredPresentUnder(root);
    fsMock.existsSync.mockImplementation((p: string) => p === root || present.has(p));
    expect(resolveContentstackExportRoot(root)).toBe(root);
  });

  it('should resolve to the "main" branch folder when nested layout is used', () => {
    const root = '/export';
    const branch = path.join(root, 'main');
    const present = allRequiredPresentUnder(branch);
    fsMock.existsSync.mockImplementation((p: string) => p === root || present.has(p));
    fsMock.readdirSync.mockReturnValue([
      { name: 'main', isDirectory: () => true },
      { name: 'master', isDirectory: () => true },
      { name: 'logs', isDirectory: () => true },
    ] as any);
    expect(resolveContentstackExportRoot(root)).toBe(branch);
  });

  it('should fall back to "master" when "main" lacks required files', () => {
    const root = '/export';
    const branch = path.join(root, 'master');
    const present = allRequiredPresentUnder(branch);
    fsMock.existsSync.mockImplementation((p: string) => p === root || present.has(p));
    fsMock.readdirSync.mockReturnValue([
      { name: 'main', isDirectory: () => true },
      { name: 'master', isDirectory: () => true },
    ] as any);
    expect(resolveContentstackExportRoot(root)).toBe(branch);
  });

  it('should fall back to any other directory if no preferred name matches', () => {
    const root = '/export';
    const branch = path.join(root, 'release');
    const present = allRequiredPresentUnder(branch);
    fsMock.existsSync.mockImplementation((p: string) => p === root || present.has(p));
    fsMock.readdirSync.mockReturnValue([
      { name: 'release', isDirectory: () => true },
    ] as any);
    expect(resolveContentstackExportRoot(root)).toBe(branch);
  });

  it('should return null when no branch folder contains required files', () => {
    const root = '/export';
    fsMock.existsSync.mockImplementation((p: string) => p === root);
    fsMock.readdirSync.mockReturnValue([
      { name: 'main', isDirectory: () => true },
    ] as any);
    expect(resolveContentstackExportRoot(root)).toBe(null);
  });

  it('should return null when readdirSync throws', () => {
    const root = '/export';
    fsMock.existsSync.mockImplementation((p: string) => p === root);
    fsMock.readdirSync.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(resolveContentstackExportRoot(root)).toBe(null);
  });
});

describe('extractContentstackLocales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge master-locale and locales.json into a labelled list', async () => {
    fsMock.promises.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          mloc: { uid: 'mloc', code: 'en-us', name: 'English' },
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          fr: { uid: 'fr', code: 'fr-fr', name: 'French' },
        })
      );

    const result = await extractContentstackLocales('/export');
    expect(result).toEqual([
      { label: 'English (en-us)', value: 'en-us', uid: 'mloc', code: 'en-us', name: 'English' },
      { label: 'French (fr-fr)', value: 'fr-fr', uid: 'fr', code: 'fr-fr', name: 'French' },
    ]);
  });

  it('should still return master locales when locales.json is missing', async () => {
    fsMock.promises.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          mloc: { uid: 'mloc', code: 'en-us', name: 'English' },
        })
      )
      .mockRejectedValueOnce(new Error('ENOENT'));

    const result = await extractContentstackLocales('/export');
    expect(result).toEqual([
      { label: 'English (en-us)', value: 'en-us', uid: 'mloc', code: 'en-us', name: 'English' },
    ]);
  });

  it('should return the default en-us locale when master-locale read fails', async () => {
    fsMock.promises.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    const result = await extractContentstackLocales('/export');
    expect(result).toEqual([
      {
        label: 'English - United States (en-us)',
        value: 'en-us',
        uid: 'default',
        code: 'en-us',
        name: 'English - United States',
      },
    ]);
  });

  it('should handle empty master-locale.json gracefully', async () => {
    fsMock.promises.readFile
      .mockResolvedValueOnce('')
      .mockRejectedValueOnce(new Error('ENOENT'));
    const result = await extractContentstackLocales('/export');
    expect(result).toEqual([]);
  });
});
