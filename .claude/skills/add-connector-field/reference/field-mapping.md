# Where each connector's field mapping lives

Two mapping points per connector. Line numbers drift — grep for the function name.

## Mapping point 1 — source type → Contentstack field type (upload-api)

| Connector | File | What to edit |
|---|---|---|
| wordpress | `upload-api/migration-wordpress/libs/schemaMapper.ts` | `switch (key?.name)` on Gutenberg block names; each case returns a `Field` |
| contentful | `upload-api/migration-contentful/` (+ `api/src/services/contentful.service.ts` `inferContentfulDefaultWidgetId` ~201–217) | widget-id inference per Contentful field type |
| drupal | `upload-api/migration-drupal/` field analysis modules | field-type discovery from the SQL schema |
| aem | `upload-api/migration-aem/` | folder/JCR property mapping |
| sitecore | `upload-api/migration-sitecore/` | template-field mapping |
| sanity | `upload-api/migration-sanity/libs/schemaMapper.ts` | type inference from NDJSON sample values; group/modular-blocks rows emitted by `contentTypes.ts` (`emitFieldRows`); `title`/`url` rows guaranteed by `ensureMandatoryFields` |

The `Field` shape and the `contentstackFieldType` union live in each package's `interface/interface.ts`.

## Mapping point 2 — Contentstack field type → API data_type (api)

| Connector | File | Function |
|---|---|---|
| drupal | `api/src/services/drupal/content-types.service.ts` | `mapFieldTypeToDataType` (~448–474) |
| contentful | `api/src/services/contentful.service.ts` | `inferContentfulDefaultWidgetId` (~201–217) |
| wordpress | `api/src/services/wordpress.service.ts` | field handling within `createEntry` (~904–950) |
| aem | `api/src/services/aem.service.ts` | field handling within entry/content-type creation |
| sitecore | `api/src/services/sitecore.service.ts` | field handling within entry/content-type creation |
| sanity | `api/src/services/sanity.service.ts` | `mapFieldTypeToDataType` (~38); per-type value switch inside `createEntry` (~383) |

### Reference: drupal `mapFieldTypeToDataType`
```ts
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
```

## The `Field` object a mapper returns
```ts
{
  uid: string;
  otherCmsField: string;        // source field name
  otherCmsType: string;         // source field/widget type id
  contentstackField: string;    // display name
  contentstackFieldUid: string;
  contentstackFieldType: string;// the chosen Contentstack type
  backupFieldType: string;
  backupFieldUid: string;
  advanced?: { mandatory?: boolean; multiple?: boolean; [k: string]: any };
}
```

## Entry-time value handling (Step 4)
- wordpress: parser `libs/extractItems.ts`; api `wordpress.service.ts` `createEntry`.
- drupal: api `drupal/entries.service.ts` `createEntry`.
- contentful: api `contentful.service.ts` `createEntry`.
- sanity: api `sanity.service.ts` `createEntry` (+ `getAllAssets` local-copy pass; resolve the export root via `resolveDataFile(file_path, packagePath)` — `file_path` may be the raw `.tar.gz`).
Special shapes already handled in repo: `modular_blocks` (→ blocks), `file` (asset attach), `group` (nested fields), `reference` (entry link).
