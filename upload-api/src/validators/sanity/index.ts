/* eslint-disable @typescript-eslint/no-explicit-any */
//
// Pre-flight validation for a Sanity dataset export (folder upload).
//
// A Sanity export bundles `data.ndjson` (newline-delimited JSON documents) with
// an `assets.json` and an `images/` folder. For folder uploads the upload-api
// hands the validator the local directory path (see routes/index.ts: fileExt
// 'folder' → handleFileProcessing(fileExt, localPath, ...)). We confirm a
// `data.ndjson` exists and its first document looks like a Sanity record. The
// authoritative parse happens later in migration-sanity's extractContentTypes.
import fs from 'fs';
import path from 'path';

function firstDocLooksLikeSanity(ndjsonText: string): boolean {
  const firstLine = ndjsonText
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return false;
  try {
    const doc = JSON.parse(firstLine);
    return typeof doc?._type === 'string' || typeof doc?._id === 'string';
  } catch {
    return false;
  }
}

/** Breadth-first search for a `data.ndjson` (or any *.ndjson) under a directory. */
function findNdjson(dir: string): string {
  const queue: string[] = [dir];
  let firstNdjson = '';
  while (queue.length) {
    const current = queue.shift() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.name === 'data.ndjson') return full;
      else if (entry.name.endsWith('.ndjson') && !firstNdjson) firstNdjson = full;
    }
  }
  return firstNdjson;
}

async function sanityValidator({ data }: any): Promise<boolean> {
  try {
    if (data == null) return false;

    // Normal case: `data` is the uploaded directory (or file) path string.
    if (typeof data === 'string') {
      const target = data.trim();
      if (!target) return false;

      if (fs.existsSync(target)) {
        const stat = fs.statSync(target);
        const ndjsonPath = stat.isDirectory() ? findNdjson(target) : target;
        if (!ndjsonPath || !fs.existsSync(ndjsonPath)) return false;
        return firstDocLooksLikeSanity(fs.readFileSync(ndjsonPath, 'utf8'));
      }

      // Not a path — treat the string itself as NDJSON content.
      return firstDocLooksLikeSanity(target);
    }

    // Fallback shapes (buffer / parsed array) — accept if non-empty.
    if (Buffer.isBuffer(data)) return data.length > 0;
    if (Array.isArray(data)) return data.length > 0;

    return true;
  } catch (err) {
    console.error('Error : ', err);
    return false;
  }
}

export default sanityValidator;
