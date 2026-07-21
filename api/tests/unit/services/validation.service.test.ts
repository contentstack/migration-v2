import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const { mockExistsSync, mockReaddirSync, mockReadFile } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    promises: { readFile: mockReadFile },
  },
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  promises: { readFile: mockReadFile },
}));

const REQUIRED = [
  'content_types/schema.json',
  'entries',
  'assets',
  'global_fields',
  'locales/locales.json',
];

const buildExistsMap = (existingPaths: Set<string>) => (p: string) =>
  existingPaths.has(p);

describe('validation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveContentstackExportRoot', () => {
    it('returns null when exportPath is empty', async () => {
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot('')).toBeNull();
    });

    it('returns null when exportPath does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot('/missing')).toBeNull();
    });

    it('returns exportPath when all required exist at top level', async () => {
      const base = '/exp';
      const existing = new Set<string>([base, ...REQUIRED.map((r) => path.join(base, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot(base)).toBe(base);
    });

    it('returns nested branch folder (main) when top-level missing required', async () => {
      const base = '/exp';
      const branch = path.join(base, 'main');
      const existing = new Set<string>([base, branch, ...REQUIRED.map((r) => path.join(branch, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReaddirSync.mockReturnValue([
        { name: 'main', isDirectory: () => true },
        { name: 'other', isDirectory: () => true },
        { name: 'afile.txt', isDirectory: () => false },
      ]);
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot(base)).toBe(branch);
    });

    it('returns null when no candidate has required structure', async () => {
      const base = '/exp';
      const existing = new Set<string>([base]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReaddirSync.mockReturnValue([
        { name: 'foo', isDirectory: () => true },
      ]);
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot(base)).toBeNull();
    });

    it('returns null when readdirSync throws', async () => {
      const base = '/exp';
      mockExistsSync.mockImplementation((p: string) => p === base);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('boom');
      });
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot(base)).toBeNull();
    });

    it('iterates non-preferred subdirs in sorted order', async () => {
      const base = '/exp';
      const branch = path.join(base, 'zeta');
      const existing = new Set<string>([base, branch, ...REQUIRED.map((r) => path.join(branch, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReaddirSync.mockReturnValue([
        { name: 'zeta', isDirectory: () => true },
        { name: 'alpha', isDirectory: () => true },
      ]);
      const { resolveContentstackExportRoot } = await import(
        '../../../src/services/validation.service.js'
      );
      expect(resolveContentstackExportRoot(base)).toBe(branch);
    });
  });

  describe('validateExportStructure', () => {
    it('returns invalid with missing paths when no valid root', async () => {
      const base = '/exp';
      mockExistsSync.mockImplementation((p: string) => p === base);
      mockReaddirSync.mockReturnValue([]);
      const { validateExportStructure } = await import(
        '../../../src/services/validation.service.js'
      );
      const result = await validateExportStructure(base);
      expect(result.isValid).toBe(false);
      expect(result.resolvedRoot).toBeNull();
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/Missing/);
    });

    it('returns invalid when schema.json is not an array', async () => {
      const base = '/exp';
      const existing = new Set<string>([base, ...REQUIRED.map((r) => path.join(base, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReadFile.mockResolvedValue('{"not":"array"}');
      const { validateExportStructure } = await import(
        '../../../src/services/validation.service.js'
      );
      const result = await validateExportStructure(base);
      expect(result.isValid).toBe(false);
      expect(result.missing[0]).toMatch(/schema\.json/);
    });

    it('returns valid for a well-formed export', async () => {
      const base = '/exp';
      const existing = new Set<string>([base, ...REQUIRED.map((r) => path.join(base, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReadFile.mockResolvedValue('[{"uid":"ct1"}]');
      const { validateExportStructure } = await import(
        '../../../src/services/validation.service.js'
      );
      const result = await validateExportStructure(base);
      expect(result.isValid).toBe(true);
      expect(result.resolvedRoot).toBe(base);
      expect(result.message).toMatch(/successful/);
    });

    it('treats empty schema file as empty array', async () => {
      const base = '/exp';
      const existing = new Set<string>([base, ...REQUIRED.map((r) => path.join(base, r))]);
      mockExistsSync.mockImplementation(buildExistsMap(existing));
      mockReadFile.mockResolvedValue('');
      const { validateExportStructure } = await import(
        '../../../src/services/validation.service.js'
      );
      const result = await validateExportStructure(base);
      expect(result.isValid).toBe(true);
    });
  });
});
