/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Sitecore navigation → one Contentstack entry per menu.
 *
 * Sitecore keeps menu structure implicitly in the item tree — `parentid` plus `sortorder` — and has
 * no children field on `Navigation Group` / `Navigation Element`. Nothing in a template definition
 * expresses that relation, so the schema builder cannot see it and the migrated navigation ends up
 * as hundreds of unrelated flat entries.
 *
 * Instead of materialising the tree as a self-referencing reference field (358 entry references on
 * the WinnDixie package), each root menu is denormalised into ONE entry whose subtree lives in
 * nested modular blocks: zero hierarchy references, one API call per menu.
 *
 * This is the mapper (upload-api) half — it produces the content type's `fieldMapping` and the
 * `entryMapping` rows. The api half (`api/src/utils/navigation-menu.utils.ts`) builds the actual
 * entry JSON at migration time. The two layers cannot import each other, so the constants below are
 * mirrored there; keep them in sync.
 */

// The menu content type deliberately keeps the `navigation group` template's uid. Renaming it would
// break two things at once: the api's entry loop matches content types to item buckets with
// `uidCorrector({ uid: template }) === contentstackUid`, and observed reference resolution maps a
// target's template GUID to a content type uid through contentTypeKey.json. Keeping the uid means
// every `whichleftnav` reference — all of which target root menus — resolves to these entries with
// no resolver changes. Only the display title changes.
const NAV_MENU_CONTENT_TYPE_UID = 'navigation_group';
const NAV_MENU_CONTENT_TYPE_TITLE = 'Navigation Menu';

// The template key the menu content type is derived from, as it appears in an item's `template`
// attribute (Sitecore lowercases these keys).
const NAV_MENU_TEMPLATE_KEY = 'navigation group';

// Templates that make up the menu tree. Anything else parented under one of these is real content
// rather than a menu item, and is referenced instead of inlined.
const NAV_TEMPLATE_KEYS = new Set(['site navigation', 'navigation group', 'navigation element']);

// The container item whose children are the root menus.
const ROOT_TEMPLATE_KEY = 'site navigation';

// Templates that ship no content type of their own once navigation is denormalised: nested groups
// and elements become blocks, and the container becomes nothing.
const SUPPRESSED_TEMPLATE_KEYS = new Set(['navigation element', 'site navigation']);

// Modular blocks cannot recurse, so each level of depth is a distinct schema definition and the
// depth is fixed when the schema is generated. Contentstack rejects a schema nested deeper than 3 —
// a real import returned "Maximum depth limit for modular block nesting is 3" — so 3 is a platform
// ceiling, not a preference. The WinnDixie package has items at a 4th level (blocks per level:
// 117 / 167 / 40 / 12); those 12 cannot be represented and are dropped by the api half, which logs
// every one rather than losing them quietly.
const MAX_BLOCK_DEPTH = 3;

const ITEMS_FIELD_UID = 'items';
const MENU_BLOCK_UID = 'menu_item';
const CONTENT_BLOCK_UID = 'content_item';

/**
 * One block type carries both `navigation group` and `navigation element`, so it holds the union of
 * their fields. `css` is deliberately absent: it is defined on 4 items in the package and empty on
 * all 4, so it would ship an always-null field.
 */
const MENU_ITEM_LEAVES = [
  { uid: 'label', title: 'Label', type: 'single_line_text', sitecoreKey: 'navigationname' },
  { uid: 'link', title: 'Link', type: 'link', sitecoreKey: 'navigationurl' },
  { uid: 'image', title: 'Image', type: 'file', sitecoreKey: 'navigationimage' },
  { uid: 'font_icon', title: 'Font icon', type: 'single_line_text', sitecoreKey: 'font-icon' },
  { uid: 'aria_label', title: 'Aria label', type: 'single_line_text', sitecoreKey: 'aria-label' },
  {
    uid: 'aria_haspopup',
    title: 'Aria haspopup',
    type: 'boolean',
    sitecoreKey: 'aria-haspopup'
  },
  {
    uid: 'group_title',
    title: 'Group title',
    type: 'single_line_text',
    sitecoreKey: 'navigation grouptitle'
  },
  { uid: 'group_text', title: 'Group text', type: 'json', sitecoreKey: 'navigation group text' }
];

// The same fields on the entry root, since a root menu is itself a `navigation group` item.
const ROOT_LEAF_UID_OVERRIDES = { label: 'menu_label', link: 'menu_link' };
const ROOT_LEAF_TITLE_OVERRIDES = { label: 'Menu label', link: 'Menu link' };

const ROOT_LEAVES = MENU_ITEM_LEAVES.map((leaf) => ({
  ...leaf,
  uid: ROOT_LEAF_UID_OVERRIDES[leaf.uid] ?? leaf.uid,
  title: ROOT_LEAF_TITLE_OVERRIDES[leaf.uid] ?? leaf.title
}));

