import fs from 'fs';
import path from 'path';

/**
 * Validate a SAP SmartEdit ImpEx export — accepts either shape:
 *  - **single `.impex` file**: the upload plumbing hands us the raw file text as
 *    a string (default branch of handleFileProcessing).
 *  - **export folder** (or extracted archive): the plumbing hands us the
 *    directory path as a string (folder branch); we locate an `.impex` file
 *    inside it and sniff that.
 * Valid when the sniffed text has at least one ImpEx type header
 * (`INSERT_UPDATE` / `INSERT` / `UPDATE` / `REMOVE` <Type>).
 */
const IMPEX_HEADER = /^\s*(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+\S+/im;

/** Breadth-first find the first *.impex file under a directory. */
function findFirstImpex(dir: string): string | null {
  const queue: string[] = [dir];
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
      else if (entry.name.toLowerCase().endsWith('.impex')) return full;
    }
  }
  return null;
}

const sapSmarteditValidator = (data: any): boolean => {
  try {
    if (data == null) return false;

    let text = '';
    if (typeof data === 'string') {
      // A short string that is an existing path -> file or folder; otherwise it
      // is the raw ImpEx text itself.
      if (data.length < 4096 && fs.existsSync(data)) {
        const stat = fs.statSync(data);
        if (stat.isFile()) {
          text = fs.readFileSync(data, 'utf8');
        } else if (stat.isDirectory()) {
          const impex = findFirstImpex(data);
          if (!impex) return false;
          text = fs.readFileSync(impex, 'utf8');
        }
      } else {
        text = data; // raw ImpEx text
      }
    } else if (Buffer.isBuffer(data)) {
      text = data.toString('utf8');
    } else {
      return false;
    }

    if (!text.trim()) return false;
    return IMPEX_HEADER.test(text);
  } catch (err) {
    console.error('Error : ', err);
    return false;
  }
};

export default sapSmarteditValidator;
