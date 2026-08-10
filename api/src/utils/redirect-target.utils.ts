import type {
  ResolvedRedirectTarget,
  SitecoreItemIndexEntry,
} from './redirect-target.interface.js';
import type { AssetFolderMapping } from './asset-folder.interface.js';

// Sitecore's single-item picker fields (`Droptree`, and `redirect to item` in
// particular) can point at three different kinds of thing, which Contentstack models
// as three different field types:
//
//   an entry        -> reference
//   a media asset   -> file
//   a media folder  -> no equivalent; carried as a path + folder uid
//
// A field can't be all three, and observed values are never mixed — each value points
// at exactly one item. So the field becomes a modular block with `multiple: false`:
// a discriminated union where exactly one block is populated. That avoids the sibling
// fields that a group or two parallel fields would leave permanently empty.

const GUID_RE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/g;

export const REDIRECT_BLOCK_UIDS = {
  entry: 'entry',
  asset: 'asset',
  folder: 'folder',
} as const;

// Sitecore media-folder items use this template name.
const MEDIA_FOLDER_TEMPLATE = 'media folder';

export function extractGuids(content?: string): string[] {
  if (!content || typeof content !== 'string') return [];
  return content.match(GUID_RE) ?? [];
}

/**
 * Record one Sitecore item in the index used to classify reference targets.
 *
 * Keyed by uppercased GUID because Sitecore is inconsistent about case between an
 * item's own `id` and the `parentid`/`s:ds` attributes that point at it.
 *
 * @param mediaPath media-library-relative path *including* the item's own name, or
 *                  undefined for items outside the media library. For a media folder
 *                  this is the folder's own path, which is what the folder mapper keys on.
 */
export function indexSitecoreItem(
  index: Record<string, SitecoreItemIndexEntry>,
  meta: { id?: string; tid?: string; template?: string },
  mediaPath?: string
) {
  const id = meta?.id?.toUpperCase?.();
  if (!id) return;
  const template = meta?.template ?? '';
  index[id] = {
    template,
    templateId: meta?.tid ?? '',
    mediaPath,
    isMediaFolder: template.toLowerCase() === MEDIA_FOLDER_TEMPLATE,
  };
}

// Index the folder mapper by lowercased path so resolveRedirectTarget can look a
// folder's Contentstack uid up from the Sitecore path.
export function indexFoldersByPath(mappings: AssetFolderMapping[]) {
  const byPath: Record<string, AssetFolderMapping> = {};
  for (const m of mappings ?? []) {
    if (m?.path) byPath[m.path.toLowerCase()] = m;
  }
  return byPath;
}

/**
 * Classify a single Sitecore GUID against the item index.
 *
 * `folderMappings` is keyed by media-library-relative path (the same key
 * `assets/folders.json` uses), because only some folders have a recoverable
 * Sitecore uid — the path is the one identifier every folder has.
 */
export function resolveRedirectTarget({
  guid,
  itemIndex,
  contentTypeKeys,
  folderByPath,
}: {
  guid: string;
  itemIndex: Record<string, SitecoreItemIndexEntry>;
  contentTypeKeys: Record<string, string>;
  folderByPath: Record<string, AssetFolderMapping>;
}): ResolvedRedirectTarget {
  const key = guid?.toUpperCase?.() ?? '';
  const item = itemIndex?.[key];
  if (!item) {
    // The target isn't in the package at all — a genuine export gap, not a code path
    // we can recover from. Callers log these rather than emitting a dead reference.
    return { kind: 'unresolved', sitecoreUid: guid, reason: 'not-in-package' };
  }

  if (item.isMediaFolder || item.template?.toLowerCase() === MEDIA_FOLDER_TEMPLATE) {
    const folderPath = item.mediaPath ?? '';
    return {
      kind: 'folder',
      sitecoreUid: guid,
      folderPath,
      folderUid: folderByPath?.[folderPath.toLowerCase()]?.uid,
    };
  }

  // Anything else under the media library is an asset (image, jpeg, pdf, file, …).
  if (item.mediaPath !== undefined) {
    return { kind: 'asset', sitecoreUid: guid, assetUid: idToAssetUid(guid) };
  }

  // contentTypeKey.json is keyed by template GUID (`tid`), not template name.
  const contentTypeUid = item.templateId
    ? contentTypeKeys?.[item.templateId] ?? contentTypeKeys?.[item.templateId.toUpperCase()]
    : undefined;
  if (!contentTypeUid) {
    // In the package, but its template never became a content type — referencing it
    // would produce a reference to a content type that doesn't exist.
    return {
      kind: 'unresolved',
      sitecoreUid: guid,
      reason: 'template-not-migrated',
    };
  }
  return { kind: 'entry', sitecoreUid: guid, contentTypeUid };
}

// Mirrors idCorrector in sitecore.service: strip braces and hyphens, lowercase.
export function idToAssetUid(guid: string) {
  return guid?.replace(/[-{}]/g, '')?.toLowerCase?.() ?? '';
}

