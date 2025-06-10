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



/**
 * Extracts the last segment of a component path from a given string.
 *
 * Searches for a substring that matches the pattern `components/...` and returns
 * the last path segment after the final `/`. If no such pattern is found, returns `null`.
 *
 * @param line - The input string to search for a component path.
 * @returns The last segment of the matched component path, or `null` if no match is found.
 */

export const extractComponentPath = (line: string): string | null => {
  const match = line.match(/components(?:\/[\w-]+)+/);
  if (!match) return line;

  // Get the last element after the last '/'
  const parts = match[0].split('/');
  return parts[parts.length - 1];
}