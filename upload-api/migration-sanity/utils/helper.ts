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
 * Locate the Sanity `data.ndjson` file given the uploaded export path.
 *
 * A Sanity dataset export is a bundle: `data.ndjson` + `assets.json` + an
 * `images/` folder, usually nested under a `production-export-<timestamp>/`
 * directory. The upload-api hands us the extracted folder (extension `folder`),
 * so we walk it to find `data.ndjson`. We also accept a direct path to an
 * `.ndjson` file for flexibility.
 */
export const findDataFile = (inputPath: string): string => {
  if (!inputPath) throw new Error('No Sanity export path provided.');

  const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;
  if (stat?.isFile()) {
    return inputPath; // already pointed at data.ndjson (or similar)
  }

  if (stat?.isDirectory()) {
    // Breadth-first walk; prefer a file literally named data.ndjson.
    const queue: string[] = [inputPath];
    let firstNdjson = '';
    while (queue.length) {
      const dir = queue.shift() as string;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(full);
        } else if (entry.name === 'data.ndjson') {
          return full;
        } else if (entry.name.endsWith('.ndjson') && !firstNdjson) {
          firstNdjson = full;
        }
      }
    }
    if (firstNdjson) return firstNdjson;
  }

  throw new Error(`Could not find a Sanity data.ndjson under: ${inputPath}`);
};

/** Read a newline-delimited JSON file into an array of documents. */
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
