import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import read from 'fs-readdir-recursive';
import { CONSTANTS } from '../../constant';
import { readFiles } from '../../helper';

export interface AssetMappingRow {
  id: string;
  otherCmsAssetUid: string;
  filename: string;
  title: string;
  file_size: number | string;
  assetPath: string;
  isUpdate: boolean;
}

/**
 * Discovery and uid derivation here intentionally mirror createAssets in
 * api/src/services/aem.service.ts: only assets actually referenced by page
 * model JSONs are imported, deduped by filename, with a stable uid cascade of
 * jcr:uuid → sha256(asset.path) → none. Rows whose uid cannot be derived
 * stably are skipped — they get a random uid at migration time and cannot be
 * tracked across delta iterations.
 */
const isImageType = (value: string): boolean =>
  /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(value);

const deepFlattenObject = (obj: any, prefix = '', res: any = {}) => {
  if (Array.isArray(obj) || (obj && typeof obj === 'object')) {
    const entries = Array.isArray(obj)
      ? obj.map((v, i) => [i, v])
      : Object.entries(obj);
    for (const [key, value] of entries) {
      const newKey = prefix ? `${prefix}.${key}` : `${key}`;
      if (value && typeof value === 'object') {
        deepFlattenObject(value, newKey, res);
      } else {
        res[newKey] = value;
      }
    }
  } else {
    res[prefix] = obj;
  }
  return res;
};

const deriveStableAssetUid = (metadata: any, usedUids: Set<string>): string => {
  const jcrUuid = metadata?._raw?.assetNode?.['jcr:uuid'];
  let uid =
    typeof jcrUuid === 'string' && jcrUuid.trim() !== ''
      ? jcrUuid.replace(/-/g, '').toLowerCase()
      : '';
  if (!uid || usedUids.has(uid)) {
    const assetPath = metadata?.asset?.path;
    uid =
      typeof assetPath === 'string' && assetPath.trim() !== ''
        ? createHash('sha256').update(assetPath).digest('hex').slice(0, 32)
        : '';
  }
  if (!uid || usedUids.has(uid)) {
    return '';
  }
  return uid;
};

const extractAssets = async (dirPath: string): Promise<AssetMappingRow[]> => {
  const templatesDir = path.resolve(dirPath);
  const damPath = path.resolve(path.join(templatesDir, CONSTANTS.AEM_DAM_DIR));
  const rows: AssetMappingRow[] = [];

  if (!fs.existsSync(damPath)) {
    return rows;
  }

  const damFiles = read(damPath).map((f) => path.join(damPath, f));
  const seenFilenames = new Set<string>();
  const usedUids = new Set<string>();

  for (const fileName of read(templatesDir)) {
    const filePath = path.join(templatesDir, fileName);
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    if (!fileName?.endsWith?.('.json')) {
      continue;
    }
    try {
      const parseData: any = await readFiles(filePath);
      if (!parseData || typeof parseData !== 'object') {
        continue;
      }
      const flatData = deepFlattenObject(parseData);

      for (const value of Object.values(flatData)) {
        if (typeof value !== 'string' || !isImageType(value)) {
          continue;
        }
        const lastSegment = value?.split?.('/')?.pop?.();
        if (typeof lastSegment !== 'string') {
          continue;
        }
        const firstJson = damFiles.find(
          (fp) => fp.includes(lastSegment) && fp.endsWith('.json')
        );
        if (!firstJson) {
          continue;
        }
        const metadata: any = await readFiles(firstJson);
        const filename = metadata?.asset?.name;
        if (typeof filename !== 'string' || seenFilenames.has(filename)) {
          continue;
        }
        seenFilenames.add(filename);

        const uid = deriveStableAssetUid(metadata, usedUids);
        if (!uid) {
          continue;
        }
        usedUids.add(uid);

        rows.push({
          id: uid,
          otherCmsAssetUid: uid,
          filename,
          title: filename.split('.').slice(0, -1).join('.') || filename,
          file_size: metadata?.download?.downloadedSize ?? '',
          assetPath: metadata?.asset?.path ?? '',
          isUpdate: false,
        });
      }
    } catch (err) {
      console.error(`🚀 ~ extractAssets ~ failed to process ${filePath}:`, err);
    }
  }
  return rows;
};

export default extractAssets;
