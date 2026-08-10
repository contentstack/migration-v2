// A Sitecore reference resolved to what it actually points at. Sitecore types fields
// like `redirect to item` as a single item picker, but the picked item may be an entry,
// a media asset, or a media folder — three different things in Contentstack.
export type RedirectTargetKind = 'entry' | 'asset' | 'folder' | 'unresolved';

export interface ResolvedRedirectTarget {
  kind: RedirectTargetKind;
  // The Sitecore GUID as written in the field, kept for logging and for the
  // post-migration folder-uid rewrite.
  sitecoreUid: string;
  // Populated for `entry`: the Contentstack content type uid the target maps to.
  contentTypeUid?: string;
  // Populated for `asset`: the Contentstack asset uid.
  assetUid?: string;
  // Populated for `folder`: the media-library-relative path, plus the Contentstack
  // folder uid when the folder mapper already knows it.
  folderPath?: string;
  folderUid?: string;
  // Populated for `unresolved`, so the log can say which of the two gaps this was.
  reason?: 'not-in-package' | 'template-not-migrated';
}

// One entry in the index that lets a Sitecore GUID be classified without re-walking
// the package. Built once during extraction.
export interface SitecoreItemIndexEntry {
  // The item's template name, used only for logging and media-folder detection.
  template: string;
  // The item's template GUID (`tid`). This is the lookup key for contentTypeKey.json,
  // which is keyed by template id — not template name.
  templateId: string;
  // Media-library-relative path for media items; undefined for content items.
  mediaPath?: string;
  isMediaFolder: boolean;
}