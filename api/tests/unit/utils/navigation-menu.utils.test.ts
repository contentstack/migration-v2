import { describe, it, expect } from 'vitest';

// Covers the Sitecore navigation denormaliser: the item tree (parentid + sortorder) has no
// children field, so these tests pin the parts that cannot be read off a template definition —
// sibling ordering including the tiebreak, which children become blocks vs references, and that
// depth beyond the generated block schema is dropped loudly rather than silently.

import {
  buildNavigationMenuEntries,
  MAX_BLOCK_DEPTH,
} from '../../../src/utils/navigation-menu.utils.js';

const idCorrector = ({ id }: any) => {
  if (id === null || id === undefined) return id;
  const raw = `${id}`.trim();
  if (!raw) return id;
  return /^\{?[0-9a-fA-F-]{36}\}?$/.test(raw)
    ? raw.replace(/[-{}]/g, '').toLowerCase()
    : raw.toLowerCase();
};

const uidCorrector = ({ uid }: { uid: string }) =>
  (uid ?? '')
    .replace(/[ -]/g, '_')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

/** Build an entriesData bucket in the shape createEntry assembles. */
const bucket = (template: string, items: any[]) => ({
  template,
  locale: {
    en: Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          meta: {
            id: i.id,
            name: i.name,
            key: i.key ?? i.name.toLowerCase(),
            parentid: i.parent,
            sortorder: i.sortorder,
            template,
            language: 'en',
          },
          fields: {
            field: Object.entries(i.fields ?? {}).map(([key, content]) => ({
              $: { key },
              content,
            })),
          },
        },
      ])
    ),
  },
});

const run = (entriesData: any[], contentTypes: any[] = []) =>
  buildNavigationMenuEntries({
    entriesData,
    contentTypes,
    keyMapper: {},
    idCorrector,
    uidCorrector,
    allAssetJSON: {},
    locale: 'en',
  });

const ROOT = 'root';
const MENU = 'menu';

