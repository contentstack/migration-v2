import { entriesFieldCreator, sitecoreItemUrl } from './entries-field-creator.utils.js';

/**
 * Sitecore navigation → Contentstack, denormalised.
 *
 * Sitecore keeps menu structure implicitly in the item tree — `parentid` plus `sortorder` — and has
 * no children field on `Navigation Group` / `Navigation Element`. Nothing in a template definition
 * can express that relation, so nothing in `fieldMapping` can carry it and the connector currently
 * drops it: items are bucketed `template → locale → id` and the tree is discarded.
 *
 * Rather than materialise the tree as a self-referencing reference field (358 entry references on
 * the WinnDixie package), each root menu is denormalised into ONE entry whose subtree lives in
 * nested modular blocks. Zero hierarchy references, one API call per menu.
 *
 * This is the api half — it builds the entry JSON at migration time. The content type's
 * `fieldMapping` and the `entryMapping` rows are produced one stage earlier, by the mapper, in
 * `upload-api/migration-sitecore/libs/navigation.js`. The two layers cannot import each other
 * (CommonJS plain JS vs TS/ESM, separate packages), so the constants and leaf definitions below are
 * mirrored there — keep them in sync, and change both or neither.
 */

// The menu content type deliberately keeps the `navigation group` template's uid. Renaming it would
// break two things at once: the entry loop matches content types to item buckets with
// `uidCorrector({ uid: template }) === contentstackUid`, and observed reference resolution maps a
// target's template GUID to a content type uid through `contentTypeKeys`. Keeping the uid means the
// 175 `whichleftnav` references and the footer QueryableTreelist fields — all of which target root
// menus — resolve to these entries with no resolver changes. Only the display title changes.
export const NAV_MENU_CONTENT_TYPE_UID = 'navigation_group';
export const NAV_MENU_CONTENT_TYPE_TITLE = 'Navigation Menu';

// The template key the menu content type is derived from, as it appears in an item's `template`
// attribute. Matched on the template key rather than the content type uid because the uid can be
// affixed (restricted names) or renamed by the user on the mapping screen, while the key cannot.
export const NAV_MENU_TEMPLATE_KEY = 'navigation group';

/** True for the content type the mapper rebuilt as the denormalised menu. */
export const isNavigationMenuContentType = (contentType: any): boolean =>
  `${contentType?.otherCmsUid ?? ''}`.toLowerCase() === NAV_MENU_TEMPLATE_KEY;

// Templates that make up the menu tree itself. Anything else parented under one of these is real
// content rather than a menu item and is referenced instead of inlined (see CONTENT_BLOCK_UID).
export const NAV_TEMPLATE_KEYS = new Set([
  'site navigation',
  'navigation group',
  'navigation element',
]);

export const ROOT_TEMPLATE_KEY = 'site navigation';

// Modular blocks cannot recurse, so each level of menu depth is a distinct schema definition and the
// depth has to be fixed when the schema is generated. Contentstack rejects deeper than 3 — a real
// import returned "Maximum depth limit for modular block nesting is 3" — so this is a platform
// ceiling. The WinnDixie package has 12 items at a 4th level; they cannot be represented and are
// dropped, but every one is logged rather than lost quietly.
export const MAX_BLOCK_DEPTH = 3;

export const ITEMS_FIELD_UID = 'items';
export const MENU_BLOCK_UID = 'menu_item';
export const CONTENT_BLOCK_UID = 'content_item';

type Leaf = { uid: string; title: string; type: string; sitecoreKey: string };

/**
 * One block type carries both `navigation group` and `navigation element`, so it holds the union of
 * their fields. `css` is deliberately absent: it is defined on 4 items in the package and empty on
 * all 4, so it would ship an always-null field.
 */
const MENU_ITEM_LEAVES: Leaf[] = [
  { uid: 'label', title: 'Label', type: 'single_line_text', sitecoreKey: 'navigationname' },
  { uid: 'link', title: 'Link', type: 'link', sitecoreKey: 'navigationurl' },
  { uid: 'image', title: 'Image', type: 'file', sitecoreKey: 'navigationimage' },
  { uid: 'font_icon', title: 'Font icon', type: 'single_line_text', sitecoreKey: 'font-icon' },
  { uid: 'aria_label', title: 'Aria label', type: 'single_line_text', sitecoreKey: 'aria-label' },
  { uid: 'aria_haspopup', title: 'Aria haspopup', type: 'boolean', sitecoreKey: 'aria-haspopup' },
  { uid: 'group_title', title: 'Group title', type: 'single_line_text', sitecoreKey: 'navigation grouptitle' },
  { uid: 'group_text', title: 'Group text', type: 'json', sitecoreKey: 'navigation group text' },
];

// Same fields on the entry root, since a root menu is itself a `navigation group` item.
const ROOT_LEAVES: Leaf[] = MENU_ITEM_LEAVES.map((leaf) => ({
  ...leaf,
  uid: leaf.uid === 'label' ? 'menu_label' : leaf.uid === 'link' ? 'menu_link' : leaf.uid,
  title: leaf.uid === 'label' ? 'Menu label' : leaf.uid === 'link' ? 'Menu link' : leaf.title,
}));

