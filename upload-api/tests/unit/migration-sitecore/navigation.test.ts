import { describe, it, expect } from 'vitest';

// Covers the mapper half of the Sitecore navigation denormaliser. Sitecore's item tree has no
// children field, so these tests pin what cannot be derived from a template definition: the block
// schema shape and depth, which templates get suppressed, and the entryMapping rows that tell the
// mapping screen how many menus actually ship.
//
// Required directly rather than through the `migration-sitecore` alias — vitest.config.ts points
// that alias at a mock, and the point here is to exercise the real module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nav = require('../../../migration-sitecore/libs/navigation.js');

const {
  buildNavigationMenuFieldMapping,
  buildNavigationMenuEntryMapping,
  navigationReferenceTargets,
  findRootMenus,
  indexNavigation,
  isNavigationMenuContentType,
  isSuppressedNavigationTemplate,
  MAX_BLOCK_DEPTH,
  NAV_MENU_CONTENT_TYPE_UID,
} = nav;

/** An observePackage-shaped itemIndex: keyed by raw uppercase GUID. */
const idx = (items: any[]) =>
  Object.fromEntries(
    items.map((i) => [
      i.guid.toUpperCase(),
      {
        template: i.template,
        templateId: i.templateId ?? `{TID-${i.template}}`,
        parentid: i.parent ?? '',
        sortorder: i.sortorder,
        name: i.name,
        language: i.language ?? 'en',
        version: i.version ?? 1,
        isMedia: i.isMedia ?? false,
      },
    ])
  );

const G = (n: string) => `{${n.padEnd(8, '0')}-0000-0000-0000-000000000000}`;
const ROOT = G('root');
const MENU = G('menu');

describe('buildNavigationMenuFieldMapping', () => {
  it('nests block rows to MAX_BLOCK_DEPTH with no items leaf at the deepest level', () => {
    const uids = buildNavigationMenuFieldMapping(['dictionary_entry']).map(
      (r: any) => r.contentstackFieldUid
    );
    const deepest = 'items' + '.menu_item.items'.repeat(MAX_BLOCK_DEPTH - 1);
    expect(uids).toContain(deepest);
    expect(uids).not.toContain(`${deepest}.menu_item.items`);
  });

  it('offers both block types and carries the reference targets', () => {
    const rows = buildNavigationMenuFieldMapping(['dictionary_entry', 'pageimage']);
    const uids = rows.map((r: any) => r.contentstackFieldUid);
    expect(uids).toContain('items.menu_item');
    expect(uids).toContain('items.content_item');
    expect(
      rows.find((r: any) => r.contentstackFieldUid === 'items.content_item.entry')?.refrenceTo
    ).toEqual(['dictionary_entry', 'pageimage']);
    expect(rows.find((r: any) => r.contentstackFieldUid === 'items')?.multiple).toBe(true);
  });

  it('omits the content_item block when nothing needs referencing', () => {
    const uids = buildNavigationMenuFieldMapping([]).map((r: any) => r.contentstackFieldUid);
    expect(uids).toContain('items.menu_item');
    expect(uids.some((u: string) => u.includes('content_item'))).toBe(false);
  });

  it('does not emit the always-empty css field', () => {
    const uids = buildNavigationMenuFieldMapping([]).map((r: any) => r.contentstackFieldUid);
    expect(uids.some((u: string) => u.endsWith('css'))).toBe(false);
  });

  it('gives every row a stable unique id', () => {
    // putTestData mints uuidv4() for any row without an id, which would change every field's
    // identity on each mapper run and orphan saved mapping-screen edits.
    const a = buildNavigationMenuFieldMapping(['dictionary_entry']);
    const b = buildNavigationMenuFieldMapping(['dictionary_entry']);
    expect(a.every((r: any) => typeof r.id === 'string' && r.id)).toBe(true);
    expect(a.map((r: any) => r.id)).toEqual(b.map((r: any) => r.id));
    expect(new Set(a.map((r: any) => r.id)).size).toBe(a.length);
  });
});

