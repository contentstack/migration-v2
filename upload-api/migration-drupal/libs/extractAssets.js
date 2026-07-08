'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Builds the assetMapping array consumed by putTestData on the main API to
 * populate the asset_mapper DB shown on the AssetMapper UI — same flow/shape
 * as AEM/Sitecore/Contentful/WordPress.
 *
 * Drupal reads from MySQL (not files). Files live in the `file_managed` table
 * (fid, uuid, filename, uri, filesize, filemime). We surface every managed
 * file, deduped by its Drupal file id, using the fid as the stable
 * id/otherCmsAssetUid so it lines up across delta iterations.
 *
 * Row shape mirrors migration-sitecore/libs/extractAssets.js:
 *   { id, otherCmsAssetUid, filename, title, file_size, assetPath, isUpdate }
 */

const { dbConnection } = require('../utils/helper');

/**
 * Derive a display-friendly path from the Drupal file uri.
 * e.g. "public://2023-01/photo.jpg" -> "public/2023-01"
 */
const assetPathFromUri = (uri, filename) => {
  if (!uri || typeof uri !== 'string') {
    return '';
  }
  // Strip the stream wrapper scheme ("public://", "private://", "s3://", ...)
  let cleaned = uri.replace(/^[a-z0-9]+:\/\//i, '');
  // Drop the filename to leave only the directory portion
  if (filename && cleaned.endsWith(filename)) {
    cleaned = cleaned.slice(0, cleaned.length - filename.length);
  }
  return cleaned.replace(/\/+$/, '');
};

/**
 * @param {Object} config - Migration config; must contain config.mysql (DB
 *   connection details). config.assetsConfig is accepted but unused for now.
 * @returns {Promise<Array<object>>} assetMapping rows
 */
const extractAssets = async (config) => {
  const rows = [];
  let connection;

  try {
    connection = dbConnection(config);

    // Bound the result set so a very large media library can't be pulled fully into
    // memory. Configurable via assetsConfig.maxAssets; parameterized to keep it out of
    // the SQL string.
    const maxAssets = Number(config?.assetsConfig?.maxAssets) || 100000;
    const query = `
      SELECT fid, uuid, filename, uri, filesize, filemime
      FROM file_managed
      ORDER BY fid
      LIMIT ?
    `;
    const [results] = await connection.promise().query(query, [maxAssets]);

    if (Array.isArray(results) && results.length === maxAssets) {
      console.warn(
        `extractAssets (Drupal): hit maxAssets cap of ${maxAssets}; some assets may be omitted`
      );
    }

    const seenIds = new Set();

    for (const file of results || []) {
      if (!file) {
        continue;
      }

      const id = file?.fid != null ? String(file?.fid) : '';
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);

      const filename = file?.filename ? String(file?.filename) : `File ${id}`;

      rows.push({
        id,
        otherCmsAssetUid: id,
        filename,
        title: filename,
        file_size: file?.filesize != null ? String(file?.filesize) : '',
        assetPath: assetPathFromUri(file?.uri, filename),
        isUpdate: false
      });
    }

    console.info(`extractAssets (Drupal): ${rows.length} asset(s)`);
    return rows;
  } catch (err) {
    console.error('extractAssets (Drupal) error:', err?.message || err);
    return rows;
  } finally {
    if (connection) {
      try {
        connection.end();
      } catch (endErr) {
        console.error('extractAssets (Drupal) connection close error:', endErr?.message || endErr);
      }
    }
  }
};

module.exports = extractAssets;