import fs from 'fs';
import path from 'path';

const requiredExportPaths = [
  'content_types/schema.json',
  'entries',
  'assets',
  'global_fields',
  'locales/locales.json',
];

const hasAllRequired = (base: string): boolean =>
  requiredExportPaths.every((rel) => fs.existsSync(path.join(base, rel)));

/**
 * Newer @contentstack/cli stack exports often nest data under a branch folder (e.g. `main/`)
 * inside the `-d` output directory. Older exports had content_types, entries, etc. at the top level.
 * Returns the directory that actually contains the export layout, or null if not found.
 */
export const resolveContentstackExportRoot = (
  exportPath: string
): string | null => {
  if (!exportPath || !fs.existsSync(exportPath)) {
    return null;
  }

  if (hasAllRequired(exportPath)) {
    return exportPath;
  }

  try {
    const dirents = fs.readdirSync(exportPath, { withFileTypes: true });
    const dirNames = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    // Prefer common branch folder names, then any other subdirectory
    const preferredOrder = ['main', 'master', 'production', 'develop'];
    const ordered = [
      ...preferredOrder.filter((n) => dirNames.includes(n)),
      ...dirNames.filter((n) => !preferredOrder.includes(n)).sort(),
    ];

    for (const name of ordered) {
      const candidate = path.join(exportPath, name);
      if (hasAllRequired(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export type ExportValidationResult = {
  isValid: boolean;
  missing: string[];
  message: string;
  /** When valid, the directory that contains content_types, entries, etc. (may equal exportPath or a nested folder). */
  resolvedRoot?: string | null;
};

export const validateExportStructure = async (
  exportPath: string
): Promise<ExportValidationResult> => {
  const resolvedRoot = resolveContentstackExportRoot(exportPath);

  if (!resolvedRoot) {
    const missing = requiredExportPaths.filter(
      (rel) => !fs.existsSync(path.join(exportPath, rel))
    );
    return {
      isValid: false,
      missing,
      resolvedRoot: null,
      message: `Export validation failed. Missing: ${missing.join(', ')}`,
    };
  }

  const schemaPath = path.join(resolvedRoot, 'content_types', 'schema.json');
  const raw = await fs.promises.readFile(schemaPath, 'utf8');
  const schema = JSON.parse(raw || '[]');
  if (!Array.isArray(schema)) {
    return {
      isValid: false,
      missing: ['content_types/schema.json (array expected)'],
      resolvedRoot,
      message: 'Export validation failed. Invalid schema format.',
    };
  }

  return {
    isValid: true,
    missing: [],
    resolvedRoot,
    message: 'Export validation successful',
  };
};
