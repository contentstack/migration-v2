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
 * Validates and sanitizes a stack ID to prevent path traversal attacks.
 * Only allows alphanumeric characters, underscores, dots, and hyphens.
 * Returns null if the input is invalid or potentially malicious.
 *
 * This function uses an allowlist approach to break the taint chain.
 *
 * @param stackId - The stack ID to validate and sanitize.
 * @returns A safe stack ID string or null if invalid.
 */
export const sanitizeStackId = (
  stackId: string | undefined | null
): string | null => {
  // Return null for falsy inputs
  if (!stackId || typeof stackId !== 'string') {
    return null;
  }

  // Strict validation pattern - only allow safe characters for identifiers
  const safePattern = /^[a-zA-Z0-9_.-]+$/;

  // Check for any path traversal attempts first
  if (
    stackId.includes('/') ||
    stackId.includes('\\') ||
    stackId.includes('..') ||
    stackId.includes('\0')
  ) {
    return null;
  }

  // Validate the input matches our safe pattern
  if (!safePattern.test(stackId)) {
    return null;
  }

  // Maximum length check to prevent buffer overflow attacks
  if (stackId.length > 256) {
    return null;
  }

  // Build a new string character by character from allowed characters only
  // This completely breaks the taint chain by creating a new value
  const allowedChars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-';
  let safeValue = '';

  for (let i = 0; i < stackId.length; i++) {
    const char = stackId.charAt(i);
    if (allowedChars.includes(char)) {
      safeValue += char;
    }
  }

  // Ensure we have a valid result
  if (safeValue.length === 0 || safeValue !== stackId) {
    return null;
  }

  return safeValue;
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
