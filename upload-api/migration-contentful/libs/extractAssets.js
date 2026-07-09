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
 * @returns {Array<{id:string,otherCmsAssetUid:string,filename:string,title:string,file_size:(number|string),assetPath:string,isUpdate:boolean}>}
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

      const filename =
        (typeof file?.fileName === 'string' && file?.fileName) || title || '';
      const fileSize = file?.details?.size ?? '';
      // Contentful serves assets from a protocol-relative CDN URL ("//...");
      // normalize to https so downstream consumers get an absolute URL.
      let assetPath = typeof file?.url === 'string' ? file?.url : '';
      if (assetPath.startsWith('//')) {
        assetPath = `https:${assetPath}`;
      }

      seenIds.add(id);

      rows.push({
        id,
        otherCmsAssetUid: id,
        filename,
        title: title || filename,
        file_size: fileSize,
        assetPath,
        isUpdate: false,
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