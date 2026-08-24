import fs from 'fs';
import * as cheerio from 'cheerio';

export interface AssetMappingRow {
  id: string;
  otherCmsAssetUid: string;
  filename: string;
  title: string;
  file_size: number | string;
  assetPath: string;
  isUpdate: boolean;
}

const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * WordPress WXR exports are parsed upstream into JSON before reaching here, so
 * we load the file exactly like extractEntries/extractItems do: read the file
 * and JSON.parse it, then walk rss.channel.item. Media are `item` elements with
 * `wp:post_type === 'attachment'`.
 */
const getAssetId = (item: any): string => {
  const postId = item?.['wp:post_id'];
  if (postId != null && String(postId).trim() !== '') {
    return String(postId).trim();
  }
  const guid = item?.guid?.text ?? item?.guid;
  return guid != null ? String(guid).trim() : '';
};

const getAssetUrl = (item: any): string => {
  const url = item?.['wp:attachment_url'] ?? item?.guid?.text ?? item?.guid;
  return url != null ? String(url).trim() : '';
};

const getFilename = (item: any, assetUrl: string): string => {
  const fromUrl = assetUrl?.split?.('/')?.pop?.();
  if (typeof fromUrl === 'string' && fromUrl.trim() !== '') {
    return fromUrl.trim();
  }
  const title = item?.title?.text ?? item?.title;
  return typeof title === 'string' ? title.trim() : '';
};

const getTitle = (item: any, filename: string): string => {
  const title = item?.title?.text ?? item?.title;
  if (typeof title === 'string' && title.trim() !== '') {
    return title.trim();
  }
  return filename.split('.').slice(0, -1).join('.') || filename;
};

// Mirrors wordpress.service.ts's isValidImageUrl — keep in sync.
const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  if (url.trim().startsWith('data:')) return false;
  if (url.trim().length < 5) return false;
  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('mailto:') || lowerUrl.startsWith('tel:')) {
    return false;
  }
  return true;
};

// Mirrors wordpress.service.ts's toCheckUrl — keep in sync.
const toCheckUrl = (url: string, baseSiteUrl: string): string => {
  const validPattern = /^(https?:\/\/|www\.)/;
  return validPattern.test(url) ? url : `${baseSiteUrl}${url.replace(/^\/+/, '')}`;
};

/**
 * Finds embedded image URLs in a post's content:encoded, covering the img
 * src/data-src/srcset cases — the common WordPress block-editor patterns.
 * Mirrors (a practical subset of) wordpress.service.ts's
 * extractImageUrlsFromContent, which is what the actual migration run scans
 * to decide which content-embedded images to download. Keep in sync: if that
 * function's matching rules grow, this should too, or rows will exist here
 * for images the real run doesn't find (or vice versa).
 */
const extractImageUrlsFromContent = (htmlContent: string, baseSiteUrl: string): string[] => {
  if (!htmlContent || typeof htmlContent !== 'string') return [];
  const imageUrls = new Set<string>();
  try {
    const $ = cheerio.load(htmlContent);
    $('img').each((_, element) => {
      const el = $(element);
      const src = el.attr('src');
      if (src && isValidImageUrl(src)) {
        const fullUrl = toCheckUrl(src, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) imageUrls.add(fullUrl);
      }
      const dataSrc = el.attr('data-src');
      if (dataSrc && isValidImageUrl(dataSrc)) {
        const fullUrl = toCheckUrl(dataSrc, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) imageUrls.add(fullUrl);
      }
      const srcset = el.attr('srcset');
      if (srcset) {
        srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).forEach((url) => {
          if (isValidImageUrl(url)) {
            const fullUrl = toCheckUrl(url, baseSiteUrl);
            if (isValidImageUrl(fullUrl)) imageUrls.add(fullUrl);
          }
        });
      }
    });
  } catch {
    // Malformed content:encoded — treat as no embedded images rather than failing extraction.
  }
  return Array.from(imageUrls);
};

