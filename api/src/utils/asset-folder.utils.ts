import crypto from 'crypto';
import type {
  AssetFolder,
  AssetFolderMapping,
} from './asset-folder.interface.js';

// Sitecore packages export media *items* and their blobs, but not the `media folder`
// items that hold them — only 339 of the ~2,331 folders in a typical package ship as
// real items. The directory layout, however, is complete: every media item sits at
// `<folder>/<...>/<item name>/{GUID}/<lang>/<version>/`. So the folder tree is rebuilt
// from those path segments rather than from folder items, and Sitecore GUIDs are
// attached opportunistically where a child names its parent via `parentid`.

// Sitecore's own path separator inside an exported package is always '/', including
// on Windows, because the paths come from the archive rather than the local fs.
const SEP = '/';

// `assetPath` (from AssetsPathSplitter) is the media-library-relative path *including*
// the item's own name directory and a trailing slash, e.g.
// "AppLanding/apple/" for an item named "apple" that lives directly in "AppLanding".
// The parent folder chain is therefore every segment except the last.
export function folderChainFromAssetPath(assetPath?: string): string[] {
  if (!assetPath || typeof assetPath !== 'string') return [];
  const segments = assetPath.split(SEP).filter(Boolean);
  // Drop the item's own name; an item directly under the media library root leaves [].
  return segments.slice(0, -1);
}

// Contentstack folder uids must be stable across runs so a re-migration maps the same
// Sitecore folder to the same uid. Derive them from the folder path rather than a
// counter or uuid, which would renumber whenever the walk order changed.
export function folderUidForPath(chain: string[]): string {
  return crypto
    .createHash('sha1')
    .update(chain.join(SEP).toLowerCase())
    .digest('hex')
    .slice(0, 19); // matches the length of Contentstack's own folder uids
}

/**
 * Build the Contentstack asset folder tree implied by the media items' paths.
 *
 * Every ancestor of every asset becomes a folder, so intermediate folders that hold
 * only other folders (and therefore have no asset naming them) still get created.
 *
 * @param assetPaths   one `assetPath` per media item, as produced by AssetsPathSplitter
 * @param sitecoreUids optional map of "folder/path" (lowercased) -> Sitecore GUID,
 *                     used only to record provenance on the created folder
 */
export function buildAssetFolders(
  assetPaths: (string | undefined)[],
  sitecoreUids: Record<string, string> = {}
): { folders: Record<string, AssetFolder>; mappings: AssetFolderMapping[] } {
  const folders: Record<string, AssetFolder> = {};

  for (const assetPath of assetPaths ?? []) {
    const chain = folderChainFromAssetPath(assetPath);
    // Create each ancestor in turn so parents always exist before their children.
    for (let depth = 1; depth <= chain.length; depth += 1) {
      const sub = chain.slice(0, depth);
      const uid = folderUidForPath(sub);
      if (folders[uid]) continue;
      const parentChain = sub.slice(0, -1);
      folders[uid] = {
        uid,
        is_dir: true,
        name: sub[sub.length - 1],
        // null means "top level" — Contentstack treats a null parent as the
        // asset root, so the media library root itself needs no folder.
        parent_uid: parentChain.length ? folderUidForPath(parentChain) : null,
        sitecorePath: sub.join(SEP),
        sitecoreUid: sitecoreUids[sub.join(SEP).toLowerCase()] ?? null,
      };
    }
  }

  const mappings: AssetFolderMapping[] = Object.values(folders).map((f) => ({
    path: f.sitecorePath,
    uid: f.uid,
    parent_uid: f.parent_uid,
    name: f.name,
    sitecoreUid: f.sitecoreUid,
  }));

  return { folders, mappings };
}

// The folder an asset belongs in: the leaf of its chain, or null when the asset sits
// at the media library root.
export function parentUidForAssetPath(assetPath?: string): string | null {
  const chain = folderChainFromAssetPath(assetPath);
  return chain.length ? folderUidForPath(chain) : null;
}

// Record a Sitecore GUID for a folder path. Two sources feed this:
//   1. a `media folder` item that did ship in the package — authoritative
//   2. a child item's `parentid`, which names its parent folder even when that
//      folder's own item is absent
// The first source wins, so an authoritative id is never overwritten by an inferred one.
export function collectFolderUid(
  sitecoreUids: Record<string, string>,
  assetPath: string | undefined,
  guid: string | undefined,
  { authoritative }: { authoritative: boolean }
) {
  if (!guid) return;
  const chain = authoritative
    ? // A folder item's own assetPath ends with its own name, which *is* the folder.
      folderChainFromAssetPath(assetPath).concat(
        (assetPath ?? '').split(SEP).filter(Boolean).slice(-1)
      )
    : // A non-folder item's parent is the leaf of its chain.
      folderChainFromAssetPath(assetPath);
  if (!chain.length) return;
  const key = chain.join(SEP).toLowerCase();
  if (authoritative || !(key in sitecoreUids)) {
    sitecoreUids[key] = guid;
  }
}