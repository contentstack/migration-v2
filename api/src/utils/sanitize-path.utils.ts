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

/** Same rules as stack IDs (UUIDs, API keys); use for path segments such as `database/<projectId>/`. */
export const sanitizeProjectId = sanitizeStackId;

export const sanitizeOrgId = sanitizeStackId;

/**
 * Throws if {@link targetPath} resolves outside {@link baseDir} (after path.resolve).
 */
export const assertResolvedPathUnderBase = (
  baseDir: string,
  targetPath: string
): void => {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(targetPath);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      'Invalid path: resolved location is outside the allowed base directory'
    );
  }
};

/**
 * Resolves and validates a safe path dynamically.
 * Supports full paths, path.join(), and path.resolve().
 *
 * @param inputPath - The file path (absolute or relative).
 * @param baseDir - (Optional) Base directory for relative paths.
 * @returns A safe, absolute path.
 */
const ALLOWED_EXPORT_ROOTS: string[] = [
  path.resolve(process.cwd(), 'export-stack'),
  path.resolve(process.cwd(), 'extracted_files'),
  path.resolve(process.cwd(), 'cmsMigrationData'),
  path.resolve(process.cwd(), 'migration-data'),
  path.resolve(process.cwd(), '..', 'upload-api', 'extracted_files'),
  path.resolve('/app', 'extracted_files'),
];

/**
 * Validates that a given path is inside one of the allowed export directories,
 * and returns a freshly-constructed safe path string. Throws if the candidate
 * escapes every allowed root.
 *
 * The returned value is rebuilt from a known-good base + a sanitized relative
 * suffix, so the caller never passes tainted input directly to fs.readFile.
 */
export const assertExportPathInAllowedRoot = (candidate: string): string => {
  if (!candidate || typeof candidate !== 'string') {
    throw new Error('Invalid export path');
  }

  const resolved = path.resolve(candidate);

  for (const root of ALLOWED_EXPORT_ROOTS) {
    const rel = path.relative(root, resolved);
    const inside =
      rel === '' ||
      (!rel.startsWith('..') && !path.isAbsolute(rel));
    if (inside) {
      // Rebuild the path from a trusted base + a freshly-built relative
      // segment. This breaks the taint chain for static analyzers.
      const safeRel = rel
        .split(path.sep)
        .filter((seg) => seg && seg !== '..' && !seg.includes('\0'))
        .join(path.sep);
      return path.join(root, safeRel);
    }
  }

  throw new Error(`Export path is outside the allowed migration directories: ${resolved}`);
};

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