/**
 * Derives the same {uid, filename, title} a content-embedded image gets when
 * the real migration run downloads it via wordpress.service.ts's
 * saveAssetFromUrl. That function's customId (filename without extension,
 * dashes to underscores, lowercased) is what ends up as the key in
 * uid-mapping.json — otherCmsAssetUid must match it verbatim or the row can
 * never resolve a Contentstack uid, the same class of bug fixed for formal
 * attachment items. Unlike those, this is NOT prefixed with `assets_`.
 */
const parseContentAssetUrl = (url: string): { uid: string; filename: string; title: string } | null => {
  const originalName = url.split('/').pop()?.split('?')[0] || '';
  if (!originalName) return null;
  const nameWithoutExt = originalName.includes('.')
    ? originalName.substring(0, originalName.lastIndexOf('.'))
    : originalName;
  const uid = nameWithoutExt.replace(/-/g, '_').toLowerCase();
  if (!uid) return null;
  return { uid, filename: originalName, title: nameWithoutExt };
};

const extractAssets = async (filePath: string): Promise<AssetMappingRow[]> => {
  const rows: AssetMappingRow[] = [];
  try {
    const rawData = await fs.promises.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);
    const items = normalizeArray(jsonData?.rss?.channel?.item);
    const baseSiteUrl = jsonData?.rss?.channel?.['wp:base_site_url'] ?? jsonData?.channel?.['wp:base_site_url'] ?? '';

    const seenIds = new Set<string>();
    // Absolute URLs already represented by a formal attachment item — skip these when scanning
    // content so the same picture doesn't get a second row (it would also become a second,
    // duplicate Contentstack asset on the actual migration run — a pre-existing issue in
    // getAllAssets this extraction shouldn't compound).
    const attachmentUrls = new Set<string>();

    for (const item of items) {
      if (item?.['wp:post_type'] !== 'attachment') {
        continue;
      }

      const id = getAssetId(item);
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);

      const assetPath = getAssetUrl(item);
      const filename = getFilename(item, assetPath);
      const title = getTitle(item, filename);

      if (assetPath) {
        attachmentUrls.add(toCheckUrl(assetPath, baseSiteUrl));
      }

      rows.push({
        id,
        // Must match the `assets_<wp:post_id>` key wordpress.service.ts uses as the
        // asset's customId/uid when staging it for CLI import — that's the key the CLI
        // writes back into uid-mapping.json, and the read path looks this up verbatim.
        otherCmsAssetUid: `assets_${id}`,
        filename,
        title,
        file_size: '',
        assetPath,
        isUpdate: false,
      });
    }

    // Images embedded in post content but never declared as a formal attachment item still get
    // migrated (wordpress.service.ts's getAllAssets scans content:encoded independently of the
    // attachment-item pass) — without this, the Map Entry Assets screen never had a row for them
    // at all, on any iteration, even though they exist as real Contentstack assets afterward.
    const seenContentUids = new Set<string>();
    for (const item of items) {
      const contentEncoded = item?.['content:encoded'];
      if (!contentEncoded || typeof contentEncoded !== 'string') continue;

      const imageUrls = extractImageUrlsFromContent(contentEncoded, baseSiteUrl);
      for (const url of imageUrls) {
        if (attachmentUrls.has(url)) continue;

        const parsed = parseContentAssetUrl(url);
        if (!parsed || seenContentUids.has(parsed.uid)) continue;
        seenContentUids.add(parsed.uid);

        rows.push({
          id: parsed.uid,
          otherCmsAssetUid: parsed.uid,
          filename: parsed.filename,
          title: parsed.title,
          file_size: '',
          assetPath: url,
          isUpdate: false,
        });
      }
    }

    return rows;
  } catch (error: any) {
    console.error('Error while extracting WordPress assets:', error?.message || error);
    return rows;
  }
};

export default extractAssets;
