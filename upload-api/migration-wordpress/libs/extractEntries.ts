import fs from 'fs';
import path from 'path';
import config from '../config/index.json';

const { contentTypes: contentTypesConfig } = config?.modules;
const contentTypeFolderPath = path.resolve(config?.data, contentTypesConfig?.dirName);

const EXCLUDED_POST_TYPES = new Set(['attachment', 'wp_global_styles', 'wp_navigation']);

const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const idCorrector = (id: string) => {
  const normalized = id?.replace(/[-{}]/g, '');
  return normalized ? normalized.toLowerCase() : id;
};

const getEntryName = (item: any): string => {
  if (typeof item?.title === 'string' && item.title.trim()) {
    return item.title.trim();
  }
  if (item?.title?.text) {
    return String(item.title.text).trim();
  }
  if (typeof item?.['wp:post_name'] === 'string' && item['wp:post_name'].trim()) {
    return item['wp:post_name'].trim();
  }
  return 'Untitled Entry';
};

/**
 * All WordPress entry mapper UIDs use `posts_${...}` to align with api `wordpress.service.ts`
 * entry keys and uid-mapper lookups after migration.
 */
const getSourceEntryUid = (item: any): string => {
  const postId = item?.['wp:post_id'];
  if (postId != null && String(postId).trim() !== '') {
    return idCorrector(`posts_${postId}`);
  }
  const candidate =
    item?.guid?.text ?? item?.guid ?? item?.link ?? getEntryName(item);
  const base = idCorrector(String(candidate || 'entry'));
  return idCorrector(`posts_${base}`);
};

const getEntryLanguage = (item: any, channelLanguage?: string): string => {
  const postMeta = normalizeArray(item?.['wp:postmeta']);
  const languageMeta = postMeta.find((meta: any) => {
    const key = String(meta?.['wp:meta_key'] || '').toLowerCase();
    return key === 'language' || key === '_language' || key === 'locale' || key === '_locale';
  });

  const metaLanguage = languageMeta?.['wp:meta_value'];
  if (typeof metaLanguage === 'string' && metaLanguage.trim()) {
    return metaLanguage.trim();
  }

  if (typeof channelLanguage === 'string' && channelLanguage.trim()) {
    return channelLanguage.trim();
  }

  return 'en-us';
};

const extractEntries = async (filePath: string, contentTypeData: any[] = []) => {
  try {
    const rawData = await fs.promises.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);
    const items = normalizeArray(jsonData?.rss?.channel?.item);
    const channelLanguage = jsonData?.rss?.channel?.language;

    const groupedByType = items?.reduce((acc: Record<string, any[]>, item: any) => {
      const postType = item?.['wp:post_type'] || 'unknown';
      if (EXCLUDED_POST_TYPES.has(postType)) return acc;
      if (!acc[postType]) acc[postType] = [];
      acc[postType].push(item);
      return acc;
    }, {});

    const updatedTypes = contentTypeData?.map((ct) => ({ ...ct }));

    for (const [type, entries] of Object.entries(groupedByType)) {
      const entryMapping = normalizeArray(entries)
        .map((item: any) => {
          const otherCmsEntryUid = getSourceEntryUid(item);
          if (!otherCmsEntryUid) return null;
          return {
            contentTypeUid: type,
            entryName: getEntryName(item),
            otherCmsEntryUid,
            otherCmsCTName: type,
            language: getEntryLanguage(item, channelLanguage),
            isUpdate: false
          };
        })
        .filter(Boolean);

      const contentTypeFilePath = path.join(contentTypeFolderPath, `${type.toLowerCase()}.json`);
      if (fs.existsSync(contentTypeFilePath)) {
        const ctFile = JSON.parse(await fs.promises.readFile(contentTypeFilePath, 'utf8'));
        ctFile.entryMapping = entryMapping;
        await fs.promises.writeFile(contentTypeFilePath, JSON.stringify(ctFile, null, 4), 'utf8');
      }

      const index = updatedTypes.findIndex(
        (ct: any) =>
          ct?.otherCmsUid?.toLowerCase?.() === type.toLowerCase() ||
          ct?.contentstackUid?.toLowerCase?.() === type.toLowerCase()
      );
      if (index >= 0) {
        updatedTypes[index] = {
          ...updatedTypes[index],
          entryMapping
        };
      }
    }

    return updatedTypes;
  } catch (error: any) {
    console.error('Error while extracting WordPress entries:', error?.message || error);
    return contentTypeData;
  }
};

export default extractEntries;
