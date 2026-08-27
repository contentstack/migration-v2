'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const { readFile } = require('../utils/helper');

/**
 * Extracts asset mapping rows from a Contentful export.
 *
 * Discovery mirrors extractEntries in this same package: the Contentful export
 * is a single JSON file read via readFile(cleanLocalPath), with top-level
 * `entries`, `locales` and `assets` arrays (standard `contentful-export`
 * output). Each asset carries a stable `sys.id` and locale-keyed fields, so
 * file metadata lives under `fields.file[locale]` and the title under
 * `fields.title[locale]`:
 *
 *   {
 *     sys: { id: '<stable-asset-id>' },
 *     fields: {
 *       title: { 'en-US': 'My Asset' },
 *       file: {
 *         'en-US': {
 *           fileName: 'my-asset.png',
 *           url: '//images.ctfassets.net/.../my-asset.png',
 *           details: { size: 12345 }
 *         }
 *       }
 *     }
 *   }
 *
 * We dedupe by sys.id and use it as both `id` and `otherCmsAssetUid` so the row
 * stays stable across delta iterations. Returned rows are consumed by
 * putTestData on the main API to populate the asset_mapper DB (AssetMapper UI),
 * matching the AEM/Sitecore AssetMappingRow shape.
 *
 * @param {string} cleanLocalPath - Path to the Contentful export JSON file.
 * @returns {Array<{id:string,otherCmsAssetUid:string,filename:string,title:string,file_size:(number|string),assetPath:string,isUpdate:boolean,hasSource:boolean}>}
 */
const extractAssets = (cleanLocalPath) => {
  try {
    const alldata = readFile(cleanLocalPath);
    const assets = alldata?.assets;
    const locales = Array.isArray(alldata?.locales)
      ? alldata?.locales?.map((locale) => locale?.code).filter(Boolean)
      : [];

    if (!assets || !Array?.isArray(assets) || assets?.length === 0) {
      console.info('No assets found in Contentful export');
      return [];
    }

    const rows = [];
    const seenIds = new Set();

    // Prefer a locale-keyed value, falling back to the first available locale.
    const pickLocalized = (field) => {
      if (!field || typeof field !== 'object') return undefined;
      for (const locale of locales) {
        if (field[locale] !== undefined) return field[locale];
      }
      const firstKey = Object.keys(field)[0];
      return firstKey !== undefined ? field[firstKey] : undefined;
    };

    for (const asset of assets) {
      const id = asset?.sys?.id;
      if (!id || seenIds.has(id)) {
        continue;
      }

      const file = pickLocalized(asset?.fields?.file);
      const titleValue = pickLocalized(asset?.fields?.title);
      const title = typeof titleValue === 'string' ? titleValue : '';

      // Contentful serves processed assets from a protocol-relative CDN URL ("//...")
      // in `.url`. Freshly-added, not-yet-processed assets only have `.upload`, an
      // absolute fetch URL. Prefer `.url` (with https normalization) and fall back
      // to `.upload` so newly-added assets aren't dropped from Map Entry.
      let assetPath = '';
      if (typeof file?.url === 'string' && file.url) {
        assetPath = file.url.startsWith('//') ? `https:${file.url}` : file.url;
      } else if (typeof file?.upload === 'string' && file.upload) {
        assetPath = file.upload;
      }

      const filename =
        (typeof file?.fileName === 'string' && file?.fileName) || title || '';
      const fileSize = file?.details?.size ?? '';

      seenIds.add(id);

      rows.push({
        id,
        otherCmsAssetUid: id,
        filename,
        title: title || filename,
        file_size: fileSize,
        assetPath,
        isUpdate: false,
        // No `.url` and no `.upload` at all — nothing the migration can ever download for
        // this asset. Still emit the row (rather than silently dropping it) so the user sees
        // *why* it's missing instead of the asset count on Map Entry mysteriously not
        // matching the source export. `hasSource: false` rows are always non-selectable.
        hasSource: Boolean(assetPath),
      });
    }

    console.info(`extractAssets: Extracted ${rows.length} Contentful assets`);

    return rows;
  } catch (err) {
    console.error('Error extracting Contentful assets:', err);
    return [];
  }
};

module.exports = extractAssets;