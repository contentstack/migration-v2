import fs from 'fs';

/**
 * Validate a SAP SmartEdit ImpEx export.
 *
 * For a single-file `.impex` upload the upload plumbing hands us the raw file
 * text as a string (default branch of handleFileProcessing). We accept it if it
 * contains at least one ImpEx type header (`INSERT_UPDATE` / `INSERT` / `UPDATE`
 * / `REMOVE` <Type>). If a filesystem path is passed instead, read it first.
 */
const IMPEX_HEADER = /^\s*(INSERT_UPDATE|INSERT|UPDATE|REMOVE)\s+\S+/im;

const sapSmarteditValidator = (data: any): boolean => {
  try {
    if (data == null) return false;

    let text = '';
    if (typeof data === 'string') {
      // Could be the raw ImpEx text, or a path to the file.
      if (data.length < 1024 && fs.existsSync(data) && fs.statSync(data).isFile()) {
        text = fs.readFileSync(data, 'utf8');
      } else {
        text = data;
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
