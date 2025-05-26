import fs from 'fs';
import { IReadFiles } from "./types/index.interface";


/**
 * Reads a file from the given file path and parses its content as JSON.
 * 
 * @param {string} filePath - The path to the file to be read.
 * @returns {Promise<any>} - A promise that resolves to the parsed JSON content of the file.
 * @throws {Error} - Throws an error if the file content is empty, undefined, or invalid JSON.
 */

export const readFiles: IReadFiles = async (filePath: string) => {
  const fileData = await fs.promises.readFile(filePath, 'utf8')
  if (!fileData) {
    throw new Error('File content is empty or undefined');
  }
  if (typeof fileData === 'string') {
    return JSON.parse(fileData);
  }
  return fileData;
}

