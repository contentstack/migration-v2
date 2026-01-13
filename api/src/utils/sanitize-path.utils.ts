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
 * Validates if a path segment (like projectId or stackId) is safe.
 * Returns true if the segment doesn't contain path traversal characters.
 *
 * @param segment - The path segment to validate.
 * @returns True if safe, false if it contains traversal characters.
 */
export const isValidPathSegment = (
  segment: string | undefined | null
): boolean => {
  if (!segment || typeof segment !== 'string') {
    return false;
  }
  // Check if basename equals the original (no directory components)
  const sanitized = path.basename(segment);
  return sanitized === segment && sanitized.length > 0;
};

/**
 * Validates a path segment and throws an error if invalid.
 *
 * @param segment - The path segment to validate.
 * @param name - Name of the segment for error messages (e.g., 'projectId').
 * @throws Error if the segment is invalid.
 * @returns The validated segment.
 */
export const validatePathSegment = (
  segment: string | undefined | null,
  name: string = 'path segment'
): string => {
  if (!isValidPathSegment(segment)) {
    throw new Error(`Invalid ${name}: path traversal attempt detected`);
  }
  return segment as string;
};

/**
 * Validates that a resolved path is within the expected base directory.
 *
 * @param resolvedPath - The fully resolved absolute path.
 * @param baseDir - The base directory that the path must be within.
 * @returns True if path is safely within baseDir, false otherwise.
 */
export const isPathWithinBase = (
  resolvedPath: string,
  baseDir: string
): boolean => {
  const safeBaseDir = path.resolve(baseDir);
  const relativePath = path.relative(safeBaseDir, resolvedPath);

  // Path is safe if relative path doesn't escape base
  return (
    relativePath === '' ||
    relativePath === '.' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
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