describe('buildNavigationMenuEntries', () => {
  it('produces one entry per root menu, not one per item', async () => {
    const { entries, stats } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [
        { id: MENU, name: 'Main Menu', parent: ROOT, sortorder: '100' },
      ]),
      bucket('navigation element', [
        { id: 'a', name: 'A', parent: MENU, sortorder: '100', fields: { navigationname: 'A' } },
        { id: 'b', name: 'B', parent: MENU, sortorder: '200', fields: { navigationname: 'B' } },
      ]),
    ]);

    expect(Object.keys(entries)).toEqual([MENU]);
    expect(stats.menus).toBe(1);
    expect(stats.menuBlocks).toBe(2);
    expect(entries[MENU].items).toHaveLength(2);
    expect(entries[MENU].items.map((b: any) => b.menu_item.label)).toEqual(['A', 'B']);
  });

  it('breaks tied sortorder by item name, matching Sitecore', async () => {
    // The real package ties heavily — many siblings share sortorder=100 — so without the name
    // tiebreak the order would come from the directory walk and vary between runs.
    const { entries } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [{ id: MENU, name: 'Main Menu', parent: ROOT }]),
      bucket('navigation element', [
        { id: 'z', name: 'Zebra', parent: MENU, sortorder: '100', fields: { navigationname: 'Zebra' } },
        { id: 'm', name: 'Alpha', parent: MENU, sortorder: '100', fields: { navigationname: 'Alpha' } },
      ]),
    ]);

    expect(entries[MENU].items.map((b: any) => b.menu_item.label)).toEqual(['Alpha', 'Zebra']);
  });

  it('negative sortorder sorts before zero', async () => {
    const { entries } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [{ id: MENU, name: 'Main Menu', parent: ROOT }]),
      bucket('navigation element', [
        { id: 'a', name: 'A', parent: MENU, sortorder: '0', fields: { navigationname: 'zero' } },
        { id: 'b', name: 'B', parent: MENU, sortorder: '-200', fields: { navigationname: 'negative' } },
      ]),
    ]);

    expect(entries[MENU].items.map((b: any) => b.menu_item.label)).toEqual(['negative', 'zero']);
  });

  it('nests menu items and stamps the sitecore uid at every level', async () => {
    const { entries, stats } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [
        { id: MENU, name: 'Main Menu', parent: ROOT },
        { id: 'grp', name: 'Group', parent: MENU, sortorder: '100', fields: { navigationname: 'Group' } },
      ]),
      bucket('navigation element', [
        { id: 'leaf', name: 'Leaf', parent: 'grp', sortorder: '100', fields: { navigationname: 'Leaf' } },
      ]),
    ]);

    const group = entries[MENU].items[0].menu_item;
    expect(group.label).toBe('Group');
    expect(group.sitecore_uid).toBe('grp');
    expect(group.items[0].menu_item.label).toBe('Leaf');
    expect(group.items[0].menu_item.sitecore_uid).toBe('leaf');
    expect(stats.menuBlocks).toBe(2);
  });

  it('references non-menu children instead of inlining them, using the mapped content type uid', async () => {
    // FindStoreModal parents 32 label/image items in the real package. They carry their own RTE
    // and image content, so they stay entries and are referenced.
    const result = await buildNavigationMenuEntries({
      entriesData: [
        bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
        bucket('navigation group', [{ id: MENU, name: 'FindStoreModal', parent: ROOT }]),
        bucket('dictionary entry', [
          { id: 'label1', name: 'LoginLabel', parent: MENU, sortorder: '100' },
        ]),
      ],
      contentTypes: [
        { contentstackUid: 'dictionary_entry', otherCmsUid: 'dictionary entry' },
      ],
      keyMapper: { dictionary_entry: 'renamed_dictionary_entry' },
      idCorrector,
      uidCorrector,
      allAssetJSON: {},
      locale: 'en',
    });

    const block = result.entries[MENU].items[0].content_item;
    expect(block.entry).toEqual([
      { uid: 'label1', _content_type_uid: 'renamed_dictionary_entry' },
    ]);
    expect(block.sitecore_uid).toBe('label1');
    expect(result.stats.contentBlocks).toBe(1);
    expect(result.stats.menuBlocks).toBe(0);
  });

  it('skips and logs a non-menu child whose template shipped no content type', async () => {
    const { entries, stats, log } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [{ id: MENU, name: 'Menu', parent: ROOT }]),
      bucket('dictionary entry', [{ id: 'orphan', name: 'Orphan', parent: MENU }]),
    ]);

    expect(entries[MENU].items).toBeUndefined();
    expect(stats.unresolvedContentTypes).toBe(1);
    expect(log.some((l) => l.includes('no content type shipped'))).toBe(true);
  });

  it('drops items below MAX_BLOCK_DEPTH and logs the truncation', async () => {
    // Modular blocks cannot recurse, so the schema is generated to a fixed depth. Anything deeper
    // is lost — the test exists to guarantee it is never lost quietly.
    const groups: any[] = [{ id: MENU, name: 'Menu', parent: ROOT }];
    let parent = MENU;
    for (let d = 1; d <= MAX_BLOCK_DEPTH + 1; d += 1) {
      const id = `d${d}`;
      groups.push({ id, name: `D${d}`, parent, sortorder: '100', fields: { navigationname: `D${d}` } });
      parent = id;
    }

    const { entries, stats, log } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', groups),
    ]);

    expect(stats.truncated).toBe(1);
    expect(log.some((l) => l.includes('MAX_BLOCK_DEPTH'))).toBe(true);

    // Walk to the deepest surviving block and confirm nothing hangs off it.
    let node = entries[MENU].items[0].menu_item;
    let depth = 1;
    while (node.items) {
      node = node.items[0].menu_item;
      depth += 1;
    }
    expect(depth).toBe(MAX_BLOCK_DEPTH);
  });

  it('logs menu keys that yield a url containing whitespace', async () => {
    const { entries, log } = await run([
      bucket('site navigation', [{ id: ROOT, name: 'Site Navigation' }]),
      bucket('navigation group', [
        { id: MENU, name: 'Quick Access Bar', key: 'quick access bar', parent: ROOT },
      ]),
    ]);

    expect(entries[MENU].url).toBe('/quick access bar');
    expect(log.some((l) => l.includes('whitespace'))).toBe(true);
  });

  it('returns nothing and logs when the package has no site navigation root', async () => {
    const { entries, log } = await run([
      bucket('navigation group', [{ id: MENU, name: 'Orphan Menu' }]),
    ]);

    expect(entries).toEqual({});
    expect(log.some((l) => l.includes('site navigation'))).toBe(true);
  });
});