/**
 * Build the flat fieldMapping rows for a union block field. The codebase represents
 * modular blocks as a flat list with dotted uids (`field.block.leaf`), which
 * buildSchemaTree assembles into nested schema — so this returns rows in that shape
 * rather than a nested object.
 *
 * Only blocks that the observed data actually needs are emitted: a field whose values
 * are all entries gets one block, not three.
 */
export function buildRedirectUnionMapping({
  fieldUid,
  displayName,
  sitecoreKey,
  kinds,
  referenceTo,
}: {
  fieldUid: string;
  displayName: string;
  sitecoreKey: string;
  kinds: Set<string>;
  referenceTo: string[];
}) {
  const rows: any[] = [
    {
      uid: sitecoreKey,
      otherCmsField: displayName,
      otherCmsType: 'Droptree',
      contentstackField: displayName,
      contentstackFieldUid: fieldUid,
      contentstackFieldType: 'modular_blocks',
      backupFieldUid: fieldUid,
      backupFieldType: 'modular_blocks',
      isDeleted: false,
      // Single-select: this is a union of possible target kinds, not a repeating list.
      multiple: false,
    },
  ];

  const child = (blockUid: string, blockTitle: string) => ({
    uid: `${sitecoreKey}.${blockUid}`,
    otherCmsField: blockTitle,
    otherCmsType: 'block',
    contentstackField: blockTitle,
    contentstackFieldUid: `${fieldUid}.${blockUid}`,
    contentstackFieldType: 'modular_blocks_child',
    backupFieldUid: `${fieldUid}.${blockUid}`,
    backupFieldType: 'modular_blocks_child',
    isDeleted: false,
  });

  const leaf = (blockUid: string, leafUid: string, type: string, extra: any = {}) => ({
    uid: `${sitecoreKey}.${blockUid}.${leafUid}`,
    otherCmsField: leafUid,
    otherCmsType: type,
    contentstackField: leafUid,
    contentstackFieldUid: `${fieldUid}.${blockUid}.${leafUid}`,
    contentstackFieldType: type,
    backupFieldUid: `${fieldUid}.${blockUid}.${leafUid}`,
    backupFieldType: type,
    isDeleted: false,
    ...extra,
  });

  if (kinds.has('entry') && referenceTo.length) {
    rows.push(child(REDIRECT_BLOCK_UIDS.entry, 'Entry'));
    rows.push(
      leaf(REDIRECT_BLOCK_UIDS.entry, 'target', 'reference', {
        refrenceTo: referenceTo,
      })
    );
  }
  if (kinds.has('asset')) {
    rows.push(child(REDIRECT_BLOCK_UIDS.asset, 'Asset'));
    rows.push(leaf(REDIRECT_BLOCK_UIDS.asset, 'target', 'file'));
  }
  if (kinds.has('folder')) {
    rows.push(child(REDIRECT_BLOCK_UIDS.folder, 'Media folder'));
    // A Contentstack file field can't hold a folder, so the folder is carried as a
    // path plus the uid of the folder created by the asset pipeline. `path` is kept
    // alongside `folder_uid` so a failed folder migration still leaves the entry
    // saying where it pointed instead of holding a dead uid.
    rows.push(leaf(REDIRECT_BLOCK_UIDS.folder, 'path', 'single_line_text'));
    rows.push(leaf(REDIRECT_BLOCK_UIDS.folder, 'folder_uid', 'single_line_text'));
  }

  return rows;
}

/**
 * A reference target that couldn't be resolved, collected for logging.
 *
 * These are not code failures — they're items the Sitecore export didn't include, or
 * items whose template never became a content type. Either way the migration can't
 * emit a reference, so they're reported rather than silently dropped: a silent skip
 * reads as "everything migrated" when it didn't.
 */
export interface UnresolvedReference {
  entryUid: string;
  entryTitle?: string;
  fieldKey: string;
  sitecoreUid: string;
  reason: 'not-in-package' | 'template-not-migrated';
}

export function describeUnresolved(u: UnresolvedReference) {
  const where = u.entryTitle ? `"${u.entryTitle}" (${u.entryUid})` : u.entryUid;
  const why =
    u.reason === 'not-in-package'
      ? 'the target item is not present in the export'
      : "the target's template was not migrated as a content type";
  return `Reference ${u.sitecoreUid} on field "${u.fieldKey}" of entry ${where} was skipped: ${why}.`;
}

/**
 * Convert one resolved target into the entry-side value for the union block field.
 * Returns null when nothing should be written (unresolved, or a block the schema
 * doesn't contain).
 */
export function redirectTargetToEntryValue(
  target: ResolvedRedirectTarget
): Record<string, any> | null {
  switch (target.kind) {
    case 'entry':
      if (!target.contentTypeUid) return null;
      return {
        [REDIRECT_BLOCK_UIDS.entry]: {
          target: [
            { uid: idToAssetUid(target.sitecoreUid), _content_type_uid: target.contentTypeUid },
          ],
        },
      };
    case 'asset':
      return { [REDIRECT_BLOCK_UIDS.asset]: { target: target.assetUid ?? null } };
    case 'folder':
      return {
        [REDIRECT_BLOCK_UIDS.folder]: {
          path: target.folderPath ?? '',
          folder_uid: target.folderUid ?? '',
        },
      };
    default:
      return null;
  }
}