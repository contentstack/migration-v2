const path = require('path');
const fs = require('fs');
const read = require('fs-readdir-recursive');

/**
 * Discovery and uid derivation here intentionally mirror createAssets in
 * api/src/services/sitecore.service.ts: assets are read from the Sitecore
 * media library (items/master/sitecore/media library), deduped by uid, with the
 * uid derived from the item id ({GUID} stripped of braces/hyphens, lowercased)
 * so it stays stable across delta iterations. Only assets whose blob is present
 * in blob/master are surfaced, matching what migration actually imports.
 *
 * Returns an assetMapping array consumed by putTestData on the main API to
 * populate the asset_mapper DB shown on the AssetMapper UI.
 */
const idCorrector = (id) => {
  const newId = id?.replace(/[-{}]/g, () => '');
  return newId ? newId.toLowerCase() : id;
};

const AssetsPathSplitter = (filePath, id) => {
  let newPath = filePath?.split(id)?.[0];
  if (newPath?.includes('media library/')) {
    newPath = newPath?.split('media library/')?.[1];
  }
  return newPath ?? '';
};

const extractAssets = async (dirPath) => {
  const rows = [];

  const folderName = path.join(
    dirPath,
    'items',
    'master',
    'sitecore',
    'media library'
  );
  if (!fs.existsSync(folderName)) {
    return rows;
  }

  const blobPath = path.join(dirPath, 'blob', 'master');
  const blobFiles = fs.existsSync(blobPath) ? read(blobPath) : [];
  const seenUids = new Set();

  for (const file of read(folderName)) {
    if (!file?.endsWith?.('data.json')) {
      continue;
    }
    try {
      const data = await fs.promises.readFile(
        path.join(folderName, file),
        'utf8'
      );
      const jsonAsset = JSON.parse(data);

      const itemId = jsonAsset?.item?.$?.id;
      const uid = idCorrector(itemId);
      if (!uid || seenUids.has(uid)) {
        continue;
      }

      const assetPath = AssetsPathSplitter(file, itemId);

      const metaData = {};
      jsonAsset?.item?.fields?.field?.forEach?.((field) => {
        if (field?.$?.key === 'blob' && field?.$?.type === 'attachment') {
          metaData.id = field?.content?.replace(/[{}]/g, '')?.toLowerCase();
        }
        if (field?.$?.key === 'extension') {
          metaData.extension = field?.content;
        }
        if (field?.$?.key === 'size') {
          metaData.size = field?.content;
        }
      });

      // Only surface assets whose blob actually ships in the package — matches
      // what migration imports (it skips assets with a missing blob).
      const hasBlob =
        !!metaData.id && blobFiles.some((b) => b?.includes(metaData.id));
      if (!hasBlob) {
        continue;
      }

      seenUids.add(uid);

      const name = jsonAsset?.item?.$?.name;
      const filename = `${name}.${metaData.extension}`;

      rows.push({
        id: uid,
        otherCmsAssetUid: uid,
        filename,
        title: name,
        file_size: metaData.size ?? '',
        assetPath,
        isUpdate: false,
      });
    } catch (err) {
      console.error(`🚀 ~ extractAssets ~ failed to process ${file}:`, err);
    }
  }

  return rows;
};

module.exports = extractAssets;