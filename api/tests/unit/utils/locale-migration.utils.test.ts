import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProjectRead, mockProjectUpdate } = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockProjectUpdate: vi.fn(),
}));

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    update: mockProjectUpdate,
  },
}));

import {
  getAllMappedLocales,
  getSourceLocaleForDestination,
  getMigratedLocales,
  isFullMigrationForLocale,
  recordMigratedLocales,
  extractLocalesFromUpdateConfig,
} from '../../../src/utils/locale-migration.utils';

describe('locale-migration.utils', () => {
  describe('getAllMappedLocales', () => {
    it('returns master + additional locale keys', () => {
      const result = getAllMappedLocales({
        master_locale: { 'en-us': 'en-US' },
        locales: { 'en-in': 'en-IN', 'fr-fr': 'fr-FR' },
      });
      expect(result).toEqual(expect.arrayContaining(['en-us', 'en-in', 'fr-fr']));
      expect(result).toHaveLength(3);
    });

    it('dedupes overlap between master and additional', () => {
      expect(
        getAllMappedLocales({
          master_locale: { 'en-us': 'en' },
          locales: { 'en-us': 'en', 'fr-fr': 'fr' },
        }),
      ).toEqual(['en-us', 'fr-fr']);
    });

    it('returns [] when no locales configured', () => {
      expect(getAllMappedLocales({})).toEqual([]);
      expect(getAllMappedLocales(null as any)).toEqual([]);
    });
  });

  describe('getSourceLocaleForDestination', () => {
    const project = {
      master_locale: { 'en-us': 'en-US' },
      locales: { 'en-in': 'en-IN' },
    };

    it('returns master source for master dest locale', () => {
      expect(getSourceLocaleForDestination(project, 'en-us')).toBe('en-US');
    });

    it('returns additional source for additional dest locale', () => {
      expect(getSourceLocaleForDestination(project, 'en-in')).toBe('en-IN');
    });

    it('returns null when dest locale not mapped', () => {
      expect(getSourceLocaleForDestination(project, 'fr-fr')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(getSourceLocaleForDestination(project, '')).toBeNull();
      expect(getSourceLocaleForDestination({}, 'en-us')).toBeNull();
    });
  });

  describe('getMigratedLocales', () => {
    it('returns the explicit array when present', () => {
      expect(
        getMigratedLocales({ migrated_locales: ['en-us', 'en-in'] }),
      ).toEqual(['en-us', 'en-in']);
    });

    it('returns [] on iteration 1 with no record', () => {
      expect(
        getMigratedLocales({
          iteration: 1,
          master_locale: { 'en-us': 'en' },
        }),
      ).toEqual([]);
    });

    it('lazy-backfills to all mapped locales for restart projects missing the field', () => {
      const result = getMigratedLocales({
        iteration: 2,
        master_locale: { 'en-us': 'en' },
        locales: { 'fr-fr': 'fr' },
      });
      expect(result).toEqual(expect.arrayContaining(['en-us', 'fr-fr']));
    });
  });

  describe('isFullMigrationForLocale', () => {
    it('returns true on first iteration regardless of state', () => {
      expect(
        isFullMigrationForLocale(
          { iteration: 1, migrated_locales: ['en-us'] },
          'en-us',
        ),
      ).toBe(true);
    });

    it('returns false on restart when locale was previously migrated', () => {
      expect(
        isFullMigrationForLocale(
          { iteration: 2, migrated_locales: ['en-us', 'en-in'] },
          'en-us',
        ),
      ).toBe(false);
    });

    it('returns true on restart for a newly-added locale', () => {
      expect(
        isFullMigrationForLocale(
          { iteration: 2, migrated_locales: ['en-us'] },
          'fr-fr',
        ),
      ).toBe(true);
    });

    it('returns false on restart with lazy-backfilled migrated_locales', () => {
      // No migrated_locales explicitly recorded, but iteration > 1 → backfill
      // implies all currently-mapped locales were migrated.
      expect(
        isFullMigrationForLocale(
          {
            iteration: 2,
            master_locale: { 'en-us': 'en' },
            locales: { 'en-in': 'en-IN' },
          },
          'en-in',
        ),
      ).toBe(false);
    });
  });

  describe('recordMigratedLocales', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockProjectRead.mockResolvedValue(undefined);
    });

    it('skips work when locales array is empty', async () => {
      await recordMigratedLocales('p1', []);
      expect(mockProjectRead).not.toHaveBeenCalled();
      expect(mockProjectUpdate).not.toHaveBeenCalled();
    });

    it('set-unions into the matching project record', async () => {
      const data = {
        projects: [
          { id: 'p1', migrated_locales: ['en-us'] },
          { id: 'p2', migrated_locales: ['en-us', 'en-in'] },
        ],
      };
      mockProjectUpdate.mockImplementation(async (mut: any) => mut(data));
      await recordMigratedLocales('p1', ['en-in', 'en-us']);
      expect(data.projects[0].migrated_locales).toEqual(
        expect.arrayContaining(['en-us', 'en-in']),
      );
      expect(data.projects[0].migrated_locales).toHaveLength(2);
      // Untouched project shouldn't have been written to.
      expect(data.projects[1].migrated_locales).toEqual(['en-us', 'en-in']);
    });

    it('initializes migrated_locales when missing on the project', async () => {
      const data = { projects: [{ id: 'p1' }] };
      mockProjectUpdate.mockImplementation(async (mut: any) => mut(data));
      await recordMigratedLocales('p1', ['en-us']);
      expect((data.projects[0] as any).migrated_locales).toEqual(['en-us']);
    });

    it('no-ops when project id is not found', async () => {
      const data = { projects: [{ id: 'other' }] };
      mockProjectUpdate.mockImplementation(async (mut: any) => mut(data));
      await recordMigratedLocales('missing', ['en-us']);
      expect((data.projects[0] as any).migrated_locales).toBeUndefined();
    });
  });

  // Covers the fix for the "locale marked migrated before it was ever
  // actually processed" bug: runCli.service.ts used to compute the migrated
  // locale set from the project's FULL configured locale list, which
  // permanently skipped any locale configured ahead of when it was meant to
  // be migrated. This helper extracts ONLY the locale(s) an iteration's delta
  // pass actually queued, from updated-entries.json's compound
  // `${csUid}::${localeCode}` keys.
  describe('extractLocalesFromUpdateConfig', () => {
    it('extracts locale codes from compound entry keys across content types', () => {
      const config = {
        article: { 'blt-1::en-in': {}, 'blt-2::en-in': {} },
        author: { 'blt-3::en-in': {} },
      };
      expect(extractLocalesFromUpdateConfig(config)).toEqual(['en-in']);
    });

    it('dedupes locales seen across multiple entries', () => {
      const config = {
        article: { 'blt-1::en-gb': {}, 'blt-2::en-gb': {}, 'blt-3::en-in': {} },
      };
      const result = extractLocalesFromUpdateConfig(config);
      expect(result).toEqual(expect.arrayContaining(['en-gb', 'en-in']));
      expect(result).toHaveLength(2);
    });

    it('ignores bookkeeping keys (__assetMapping__, __entryMapping__, __assetUpdates__)', () => {
      const config = {
        __assetMapping__: { old: {}, new: {} },
        __entryMapping__: { old: {}, new: {} },
        __assetUpdates__: [{ uid: 'a' }],
        article: { 'blt-1::en-gb': {} },
      };
      expect(extractLocalesFromUpdateConfig(config)).toEqual(['en-gb']);
    });

    it('ignores legacy keys with no locale suffix', () => {
      const config = { page: { 'cs-1': { title: 'T' } } };
      expect(extractLocalesFromUpdateConfig(config)).toEqual([]);
    });

    it('returns [] for null, undefined, or non-object input', () => {
      expect(extractLocalesFromUpdateConfig(null)).toEqual([]);
      expect(extractLocalesFromUpdateConfig(undefined)).toEqual([]);
      expect(extractLocalesFromUpdateConfig('not an object' as any)).toEqual([]);
    });

    it('returns [] for an empty config object', () => {
      expect(extractLocalesFromUpdateConfig({})).toEqual([]);
    });

    it('skips content types whose value is not an object', () => {
      const config = { article: null, author: { 'blt-1::en-in': {} } };
      expect(extractLocalesFromUpdateConfig(config)).toEqual(['en-in']);
    });
  });
});