describe('root menu discovery', () => {
  it('takes the nav children of every site navigation container, ordered, ties by name', () => {
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'Site Navigation' },
      { guid: G('b'), template: 'navigation group', name: 'Zebra', parent: ROOT, sortorder: '100' },
      { guid: G('a'), template: 'navigation group', name: 'Alpha', parent: ROOT, sortorder: '100' },
      { guid: G('c'), template: 'navigation group', name: 'Later', parent: ROOT, sortorder: '200' },
      // nested — a block inside a menu, never a menu itself
      { guid: G('d'), template: 'navigation element', name: 'Nested', parent: G('a'), sortorder: '1' },
    ]);
    expect(findRootMenus(indexNavigation(index)).map((m: any) => m.name)).toEqual([
      'Alpha',
      'Zebra',
      'Later',
    ]);
  });

  it('collects menus from more than one container rather than only the first', () => {
    const ROOT2 = G('root2');
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'SN A' },
      { guid: ROOT2, template: 'site navigation', name: 'SN B' },
      { guid: G('a'), template: 'navigation group', name: 'A menu', parent: ROOT },
      { guid: G('b'), template: 'navigation group', name: 'B menu', parent: ROOT2 },
    ]);
    expect(findRootMenus(indexNavigation(index)).map((m: any) => m.name).sort()).toEqual([
      'A menu',
      'B menu',
    ]);
  });

  it('ignores nav-template items that are not under a container', () => {
    // Sitecore reuses these templates across Site Library as lone link holders; they are not menus.
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'Site Navigation' },
      { guid: G('a'), template: 'navigation group', name: 'Real', parent: ROOT },
      { guid: G('x'), template: 'navigation element', name: 'BrowseProductsLink', parent: G('pagefldr') },
      { guid: G('pagefldr'), template: 'page content folder', name: 'Folder' },
    ]);
    expect(findRootMenus(indexNavigation(index)).map((m: any) => m.name)).toEqual(['Real']);
  });
});

describe('buildNavigationMenuEntryMapping', () => {
  it('emits one row per root menu keyed by otherCmsEntryUid', () => {
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'Site Navigation' },
      { guid: MENU, template: 'navigation group', name: 'Main Menu', parent: ROOT },
      { guid: G('nested'), template: 'navigation element', name: 'Nested', parent: MENU },
    ]);
    const rows = buildNavigationMenuEntryMapping({
      itemIndex: index,
      contentTypeUid: NAV_MENU_CONTENT_TYPE_UID,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contentTypeUid: 'navigation_group',
      entryName: 'Main Menu',
      language: 'en',
      otherCmsEntryUid: MENU.replace(/[-{}]/g, '').toLowerCase(),
      isUpdate: false,
    });
  });
});

describe('navigationReferenceTargets', () => {
  it('returns the content type uids of non-menu children of menu items', () => {
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'Site Navigation' },
      { guid: MENU, template: 'navigation group', name: 'FindStoreModal', parent: ROOT },
      {
        guid: G('label'),
        template: 'dictionary entry',
        templateId: '{TID-DICT}',
        name: 'LoginLabel',
        parent: MENU,
      },
    ]);
    expect(
      navigationReferenceTargets({
        itemIndex: index,
        contentTypeKeys: { '{TID-DICT}': 'dictionary_entry' },
      })
    ).toEqual(['dictionary_entry']);
  });

  it('omits a template that shipped no content type', () => {
    const index = idx([
      { guid: ROOT, template: 'site navigation', name: 'Site Navigation' },
      { guid: MENU, template: 'navigation group', name: 'Menu', parent: ROOT },
      { guid: G('label'), template: 'dictionary entry', templateId: '{TID-DICT}', name: 'L', parent: MENU },
    ]);
    expect(navigationReferenceTargets({ itemIndex: index, contentTypeKeys: {} })).toEqual([]);
  });
});

describe('content type gating', () => {
  it('recognises the navigation group content type by its template key', () => {
    expect(isNavigationMenuContentType({ otherCmsUid: 'navigation group' })).toBe(true);
    expect(isNavigationMenuContentType({ otherCmsUid: 'Navigation Group' })).toBe(true);
    expect(isNavigationMenuContentType({ otherCmsUid: 'generic content page' })).toBe(false);
  });

  it('suppresses only the templates that become blocks or nothing', () => {
    expect(isSuppressedNavigationTemplate('navigation element')).toBe(true);
    expect(isSuppressedNavigationTemplate('site navigation')).toBe(true);
    // The menu content type itself must survive — it is what the menus ship as.
    expect(isSuppressedNavigationTemplate('navigation group')).toBe(false);
    expect(isSuppressedNavigationTemplate('generic content page')).toBe(false);
  });
});