const SITECORE_UID_LEAF = {
  uid: 'sitecore_uid',
  title: 'Sitecore uid',
  type: 'single_line_text'
};

const lower = (value) => `${value ?? ''}`.toLowerCase();

const isNavTemplate = (template) => NAV_TEMPLATE_KEYS.has(lower(template));

/** Strip a Sitecore GUID to the form entry uids use. */
const toEntryUid = (id) => `${id ?? ''}`.replace(/[-{}]/g, '').toLowerCase();

/**
 * A mapper fieldMapping row. The mapper represents modular blocks as a flat list with dotted uids
 * (`field.block.leaf`); `buildSchemaTree` in the api assembles the nesting later. This is the same
 * convention `buildUnionBlockMapping` uses in observedReferences.js, and `buildSchemaTree` already
 * recurses through a `modular_blocks` nested inside a `modular_blocks_child`, so nesting to any
 * depth needs no change to the schema emitter.
 *
 * The id is deterministic on purpose: the mapper API mints a fresh uuid for any row that arrives
 * without one, which would give these synthetic fields a new identity on every mapper run and
 * orphan whatever the user customised on the mapping screen. Template-derived fields avoid that by
 * carrying their template-field GUID; these carry a stable path instead.
 */
const fieldRow = (uid, title, type, extra = {}) => ({
  id: `${NAV_MENU_CONTENT_TYPE_UID}-${uid}`,
  uid,
  otherCmsField: title,
  otherCmsType: type,
  contentstackField: title,
  contentstackFieldUid: uid,
  contentstackFieldType: type,
  backupFieldUid: uid,
  backupFieldType: type,
  isDeleted: false,
  ...extra
});

/**
 * Rows for one `items` modular-blocks field and everything beneath it, recursing to MAX_BLOCK_DEPTH.
 * `depth` is 1-based: depth 1 is the block list on the entry root.
 */
const blockRows = (prefix, depth, referenceTo) => {
  const menu = `${prefix}.${MENU_BLOCK_UID}`;
  const rows = [
    fieldRow(prefix, depth === 1 ? 'Items' : `Items (level ${depth})`, 'modular_blocks', {
      multiple: true
    }),
    fieldRow(menu, 'Menu item', 'modular_blocks_child'),
    ...MENU_ITEM_LEAVES.map((leaf) => fieldRow(`${menu}.${leaf.uid}`, leaf.title, leaf.type)),
    fieldRow(`${menu}.${SITECORE_UID_LEAF.uid}`, SITECORE_UID_LEAF.title, SITECORE_UID_LEAF.type)
  ];

  // Items parented under a menu item that are not themselves menu items — in this package the 32
  // label/image items under FindStoreModal. They carry their own RTE bodies, images and dictionary
  // phrases, so they stay entries of their existing content types and are referenced, not inlined.
  if (referenceTo?.length) {
    const content = `${prefix}.${CONTENT_BLOCK_UID}`;
    rows.push(
      fieldRow(content, 'Content item', 'modular_blocks_child'),
      fieldRow(`${content}.entry`, 'Entry', 'reference', { refrenceTo: referenceTo }),
      fieldRow(
        `${content}.${SITECORE_UID_LEAF.uid}`,
        SITECORE_UID_LEAF.title,
        SITECORE_UID_LEAF.type
      )
    );
  }

  if (depth < MAX_BLOCK_DEPTH) {
    rows.push(...blockRows(`${menu}.${ITEMS_FIELD_UID}`, depth + 1, referenceTo));
  }
  return rows;
};

/**
 * The menu content type's fieldMapping. `referenceTo` is the content type uids that non-menu
 * children belong to; pass [] to omit the content_item block entirely.
 */
const buildNavigationMenuFieldMapping = (referenceTo = []) => [
  fieldRow('title', 'Title', 'text'),
  fieldRow('url', 'Url', 'url'),
  ...ROOT_LEAVES.map((leaf) => fieldRow(leaf.uid, leaf.title, leaf.type)),
  fieldRow(SITECORE_UID_LEAF.uid, SITECORE_UID_LEAF.title, SITECORE_UID_LEAF.type),
  ...blockRows(ITEMS_FIELD_UID, 1, referenceTo)
];

/**
 * Sitecore renders siblings by sortorder ascending, ties broken by name. This package ties heavily —
 * many siblings share sortorder=100 — so without the name tiebreak the order would fall out of the
 * recursive directory walk and differ between runs on the same package.
 */
const bySortOrderThenName = (a, b) => {
  const sa = Number.parseInt(`${a?.sortorder ?? 0}`, 10) || 0;
  const sb = Number.parseInt(`${b?.sortorder ?? 0}`, 10) || 0;
  if (sa !== sb) return sa - sb;
  return `${a?.name ?? ''}`.localeCompare(`${b?.name ?? ''}`);
};

