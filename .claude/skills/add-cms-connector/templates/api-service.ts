// api/src/services/<cms>.service.ts
//
// Transform the upload-api output (cmsMigrationData) into Contentstack import files
// for this connector. Mirror the method set the migration.service.ts switch calls.
// Model a fuller implementation on wordpress.service.ts (monolithic) or the
// drupal/ folder (modular). Keep method names EXACT — note the existing misspelling
// `createRefrence` where other connectors use it.

/**
 * Maps upload-api field types to Contentstack API data types.
 * Copied from drupal/content-types.service.ts; extend if this connector introduces
 * a contentstackFieldType not already listed.
 */
function mapFieldTypeToDataType(fieldType: string | null | undefined): string {
  if (!fieldType) return 'text';
  const fieldTypeMap: { [key: string]: string } = {
    single_line_text: 'text',
    multi_line_text: 'text',
    text: 'text',
    html: 'html',
    json: 'json',
    markdown: 'text',
    number: 'number',
    boolean: 'boolean',
    isodate: 'isodate',
    file: 'file',
    reference: 'reference',
    taxonomy: 'taxonomy',
    link: 'link',
    dropdown: 'text',
    radio: 'text',
    checkbox: 'boolean',
    global_field: 'global_field',
    group: 'group',
    url: 'text',
  };
  return fieldTypeMap[fieldType] || 'text';
}

async function createEntry(/* file_path, packagePath, destinationStackId, projectId, contentTypes, mapperKeys, masterLocale, project */): Promise<void> {
  // TODO: read cmsMigrationData entries, transform each field value by its
  // contentstackFieldType, write Contentstack entry JSON per locale.
}

async function createLocale(/* req, destinationStackId, projectId, project */): Promise<void> {
  // TODO: write locales.json for the destination stack.
}

async function createVersionFile(/* destinationStackId, projectId */): Promise<void> {
  // TODO: write version metadata file.
}

// Optional, add only if this connector produces them:
// async function getAllAssets(...) {}
// async function createTaxonomy(...) {}
// async function createRefrence(...) {}   // <- intentional spelling to match repo

export const <cms>Service = {
  createEntry,
  createLocale,
  createVersionFile,
  // getAllAssets,
  // createTaxonomy,
  // createRefrence,
};

export { mapFieldTypeToDataType };
