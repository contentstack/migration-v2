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
 * Resolve the DatoCMS export root — the directory that directly contains
 * `content_types.json`, `fields.json`, `records.json`, `assets.json`, and an
 * `assets/` folder of binaries.
 *
 * `inputPath` may already BE that directory (a plain folder upload), or an
 * ancestor of it (archive uploads get extracted one level deeper, e.g.
 * `extracted_files/<archive-name>/dato_data/...`). Breadth-first walk until
 * `content_types.json` is found; throw if it never is.
 */
export const resolveExportRoot = (inputPath: string): string => {
  if (!inputPath) throw new Error('No DatoCMS export path provided.');
  if (!fs.existsSync(inputPath)) {
    throw new Error(`DatoCMS export path does not exist: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    // A single file was handed in directly — treat its parent dir as the root.
    return path.dirname(inputPath);
  }

  const queue: string[] = [inputPath];
  while (queue.length) {
    const dir = queue.shift() as string;
    if (fs.existsSync(path.join(dir, 'content_types.json'))) return dir;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) queue.push(path.join(dir, entry.name));
    }
  }

  throw new Error(`Could not find "content_types.json" under: ${inputPath}`);
};