/**
 * Index the nav items out of observePackage's itemIndex, keyed by entry uid.
 *
 * The index is keyed by raw uppercase GUID and carries `parentid`/`sortorder`/`name`/`language`
 * alongside the template, so no second walk of the package is needed.
 */
const indexNavigation = (itemIndex) => {
  const items = new Map();
  const childrenByParent = new Map();
  for (const [guid, meta] of Object.entries(itemIndex ?? {})) {
    if (meta?.isMedia) continue;
    const uid = toEntryUid(guid);
    const item = {
      uid,
      template: meta?.template ?? '',
      name: meta?.name ?? '',
      sortorder: meta?.sortorder,
      language: meta?.language,
      parentUid: toEntryUid(meta?.parentid)
    };
    items.set(uid, item);
  }
  for (const item of items.values()) {
    if (!item.parentUid) continue;
    const slot = childrenByParent.get(item.parentUid);
    if (slot) slot.push(item);
    else childrenByParent.set(item.parentUid, [item]);
  }
  for (const kids of childrenByParent.values()) kids.sort(bySortOrderThenName);
  return { items, childrenByParent };
};

/** Root menus: the nav children of every `site navigation` container in the package. */
const findRootMenus = ({ items, childrenByParent }) => {
  const roots = [...items.values()].filter((i) => lower(i.template) === ROOT_TEMPLATE_KEY);
  // A package can hold one container per site, so collect them all — taking only the first would
  // migrate one site's menus and drop the rest without a word.
  return roots
    .flatMap((root) => childrenByParent.get(root.uid) ?? [])
    .filter((i) => isNavTemplate(i.template));
};

/**
 * Content type uids the content_item block must be able to reference: the templates of every
 * non-menu item parented under a menu item, anywhere in the reachable tree.
 */
const navigationReferenceTargets = ({ itemIndex, contentTypeKeys }) => {
  const { items } = indexNavigation(itemIndex);
  const navUids = new Set(
    [...items.values()].filter((i) => isNavTemplate(i.template)).map((i) => i.uid)
  );
  // contentTypeKey.json is keyed by template GUID, and an item carries its template's GUID in
  // `tid`, so the mapping from template key to content type uid comes from the index itself.
  const templateIdByKey = {};
  for (const meta of Object.values(itemIndex ?? {})) {
    if (meta?.template && meta?.templateId) templateIdByKey[lower(meta.template)] = meta.templateId;
  }
  const uids = [];
  for (const item of items.values()) {
    if (isNavTemplate(item.template)) continue;
    if (!navUids.has(item.parentUid)) continue;
    const templateId = templateIdByKey[lower(item.template)];
    const uid = templateId ? contentTypeKeys?.[templateId] : undefined;
    // A template that shipped no content type cannot be referenced; the api half logs the items it
    // has to skip for the same reason.
    if (uid && !uids.includes(uid)) uids.push(uid);
  }
  return uids.sort();
};

/**
 * entryMapping rows for the menus, in the shape the mapper API expects.
 *
 * Without these the mapping screen would promise one row per Sitecore nav item while only the root
 * menus actually ship. `otherCmsEntryUid` is the identity that survives across iterations — the
 * mapper API resolves a previously imported entry through it and mints a throwaway uuid for `id`
 * either way — so it carries the menu's corrected GUID.
 */
const buildNavigationMenuEntryMapping = ({ itemIndex, contentTypeUid }) => {
  const indexed = indexNavigation(itemIndex);
  return findRootMenus(indexed).map((menu) => ({
    contentTypeUid,
    entryName: menu.name,
    language: menu.language,
    otherCmsEntryUid: menu.uid,
    otherCmsCTName: menu.template,
    isUpdate: false
  }));
};

/** True for the content type that becomes the denormalised menu. */
const isNavigationMenuContentType = (contentType) =>
  lower(contentType?.otherCmsUid) === NAV_MENU_TEMPLATE_KEY;

/** True for templates that must not ship a content type once navigation is denormalised. */
const isSuppressedNavigationTemplate = (templateKey) =>
  SUPPRESSED_TEMPLATE_KEYS.has(lower(templateKey));

module.exports = {
  NAV_MENU_CONTENT_TYPE_UID,
  NAV_MENU_CONTENT_TYPE_TITLE,
  NAV_MENU_TEMPLATE_KEY,
  NAV_TEMPLATE_KEYS,
  ROOT_TEMPLATE_KEY,
  SUPPRESSED_TEMPLATE_KEYS,
  MAX_BLOCK_DEPTH,
  ITEMS_FIELD_UID,
  MENU_BLOCK_UID,
  CONTENT_BLOCK_UID,
  MENU_ITEM_LEAVES,
  ROOT_LEAVES,
  buildNavigationMenuFieldMapping,
  buildNavigationMenuEntryMapping,
  navigationReferenceTargets,
  indexNavigation,
  findRootMenus,
  isNavigationMenuContentType,
  isSuppressedNavigationTemplate,
  toEntryUid
};
