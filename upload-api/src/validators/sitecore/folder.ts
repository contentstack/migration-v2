/*
sitecore Validator — already-extracted folder

Bypass path: the user points localPath at a Sitecore package that has already been
unzipped on disk, so there is nothing to extract into extracted_files. We validate
the folder in place and the same path is handed straight to the mapper.
*/
import fs from 'fs';
import path from 'path';
import { SitecoreFolderValidatorProps } from './folder.interface';

const SITECORE_FOLDERS = ['installer', 'items', 'metadata', 'properties'];
const REQUIRED_MINIMUM = ['items', 'metadata'];

// Only look a couple of levels down: a package either has the folders at its root,
// or nested one level under a wrapper dir (e.g. MergedPackage/package/items).
const MAX_DEPTH = 2;

async function collectSitecoreFolders(
  dir: string,
  found: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > MAX_DEPTH || REQUIRED_MINIMUM.every((folder) => found.has(folder))) return;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (SITECORE_FOLDERS.includes(entry.name)) {
      found.add(entry.name);
      continue;
    }

    await collectSitecoreFolders(path.join(dir, entry.name), found, depth + 1);
  }
}

async function sitecoreFolderValidator({ data }: SitecoreFolderValidatorProps) {
  try {
    if (!data) return false;

    const stats = await fs.promises.stat(data);
    if (!stats.isDirectory()) return false;

    const foundFolders = new Set<string>();
    await collectSitecoreFolders(data, foundFolders);

    return REQUIRED_MINIMUM.every((folder) => foundFolders.has(folder));
  } catch (err) {
    console.info('🚀 ~ sitecoreFolderValidator ~ err:', err);
    return false;
  }
}

export default sitecoreFolderValidator;