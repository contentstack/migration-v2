// Shape of a Contentstack asset folder entry as written into the assets index
// (the same map that holds assets, keyed by uid).
export interface AssetFolder {
  uid: string;
  is_dir: true;
  name: string;
  parent_uid: string | null;
  // Sitecore-side provenance, kept so a post-migration script can resolve a
  // Sitecore folder reference to the Contentstack folder uid created here.
  sitecorePath: string;
  sitecoreUid: string | null;
}

// One row of the folder mapper written to disk for post-migration lookups.
// `path` is the authoritative key: it exists for every folder, whereas
// `sitecoreUid` is only recoverable for folders some child names via parentid.
export interface AssetFolderMapping {
  path: string;
  uid: string;
  parent_uid: string | null;
  name: string;
  sitecoreUid: string | null;
}