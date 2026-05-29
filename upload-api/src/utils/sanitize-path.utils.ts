import path from 'path';

/**
 * Sanitizes a filename by removing path separators and ensuring it's a single basename.
 * Prevents path traversal attacks by stripping directory components.
 *
 * @param filename - The input filename to sanitize.
 * @returns A safe, sanitized filename.
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  // Get basename to strip any directory components, then remove unsafe characters
  return path.basename(filename).replace(/[^a-zA-Z0-9_.\s-]/g, '');
};

/**
 * Checks if a given string is a valid path segment (e.g., an ID or a folder name).
 * Allows alphanumeric characters, underscores, and hyphens.
 *
 * @param segment - The string to validate.
 * @returns True if the segment is safe, false otherwise.
 */
export const isValidPathSegment = (segment: string): boolean => {
  if (!segment || typeof segment !== 'string') {
    return false;
  }
  // Allow alphanumeric, underscore, hyphen, and dots. Disallow path separators.
  return /^[a-zA-Z0-9_.-]+$/.test(segment);
};

/**
 * Sanitizes a project ID or similar identifier by removing path traversal characters.
 * Only allows alphanumeric characters, underscores, and hyphens.
 *
 * @param id - The ID to sanitize.
 * @returns A sanitized ID safe for use in file paths.
 */
export const sanitizeId = (id: string | string[]): string => {
  // Handle array case (headers can be string[])
  const idString = Array.isArray(id) ? id[0] : id;
  
  if (!idString || typeof idString !== 'string') {
    return '';
  }
  
  // Use path.basename to strip directory components, then sanitize
  const basename = path.basename(idString);
  // Only allow alphanumeric, underscore, hyphen, and dots
  return basename.replace(/[^a-zA-Z0-9_.-]/g, '');
};

/**
 * Checks if a given full path is safely contained within a specified base directory.
 * This prevents path traversal attacks by ensuring the resolved path does not escape the base directory.
 *
 * @param fullPath - The full path to check.
 * @param baseDir - The base directory to contain the path within.
 * @returns True if the path is safely within the base directory, false otherwise.
 */
export const isPathWithinBase = (fullPath: string, baseDir: string): boolean => {
  const resolvedFullPath = path.resolve(fullPath);
  const resolvedBaseDir = path.resolve(baseDir);

  // Calculate the relative path from the base directory to the full path.
  const relativePath = path.relative(resolvedBaseDir, resolvedFullPath);

  // Check if the relative path tries to escape the base directory.
  return (
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  );
};

/**
 * Resolves and validates a safe path dynamically.
 *
 * @param inputPath - The file path (absolute or relative).
 * @param baseDir - (Optional) Base directory for relative paths.
 * @returns A safe, absolute path.
 */
export const getSafePath = (inputPath: string, baseDir?: string): string => {
  try {
    // Resolve the absolute path
    const resolvedPath = path.resolve(baseDir || '', inputPath);

    // Ensure only the last segment (filename) is sanitized
    const dirPath = path.dirname(resolvedPath);
    const fileName = sanitizeFilename(path.basename(resolvedPath));

    // Construct the final safe path
    const safePath = path.join(dirPath, fileName);

    // Ensure the path remains inside baseDir (if provided)
    if (baseDir && !isPathWithinBase(safePath, baseDir)) {
      console.warn('Invalid file path detected, using default safe path.');
      return path.join(path.resolve(baseDir), 'default.log');
    }

    return safePath;
  } catch (error) {
    console.error('Error generating safe path:', error);
    return baseDir ? path.join(baseDir, 'default.log') : 'default.log';
  }
};
