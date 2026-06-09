// upload-api/src/validators/<cms>/index.ts
//
// NOTE: validators are DIRECTORIES, not single files. Create
// `upload-api/src/validators/<cms>/index.ts` and import it in
// `validators/index.ts` as `import <cms>Validator from './<cms>';` (default export).
//
// ⚠️ The `data` you receive depends on the upload branch (see
// reference/upload-flow.md). The validator switch key is `${type}-${extension}`:
//   - xml   → data is a string (raw XML)              key: <cms>-xml
//   - json  → data is a string (raw JSON)             key: <cms>-json
//   - zip   → data is a JSZip object                  key: <cms>-zip
//   - sql   → data is a DB-connection config object   key: <cms>-sql
//   - folder→ data is a DIRECTORY PATH string         key: <cms>-folder
//   (archives like .tar.gz are extracted by upload-api and re-enter the FOLDER
//    branch, so a folder-shaped CMS only needs the `<cms>-folder` case.)
//
// Pick the branch your CMS uses and delete the rest. Below is the FOLDER-shaped
// default (mirrors the shipped validators/sanity). For a single-file JSON export,
// see the JSON example at the bottom.
import fs from 'fs';
import path from 'path';

/** Sniff the first record of a data file to confirm it looks like this CMS. */
function firstRecordLooksValid(text: string): boolean {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return false;
  try {
    const doc = JSON.parse(firstLine); // NDJSON: first line is one doc
    // TODO: assert a field that identifies this CMS's records.
    return typeof doc?._type === 'string' || typeof doc?._id === 'string';
  } catch {
    return false; // not single-line JSON — adapt if your data file is a JSON array
  }
}

/** BFS for the export's primary data file under a directory. */
function findDataFile(dir: string, targetName = 'data.ndjson', targetExt = '.ndjson'): string {
  const queue: string[] = [dir];
  let firstByExt = '';
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
      else if (entry.name === targetName) return full;
      else if (targetExt && entry.name.endsWith(targetExt) && !firstByExt) firstByExt = full;
    }
  }
  return firstByExt;
}

const <cms>Validator = async ({ data }: any): Promise<boolean> => {
  try {
    if (data == null) return false;

    // FOLDER branch: `data` is the extracted directory (or file) path string.
    if (typeof data === 'string') {
      const target = data.trim();
      if (!target) return false;
      if (fs.existsSync(target)) {
        const stat = fs.statSync(target);
        const dataFile = stat.isDirectory() ? findDataFile(target) : target;
        if (!dataFile || !fs.existsSync(dataFile)) return false;
        return firstRecordLooksValid(fs.readFileSync(dataFile, 'utf8'));
      }
      // Not a path — treat the string itself as the data content.
      return firstRecordLooksValid(target);
    }

    // Fallback shapes (Buffer / parsed array) — accept if non-empty.
    if (Buffer.isBuffer(data)) return data.length > 0;
    if (Array.isArray(data)) return data.length > 0;

    return true;
  } catch (err) {
    console.error('Error : ', err);
    return false;
  }
};

export default <cms>Validator;

// --- Alternative: single-file JSON export (key `<cms>-json`, data is a string) ---
// const <cms>Validator = (data: string) => {
//   try {
//     const parsed = JSON.parse(data);
//     const documents = Array.isArray(parsed) ? parsed : parsed?.documents;
//     if (!documents?.length) return { status: 400, data: 'Empty <cms> export.' };
//     return { status: 200, data: documents };
//   } catch (err: any) {
//     return { status: 400, data: err?.message ?? 'Invalid <cms> export.' };
//   }
// };
