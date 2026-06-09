// api/src/services/sanity.service.ts
//
// Transform the upload-api output (cmsMigrationData) into Contentstack import
// files for the Sanity connector. The method set mirrors what the
// migration.service.ts switch calls (createEntry / createLocale /
// createVersionFile). Model a fuller implementation on wordpress.service.ts
// (monolithic) or the drupal/ folder (modular).
//
// NOTE: the `createRefrence` spelling is intentional across this repo — keep it
// if/when this connector starts producing references.

/**
 * Maps upload-api field types (Contentstack `contentstackFieldType`) to the
 * Contentstack API data types. Copied from drupal/content-types.service.ts;
 * extend if this connector introduces a type not already listed.
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

async function createEntry(
  _file_path: string,
  _packagePath: string,
  _destinationStackId: string,
  _projectId: string,
  _contentTypes: any,
  _mapperKeys: any,
  _masterLocale: string,
  _project: any
): Promise<void> {
  // TODO: read cmsMigrationData entries, transform each field value by its
  // contentstackFieldType (use mapFieldTypeToDataType), and write a Contentstack
  // entry JSON per locale under the destination stack package.
}

async function createLocale(
  _req: any,
  _destinationStackId: string,
  _projectId: string,
  _project: any
): Promise<void> {
  // TODO: write locales.json for the destination stack from the locales the
  // parser extracted (migration-sanity extractLocale).
}

async function createVersionFile(
  _destinationStackId: string,
  _projectId: string
): Promise<void> {
  // TODO: write the version metadata file for the destination stack.
}

// Optional — add only if the connector produces them:
// async function getAllAssets(...) {}
// async function createTaxonomy(...) {}
// async function createRefrence(...) {}   // <- intentional spelling to match repo

export const sanityService = {
  createEntry,
  createLocale,
  createVersionFile,
};

export { mapFieldTypeToDataType };
