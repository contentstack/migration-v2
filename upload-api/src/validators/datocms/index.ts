import fs from 'fs';
import path from 'path';

/**
 * DatoCMS exports are a FOLDER (validator key `datocms-folder`): 4 required
 * JSON files + an `assets/` folder of binaries. `data` here is a directory
 * path string (or, for a nested archive extraction, an ancestor of it) —
 * see reference/upload-flow.md. Locate the real export root by BFS for
 * `content_types.json`, then confirm every required file is present and
 * parses as valid JSON before accepting the upload.
 */
const REQUIRED_FILES = ['content_types.json', 'fields.json', 'records.json', 'assets.json'];

function findExportRoot(dir: string): string | null {
  const queue: string[] = [dir];
  while (queue.length) {
    const current = queue.shift() as string;
    if (fs.existsSync(path.join(current, 'content_types.json'))) return current;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push(path.join(current, entry.name));
    }
  }
  return null;
}

function isValidJsonFile(filePath: string): boolean {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return true;
  } catch {
    return false;
  }
}

const datocmsValidator = async ({ data }: any): Promise<boolean> => {
  try {
    if (typeof data !== 'string' || !data.trim()) return false;
    const target = data.trim();
    if (!fs.existsSync(target)) return false;

    const stat = fs.statSync(target);
    const root = stat.isDirectory() ? findExportRoot(target) : path.dirname(target);
    if (!root) return false;

    return REQUIRED_FILES.every((file) => {
      const filePath = path.join(root, file);
      return fs.existsSync(filePath) && isValidJsonFile(filePath);
    });
  } catch (err) {
    console.error('Error : ', err);
    return false;
  }
};

export default datocmsValidator;
