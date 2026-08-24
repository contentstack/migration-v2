import fs from 'fs';
import path from 'path';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { getMimeTypeFromExtension } from '../../utils/mimeTypes.js';
import { resolveExportRoot, readJson } from './interface.js';

const {
  DATA,
  ASSETS_DIR_NAME,
  ASSETS_FILE_NAME,
  ASSETS_SCHEMA_FILE,
  ASSETS_FOLDER_FILE_NAME,
} = MIGRATION_DATA_CONFIG;

/**
 * Register DatoCMS assets as Contentstack assets. Runs BEFORE createEntry
 * (asset records must be on disk when entries resolve `file`/`gallery`
 * fields). DatoCMS ships the binaries locally in `assets/` (unlike
 * WordPress/Contentful, which only carry a CDN url) — so bytes are COPIED,
 * not downloaded, per the same local-copy pattern entry-creation.md describes
 * for exports that ship their own files.
 *
 * Local filename <-> assets.json entry match is deterministic (verified
 * against the sample, see TRD): `u_{assets.json id}__{basename}.{ext}`.
 */
export async function createAssets(
  file_path: string,
  packagePath: string,
  destinationStackId: string,
  _projectId: string,
  isTest = false,
): Promise<void> {
  const assetsSave = path.join(DATA, destinationStackId, ASSETS_DIR_NAME);
  await fs.promises.mkdir(path.join(assetsSave, 'files'), { recursive: true });

  // ⚠️ BOTH manifest files are required — the CS CLI reads assets.json first;
  // if missing, indexerCount = 0 and the upload loop never runs at all.
  await fs.promises.writeFile(
    path.join(assetsSave, ASSETS_FILE_NAME),
    JSON.stringify({ '1': ASSETS_SCHEMA_FILE }, null, 4),
  );
  await fs.promises.writeFile(path.join(assetsSave, ASSETS_FOLDER_FILE_NAME), '{}');

  const index: Record<string, any> = {};

  try {
    const root = resolveExportRoot(file_path, packagePath);
    const assetsDir = path.join(root, 'assets');
    let assets: any[] = readJson(path.join(root, 'assets.json'));
    if (isTest) assets = assets.slice(0, 10);

    const localFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

    for (const asset of assets) {
      const uid = `assets_${asset.id}`;
      const prefix = `u_${asset.id}__`;
      const localFilename = localFiles.find((f) => f.startsWith(prefix));
      if (!localFilename) {
        console.warn(`[datocms] asset ${asset.id} (${asset.filename}) has no matching local file under assets/ — skipped`);
        continue;
      }

      const destDir = path.join(assetsSave, 'files', uid);
      await fs.promises.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, asset.filename || localFilename);
      await fs.promises.copyFile(path.join(assetsDir, localFilename), destPath);

      const size = (await fs.promises.stat(destPath)).size;
      const ext = (asset.format || path.extname(asset.filename || '').replace('.', '') || '').toLowerCase();

      // DatoCMS keeps alt text and a human title per locale under
      // `default_field_metadata`. Both have direct Contentstack homes and were
      // previously discarded: alt text is accessibility/SEO copy someone wrote by
      // hand, and without the title every asset reads as its raw filename.
      // Keyed by DatoCMS locale, not the destination locale code — prefer `en`,
      // else the first entry that actually carries text.
      const meta: Record<string, any> = asset.default_field_metadata ?? {};
      const localeMeta =
        meta.en ?? Object.values(meta).find((m: any) => m?.alt || m?.title) ?? Object.values(meta)[0] ?? {};
      const alt = typeof (localeMeta as any)?.alt === 'string' ? (localeMeta as any).alt.trim() : '';
      const assetTitle = typeof (localeMeta as any)?.title === 'string' ? (localeMeta as any).title.trim() : '';
      // `tags` are author-curated; `smart_tags` are DatoCMS's AI guesses and are
      // deliberately left out — see docs/features/datocms-connector/migration-decisions.md
      const tags = Array.isArray(asset.tags) ? asset.tags.filter((t: any) => typeof t === 'string' && t.trim()) : [];

      index[uid] = {
        uid,
        urlPath: `/assets/${uid}`,
        status: true,
        content_type: getMimeTypeFromExtension(ext) || asset.mime_type || 'application/octet-stream',
        file_size: `${size}`,
        tag: tags,
        filename: asset.filename || localFilename,
        url: '',
        is_dir: false,
        parent_uid: null,
        _version: 1,
        title: assetTitle || asset.filename || localFilename,
        publish_details: [],
        description: alt,
      };
    }
  } catch (err: any) {
    console.error('[datocms] createAssets failed:', err?.message ?? err);
  }

  await fs.promises.writeFile(path.join(assetsSave, ASSETS_SCHEMA_FILE), JSON.stringify(index, null, 4));
}