const SITECORE_UID_LEAF = {
  uid: 'sitecore_uid',
  title: 'Sitecore uid',
  type: 'single_line_text',
};

// --- entry building -------------------------------------------------------------------------

type NavItem = {
  uid: string;
  template: string;
  meta: any;
  fields: any;
};

/** xml2js emits a lone <field> as an object and several as an array; normalise both. */
const fieldList = (fields: any): any[] => {
  const raw = fields?.field;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

const rawFieldValue = (item: NavItem, key: string): string => {
  const match = fieldList(item?.fields).find(
    (f: any) => `${f?.$?.key ?? ''}`.toLowerCase() === key.toLowerCase()
  );
  const content = match?.content;
  return typeof content === 'string' ? content : '';
};

/**
 * Sitecore renders siblings by sortorder ascending, ties broken by name. This package ties heavily
 * — many siblings share sortorder=100 — so without the name tiebreak the order would fall out of
 * the recursive directory walk and differ between runs on the same package.
 */
const bySortOrderThenName = (a: NavItem, b: NavItem) => {
  const sa = Number.parseInt(`${a?.meta?.sortorder ?? 0}`, 10) || 0;
  const sb = Number.parseInt(`${b?.meta?.sortorder ?? 0}`, 10) || 0;
  if (sa !== sb) return sa - sb;
  return `${a?.meta?.name ?? ''}`.localeCompare(`${b?.meta?.name ?? ''}`);
};

const isNavTemplate = (template?: string) =>
  NAV_TEMPLATE_KEYS.has(`${template ?? ''}`.toLowerCase());

export type NavigationMenuResult = {
  entries: Record<string, any>;
  log: string[];
  stats: {
    menus: number;
    menuBlocks: number;
    contentBlocks: number;
    truncated: number;
    unresolvedContentTypes: number;
  };
};

/**
 * Build one entry per root menu for a single locale.
 *
 * `entriesData` is passed in exactly the shape the Sitecore service already assembles —
 * `[{ template, locale: { [lang]: { [id]: { meta, fields } } } }]` — so wiring this in later is an
 * insertion rather than a reshape.
 */
export const buildNavigationMenuEntries = async ({
  entriesData,
  contentTypes,
  keyMapper,
  idCorrector,
  uidCorrector,
  allAssetJSON,
  locale,
}: {
  entriesData: any[];
  contentTypes: any[];
  keyMapper?: Record<string, string>;
  idCorrector: (arg: { id: any }) => string;
  uidCorrector: (arg: { uid: string }) => string;
  allAssetJSON?: Record<string, any>;
  locale: string;
}): Promise<NavigationMenuResult> => {
  const log: string[] = [];
  const stats = {
    menus: 0,
    menuBlocks: 0,
    contentBlocks: 0,
    truncated: 0,
    unresolvedContentTypes: 0,
  };

  // Flatten every item in this locale, keeping its template alongside meta/fields.
  const itemsByUid = new Map<string, NavItem>();
  for (const bucket of entriesData ?? []) {
    const template = `${bucket?.template ?? ''}`;
    for (const [uid, entry] of Object.entries<any>(bucket?.locale?.[locale] ?? {})) {
      itemsByUid.set(uid, { uid, template, meta: entry?.meta, fields: entry?.fields });
    }
  }

  const childrenByParent = new Map<string, NavItem[]>();
  for (const item of itemsByUid.values()) {
    const parent = idCorrector({ id: item?.meta?.parentid });
    if (!parent) continue;
    const slot = childrenByParent.get(parent);
    if (slot) slot.push(item);
    else childrenByParent.set(parent, [item]);
  }
  for (const kids of childrenByParent.values()) kids.sort(bySortOrderThenName);

  // The published content type uid for a Sitecore template. Entries are written under the
  // keyMapper-mapped uid, so a reference carrying the raw uid would point at a content type that
  // does not exist in the destination stack.
  const contentTypeUidFor = (template: string): string | undefined => {
    const corrected = uidCorrector({ uid: template });
    const ctType = (contentTypes ?? []).find(
      (ct: any) => ct?.contentstackUid === corrected || ct?.otherCmsUid === template
    );
    if (!ctType) return undefined;
    return keyMapper?.[ctType.contentstackUid] ?? ctType.contentstackUid;
  };

  const valueOf = async (item: NavItem, leaf: Leaf) => {
    const content = rawFieldValue(item, leaf.sitecoreKey);
    if (!content) return undefined;
    // Reuse the pipeline's own field emitter so a link, image or RTE inside a block is byte-identical
    // to the same Sitecore field emitted anywhere else.
    return entriesFieldCreator({
      field: { contentstackFieldType: leaf.type },
      content,
      idCorrector,
      allAssetJSON,
      contentTypes,
      entriesData,
      locale,
    });
  };

  const buildLeaves = async (item: NavItem, leaves: Leaf[]) => {
    const out: Record<string, any> = {};
    for (const leaf of leaves) {
      const value = await valueOf(item, leaf);
      if (value !== undefined && value !== null && value !== '') out[leaf.uid] = value;
    }
    return out;
  };

  const buildBlocks = async (parentUid: string, depth: number): Promise<any[]> => {
    const blocks: any[] = [];
    for (const child of childrenByParent.get(parentUid) ?? []) {
      if (!isNavTemplate(child.template)) {
        const ctUid = contentTypeUidFor(child.template);
        if (!ctUid) {
          stats.unresolvedContentTypes += 1;
          log.push(
            `Skipped "${child?.meta?.name}" (${child.template}) under menu item ${parentUid}: no content type shipped for that template, so it cannot be referenced.`
          );
          continue;
        }
        blocks.push({
          [CONTENT_BLOCK_UID]: {
            entry: [{ uid: child.uid, _content_type_uid: ctUid }],
            sitecore_uid: child.uid,
          },
        });
        stats.contentBlocks += 1;
        continue;
      }

      const block: Record<string, any> = {
        ...(await buildLeaves(child, MENU_ITEM_LEAVES)),
        sitecore_uid: child.uid,
      };
      const grandchildren = childrenByParent.get(child.uid) ?? [];
      if (grandchildren.length) {
        if (depth < MAX_BLOCK_DEPTH) {
          const nested = await buildBlocks(child.uid, depth + 1);
          if (nested.length) block[ITEMS_FIELD_UID] = nested;
        } else {
          // Never drop silently: the schema is generated to a fixed depth, so anything below it is
          // lost and has to be visible in the migration log.
          stats.truncated += grandchildren.length;
          log.push(
            `Truncated ${grandchildren.length} item(s) below "${child?.meta?.name}" at depth ${depth}: MAX_BLOCK_DEPTH is ${MAX_BLOCK_DEPTH}.`
          );
        }
      }
      blocks.push({ [MENU_BLOCK_UID]: block });
      stats.menuBlocks += 1;
    }
    return blocks;
  };

  // A package can hold one `site navigation` container per site, so collect them all rather than
  // assuming a single root — with `find`, a multi-site export would migrate only the first site's
  // menus and drop the rest without a word.
  const roots = [...itemsByUid.values()].filter(
    (item) => `${item.template}`.toLowerCase() === ROOT_TEMPLATE_KEY
  );
  if (!roots.length) {
    log.push(
      `No "${ROOT_TEMPLATE_KEY}" item found in the ${locale} locale — no navigation menus built.`
    );
  }

  // Menus whose `site navigation` container is absent from the export are unreachable. Report them:
  // a partial export can easily omit the container while shipping the menus beneath it, and the
  // difference between "this site has no navigation" and "we could not see its root" matters.
  const reachable = new Set(roots.map((r) => r.uid));
  for (const item of itemsByUid.values()) {
    if (!isNavTemplate(item.template) || `${item.template}`.toLowerCase() === ROOT_TEMPLATE_KEY) {
      continue;
    }
    const parentUid = idCorrector({ id: item?.meta?.parentid });
    const parent = parentUid ? itemsByUid.get(parentUid) : undefined;
    if (parent && isNavTemplate(parent.template)) continue; // nested — handled as a block
    if (parentUid && reachable.has(parentUid)) continue; // a root menu we will build
    const hasNavChildren = (childrenByParent.get(item.uid) ?? []).some((c) =>
      isNavTemplate(c.template)
    );
    if (!hasNavChildren) continue; // a lone link holder, not a menu
    log.push(
      `Unreachable menu "${item?.meta?.name}" (${item.uid}): its parent ${parentUid} is not a "${ROOT_TEMPLATE_KEY}" item in this export, so it was not built as a menu.`
    );
  }

  const entries: Record<string, any> = {};
  const menus = roots.flatMap((root) => childrenByParent.get(root.uid) ?? []);
  for (const menu of menus) {
    if (!isNavTemplate(menu.template)) continue;
    const entry: Record<string, any> = {
      uid: menu.uid,
      title: menu?.meta?.name,
      ...(await buildLeaves(menu, ROOT_LEAVES)),
      sitecore_uid: menu.uid,
    };
    // Matches how the Sitecore entry builder derives url, including keys that contain spaces —
    // deviating here would make menu urls inconsistent with every other migrated entry. Logged so
    // the malformed ones stay visible.
    if (menu?.meta?.key) {
      entry.url = sitecoreItemUrl(menu.meta.key);
      if (/\s/.test(menu.meta.key)) {
        log.push(`Menu "${menu?.meta?.name}" produced a url containing whitespace: "${entry.url}".`);
      }
    }
    const blocks = await buildBlocks(menu.uid, 1);
    if (blocks.length) entry[ITEMS_FIELD_UID] = blocks;
    entry.publish_details = [];
    entries[menu.uid] = entry;
    stats.menus += 1;
  }

  return { entries, log, stats };
};
