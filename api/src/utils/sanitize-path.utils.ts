import path from 'path';

/**
 * Sanitizes a filename by removing unsafe characters.
 * Allows only alphanumeric characters, underscores, dots, hyphens, and spaces.
 *
 * @param filename - The input filename to sanitize.
 * @returns A safe, sanitized filename.
 */
const sanitizeFilename = (filename: string): string => {
  return path.basename(filename).replace(/[^a-zA-Z0-9_.\s-]/g, '');
};

/**
 * Resolves and validates a safe path dynamically.
 * Supports full paths, path.join(), and path.resolve().
 *
 * @param inputPath - The file path (absolute or relative).
 * @param baseDir - (Optional) Base directory for relative paths.
 * @returns A safe, absolute path.
 */
export const getSafePath = (inputPath: string, baseDir?: string): string => {
  try {
    // Resolve the absolute path (handles path.join(), path.resolve(), and full paths)
    const resolvedPath = path.resolve(baseDir || '', inputPath);

    // Ensure only the last segment (filename) is sanitized
    const dirPath = path.dirname(resolvedPath);
    const fileName = sanitizeFilename(path.basename(resolvedPath));

    // Construct the final safe path
    const safePath = path.join(dirPath, fileName);

    // Ensure the path remains inside baseDir (if provided)
    if (baseDir) {
      const safeBaseDir = path.resolve(baseDir);

      // Use path.relative to securely check path containment
      const relativePath = path.relative(safeBaseDir, safePath);

      // If relativePath starts with '..' or is absolute, it's trying to escape
      if (
        relativePath === '' ||
        relativePath === '.' ||
        (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
      ) {
        // Path is safely within the base directory
        return safePath;
      } else {
        // Path is trying to escape the base directory
        console.warn('Invalid file path detected, using default safe path.');
        return path.join(safeBaseDir, 'default.log');
      }
    }

    return safePath;
  } catch (error) {
    console.error('Error generating safe path:', error);
    return baseDir ? path.join(baseDir, 'default.log') : 'default.log';
  }
};
