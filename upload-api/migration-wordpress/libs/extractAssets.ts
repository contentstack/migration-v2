import fs from 'fs';

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

const extractAssets = async (filePath: string): Promise<AssetMappingRow[]> => {
  const rows: AssetMappingRow[] = [];
  try {
    const rawData = await fs.promises.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);
    const items = normalizeArray(jsonData?.rss?.channel?.item);

    const seenIds = new Set<string>();

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

      rows.push({
        id,
        otherCmsAssetUid: id,
        filename,
        title,
        file_size: '',
        assetPath,
        isUpdate: false,
      });
    }

    return rows;
  } catch (error: any) {
    console.error('Error while extracting WordPress assets:', error?.message || error);
    return rows;
  }
};

export default extractAssets;