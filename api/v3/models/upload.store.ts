import fs from "fs";
import path from "path";

import { ManifestRow } from "../services/bundle.service.js";

/**
 * Persists uploaded export bundles + parsed metadata under the standalone v3
 * data dir (`<V3_DATA_DIR|database-v3>/uploads/`). The raw `.zip` is kept for
 * the export job to extract; the sidecar JSON holds the manifest the modules
 * endpoint reads. Retention/cleanup is a follow-up (trd.md TQ-4).
 */
export interface UploadMeta {
  sourceId: string;
  fileName: string;
  sizeBytes: number;
  contentVersion?: number;
  modules: Record<string, number>;
  manifest: ManifestRow[];
  createdAt: string;
}

const baseDir = process.env.V3_DATA_DIR
  ? path.resolve(process.env.V3_DATA_DIR)
  : path.join(process.cwd(), "database-v3");
const UPLOAD_DIR = path.join(baseDir, "uploads");

const ensureDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

const zipPath = (sourceId: string) => path.join(UPLOAD_DIR, `${sourceId}.zip`);
const metaPath = (sourceId: string) => path.join(UPLOAD_DIR, `${sourceId}.json`);

export const saveUpload = (
  sourceId: string,
  zipBuffer: Buffer,
  meta: UploadMeta
): void => {
  ensureDir();
  fs.writeFileSync(zipPath(sourceId), zipBuffer);
  fs.writeFileSync(metaPath(sourceId), JSON.stringify(meta, null, 2));
};

export const getUploadMeta = (sourceId: string): UploadMeta | null => {
  try {
    return JSON.parse(fs.readFileSync(metaPath(sourceId), "utf8")) as UploadMeta;
  } catch {
    return null;
  }
};

/** Absolute path to the stored bundle (used by the export job). */
export const getUploadZipPath = (sourceId: string): string => zipPath(sourceId);
