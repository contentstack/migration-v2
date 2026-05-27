import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const {
  mockExistsSync,
  mockReaddirSync,
  mockReadFileSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

describe('normalize-entry-links.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeLinkFieldsInExport', () => {
    it('returns early when content_types or entries dir is missing', async () => {
      mockExistsSync.mockReturnValue(false);
      const { normalizeLinkFieldsInExport } = await import(
        '../../../src/utils/normalize-entry-links.utils.js'
      );
      normalizeLinkFieldsInExport('/exp');
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('normalizes legacy url -> href in single link, group, multiple link, blocks', async () => {
      const base = '/exp';
      const ctDir = path.join(base, 'content_types');
      const entriesDir = path.join(base, 'entries');
      mockExistsSync.mockReturnValue(true);

      // Schema for content type "ct1"
      const ct = {
        schema: [
          { uid: 'banner', data_type: 'link' },
          { uid: 'links', data_type: 'link', multiple: true },
          {
            uid: 'meta',
            data_type: 'group',
            schema: [{ uid: 'home', data_type: 'link' }],
          },
          {
            uid: 'groups',
            data_type: 'group',
            multiple: true,
            schema: [{ uid: 'g_link', data_type: 'link' }],
          },
          {
            uid: 'modules',
            data_type: 'blocks',
            blocks: [
              {
                uid: 'hero',
                schema: [{ uid: 'cta', data_type: 'link' }],
              },
            ],
          },
          { uid: 'absent', data_type: 'link' },
        ],
      };

      // readdirSync usages (in order called):
      // 1) readdirSync(ctDir) -> file names
      // 2) readdirSync(entriesDir, withFileTypes) -> ct dirs
      // 3) readdirSync(ctEntryDir, withFileTypes) -> locale dirs
      // 4) readdirSync(localeDir) -> entry files
      mockReaddirSync.mockImplementation((dir: string, opts?: any) => {
        if (dir === ctDir) return ['schema.json', 'ct1.json', 'broken.json'];
        if (dir === entriesDir && opts?.withFileTypes) {
          return [
            { name: 'ct1', isDirectory: () => true },
            { name: 'unknown_ct', isDirectory: () => true },
            { name: 'file.json', isDirectory: () => false },
          ];
        }
        if (dir === path.join(entriesDir, 'ct1') && opts?.withFileTypes) {
          return [
            { name: 'en-us', isDirectory: () => true },
            { name: 'not-a-dir', isDirectory: () => false },
          ];
        }
        if (dir === path.join(entriesDir, 'ct1', 'en-us')) {
          return ['en-us-entries.json', 'index.json', 'bad-entries.json'];
        }
        if (dir === path.join(entriesDir, 'unknown_ct') && opts?.withFileTypes) {
          return [];
        }
        return [];
      });

      const entries = {
        e1: {
          banner: { url: 'https://a.com', title: 'A' },
          links: [
            { url: 'https://b.com' },
            { href: 'https://c.com' },
            'not-an-object',
          ],
          meta: { home: { url: 'https://home.com' } },
          groups: [{ g_link: { url: 'https://g.com' } }],
          modules: [
            { hero: { cta: { url: 'https://cta.com' } } },
            { unknown_block: { foo: 1 } },
            { _metadata: {}, hero: { cta: { href: 'already' } } },
          ],
          plainField: 'ignored',
        },
        e2: {
          banner: { href: 'already' }, // no change
        },
      };

      mockReadFileSync.mockImplementation((p: string) => {
        if (p === path.join(ctDir, 'ct1.json')) return JSON.stringify(ct);
        if (p === path.join(ctDir, 'broken.json')) throw new Error('bad json');
        if (p === path.join(entriesDir, 'ct1', 'en-us', 'en-us-entries.json'))
          return JSON.stringify(entries);
        if (p === path.join(entriesDir, 'ct1', 'en-us', 'bad-entries.json'))
          throw new Error('bad entries');
        return '{}';
      });

      const { normalizeLinkFieldsInExport } = await import(
        '../../../src/utils/normalize-entry-links.utils.js'
      );
      normalizeLinkFieldsInExport(base);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [, written] = mockWriteFileSync.mock.calls[0];
      const parsed = JSON.parse(written as string);
      expect(parsed.e1.banner.href).toBe('https://a.com');
      expect(parsed.e1.banner.url).toBeUndefined();
      expect(parsed.e1.links[0].href).toBe('https://b.com');
      expect(parsed.e1.links[1].href).toBe('https://c.com');
      expect(parsed.e1.links[2]).toBe('not-an-object');
      expect(parsed.e1.meta.home.href).toBe('https://home.com');
      expect(parsed.e1.groups[0].g_link.href).toBe('https://g.com');
      expect(parsed.e1.modules[0].hero.cta.href).toBe('https://cta.com');
      // unchanged entry e2 still present
      expect(parsed.e2.banner.href).toBe('already');
    });

    it('skips writing when no modifications occur', async () => {
      const base = '/exp';
      const ctDir = path.join(base, 'content_types');
      const entriesDir = path.join(base, 'entries');
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dir: string, opts?: any) => {
        if (dir === ctDir) return ['ct1.json'];
        if (dir === entriesDir && opts?.withFileTypes)
          return [{ name: 'ct1', isDirectory: () => true }];
        if (dir === path.join(entriesDir, 'ct1') && opts?.withFileTypes)
          return [{ name: 'en-us', isDirectory: () => true }];
        if (dir === path.join(entriesDir, 'ct1', 'en-us'))
          return ['en-us-entries.json'];
        return [];
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === path.join(ctDir, 'ct1.json'))
          return JSON.stringify({ schema: [{ uid: 'b', data_type: 'link' }] });
        return JSON.stringify({ e1: { b: { href: 'ok' } } });
      });
      const { normalizeLinkFieldsInExport } = await import(
        '../../../src/utils/normalize-entry-links.utils.js'
      );
      normalizeLinkFieldsInExport(base);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('handles CT with no schema field gracefully', async () => {
      const base = '/exp';
      const ctDir = path.join(base, 'content_types');
      const entriesDir = path.join(base, 'entries');
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dir: string, opts?: any) => {
        if (dir === ctDir) return ['ct1.json'];
        if (dir === entriesDir && opts?.withFileTypes)
          return [{ name: 'ct1', isDirectory: () => true }];
        if (dir === path.join(entriesDir, 'ct1') && opts?.withFileTypes)
          return [{ name: 'en-us', isDirectory: () => true }];
        if (dir === path.join(entriesDir, 'ct1', 'en-us'))
          return ['en-us-entries.json'];
        return [];
      });
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === path.join(ctDir, 'ct1.json')) return '{}';
        return JSON.stringify({ e1: { x: 1 } });
      });
      const { normalizeLinkFieldsInExport } = await import(
        '../../../src/utils/normalize-entry-links.utils.js'
      );
      normalizeLinkFieldsInExport(base);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});
