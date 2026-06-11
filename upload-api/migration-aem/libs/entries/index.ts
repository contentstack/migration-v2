import path from 'path';
import read from 'fs-readdir-recursive';
import { CONSTANTS } from '../../constant';
import { readFiles } from '../../helper';

interface EntryMappingRow {
  id: string;
  contentTypeUid: string;
  entryName: string;
  language?: string;
  otherCmsEntryUid: string;
  otherCmsCTName: string;
  isUpdate: boolean;
}

/**
 * Mirrors uidCorrector in api/src/services/aem.service.ts. The otherCmsEntryUid
 * stored here must exactly equal the entry uid written into the import data at
 * migration time, otherwise the delta flow (entry-mapper ↔ uid-mapper lookup and
 * removeEntriesFromDatabase key matching) can never associate the two.
 */
const entryUidCorrector = (str: string): string =>
  str?.replace(/[^a-zA-Z0-9_]/g, '_')?.toLowerCase();

const isExperienceFragment = (data: any): boolean => {
  if (data?.templateType && data?.[':type']) {
    return (
      data?.templateType?.startsWith?.('xf-') ||
      data?.[':type']?.includes?.('components/xfpage')
    );
  }
  return false;
};

const getCurrentLocale = (parseData: any): string | undefined => {
  if (parseData?.language) {
    return parseData.language;
  } else if (parseData?.[':path']) {
    const segments = parseData[':path'].split('/');
    return segments[segments.length - 1];
  }
  return undefined;
};

/**
 * Walks the AEM page model JSON files and attaches an entryMapping array to each
 * matching content type, so the backend can populate entry-mapper.json and the
 * Entry Mapper UI can offer create-vs-update selection on delta iterations.
 *
 * Template resolution intentionally matches createEntry in the api's aem.service:
 * experience fragments map by title, pages by templateName then templateType.
 */
const extractEntries = async (dirPath: string, contentTypes: any[]): Promise<any[]> => {
  const templatesDir = path.resolve(dirPath);
  const damPath = path.resolve(path.join(templatesDir, CONSTANTS.AEM_DAM_DIR));
  const seenEntryUids = new Set<string>();

  for (const fileName of read(templatesDir)) {
    const filePath = path.join(templatesDir, fileName);
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    try {
      const parseData: any = await readFiles(filePath);
      if (!parseData || typeof parseData !== 'object') {
        continue;
      }
      const templateUid = isExperienceFragment(parseData)
        ? parseData?.title
        : parseData?.templateName ?? parseData?.templateType;
      if (!templateUid) {
        continue;
      }
      const contentType = contentTypes?.find?.(
        (element: any) => element?.otherCmsUid === templateUid
      );
      if (!contentType) {
        continue;
      }
      const modelId =
        typeof parseData?.id === 'string' && parseData.id.trim() !== ''
          ? entryUidCorrector(parseData.id)
          : '';
      // Entries without a stable page model id receive a random uid at migration
      // time and cannot be tracked across iterations, so they get no mapping row.
      // Duplicate ids likewise fall back to random uids on the migration side.
      if (!modelId || seenEntryUids.has(modelId)) {
        continue;
      }
      seenEntryUids.add(modelId);

      const row: EntryMappingRow = {
        id: modelId,
        contentTypeUid: contentType?.otherCmsUid,
        entryName: parseData?.title ?? parseData?.templateType,
        language: getCurrentLocale(parseData),
        otherCmsEntryUid: modelId,
        otherCmsCTName: templateUid,
        isUpdate: false,
      };
      if (!Array.isArray(contentType.entryMapping)) {
        contentType.entryMapping = [];
      }
      contentType.entryMapping.push(row);
    } catch (err) {
      console.error(`🚀 ~ extractEntries ~ failed to process ${filePath}:`, err);
    }
  }
  return contentTypes;
};

export default extractEntries;
