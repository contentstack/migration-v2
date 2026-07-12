/**
 * Contentstack `contentstackFieldType` -> API data type. Copied from
 * `drupal/content-types.service.ts` (~448-474) and extended with
 * `modular_blocks` (DatoCMS `rich_text` fields) per the template's guidance —
 * Drupal's connector doesn't use modular blocks so its own map omits it.
 */
export function mapFieldTypeToDataType(fieldType: string | null | undefined): string {
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
    modular_blocks: 'blocks',
    url: 'text',
  };

  return fieldTypeMap[fieldType] || 'text';
}
