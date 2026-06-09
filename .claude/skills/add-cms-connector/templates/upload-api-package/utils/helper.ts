import fs from 'fs';
import path from 'path';

/** Ensure a directory exists. */
export const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/** Write a JS object as pretty JSON. */
export const writeJson = (filePath: string, data: unknown): void => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

/** Read and parse a JSON file. */
export const readJson = <T = any>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

/**
 * Locate the primary data file inside an export.
 *
 * Why this exists: folder/archive-shaped exports do NOT hand you the data file
 * directly. The upload-api extracts an archive (`.tar.gz`/`.zip`/…) or accepts a
 * directory upload and passes the *directory path* to the parser (see
 * reference/upload-flow.md). The real data file is usually nested one or more
 * levels down (e.g. Sanity: `production-export-<ts>/data.ndjson`).
 *
 * Pass the file your CMS exports its records into via `targetName`
 * (e.g. 'data.ndjson' for Sanity, 'export.json' elsewhere). If `inputPath` is
 * already a file, it is returned as-is. For a directory we breadth-first walk it,
 * prefer an exact `targetName` match, and fall back to the first file matching
 * `targetExt`.
 */
export const findDataFile = (
  inputPath: string,
  targetName = 'data.ndjson',
  targetExt = '.ndjson',
): string => {
  if (!inputPath) throw new Error('No export path provided.');

  const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
  if (stat?.isFile()) return inputPath;

  if (stat?.isDirectory()) {
    const queue: string[] = [inputPath];
    let firstByExt = '';
    while (queue.length) {
      const dir = queue.shift() as string;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(full);
        } else if (entry.name === targetName) {
          return full;
        } else if (targetExt && entry.name.endsWith(targetExt) && !firstByExt) {
          firstByExt = full;
        }
      }
    }
    if (firstByExt) return firstByExt;
  }

  throw new Error(`Could not find "${targetName}" under: ${inputPath}`);
};

/**
 * Read a newline-delimited JSON file (NDJSON) into an array of documents.
 * NDJSON is one JSON value per line (Sanity's `data.ndjson`, BigQuery exports,
 * log dumps, …) — it is NOT a single JSON array, so a whole-file `JSON.parse`
 * would throw. Blank lines and unparseable lines are skipped.
 */
export const readNdjson = (filePath: string): any[] => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};
