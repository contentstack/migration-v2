# Connector touch points (exact files)

Line numbers are anchors at time of writing — they drift. Always open the file and locate the current spot (grep for the neighbouring connector, e.g. `wordpress` / `WORDPRESS`).

## Layer A — parser package (NEW directory)
`upload-api/migration-<cms>/`
- `package.json` — name `migration-v2-<cms>`, `"main": "build/index.js"`, scripts `build`/`clean`/`start`.
- `tsconfig.json` — target es2016, module commonjs, outDir `./build`, `resolveJsonModule`, `esModuleInterop`, `strict`.
- `index.ts` — `export { extractContentTypes, extractLocale }`.
- `interface/interface.ts` — `Field`, `FieldAdvanced`, `DataConfig`, `CT = Field[]`. Keep `Field` identical to wordpress.
- `config/index.json` — `data: "./cmsMigrationData"`, module dir names (`content_types`, `entries`, `assets`, ...).
- `libs/extractLocale.ts` — returns `string[]` of locale codes.
- `libs/contentTypes.ts` — `extractContentTypes(affix, filePath, DataConfig)`; reads sample, groups records by type, writes `content_types/*.json`, returns the parsed CTs.
- `libs/schemaMapper.ts` — switch: source field/widget type → `Field` with chosen `contentstackFieldType`.
- `utils/helper.ts` — file I/O helpers.

Model package: `upload-api/migration-wordpress/`.

## Layer B — upload-api server wiring
- `upload-api/package.json` → `dependencies`: add `"migration-<cms>": "file:migration-<cms>"` (next to the other `migration-*`, ~67–71).
- `upload-api/src/controllers/<cms>/index.ts` → NEW `create<Cms>Mapper`. Model: `src/controllers/wordpress/index.ts`.
- `upload-api/src/services/createMapper.ts` → import (top, ~3–8) + `case '<cms>':` in the switch (~96–119).
- `upload-api/src/validators/<cms>.ts` → NEW validator. Model: `src/validators/wordpress.ts`.
- `upload-api/src/validators/index.ts` → import (~1–5) + `case '<cms>-<ext>':` in switch (~19–42). Key = `${type}-${extension}`.

## Layer C — api transform + registration
- `api/src/constants/index.ts` → `CMS` object, add `<CMS>: '<cms>',` (~40–48).
- `api/src/services/<cms>.service.ts` (monolithic, like `wordpress.service.ts`) OR `api/src/services/<cms>/` (modular, like `drupal/`) → export `{ createEntry, createLocale, createVersionFile, ... }`.
- Contentstack-type → API-data-type map `mapFieldTypeToDataType`: `api/src/services/drupal/content-types.service.ts` ~448–474. Copy/extend in the new service.
- `api/src/services/migration.service.ts`:
  - service import ~26–42.
  - **Test migration** switch case `case CMS.<CMS>:` ~452–590 (model `CMS.WORDPRESS` ~480).
  - **Full migration** switch case `case CMS.<CMS>:` ~856–1020. ⚠️ Must add to BOTH.

## Layer D — ui
- `ui/src/cmsData/legacyCms.json` → append to `all_cms` (`cms_id` == enum string, `isactive: true`, `parent`, `doc_url`, `allowed_file_formats`).
- `ui/src/utilities/constants.ts` → optional `VALIDATION_DOCUMENTATION_URL['<cms>']`.

Model UI entry: the `wordpress` object in `legacyCms.json`.

## Field shape (consumed by every layer)
```ts
interface Field {
  uid: string;
  otherCmsField: string;        // source field name
  otherCmsType: string;         // source field/widget type
  contentstackField: string;    // display name
  contentstackFieldUid: string;
  contentstackFieldType: 'single_line_text' | 'multi_line_text' | 'text' | 'html'
    | 'json' | 'markdown' | 'number' | 'boolean' | 'isodate' | 'file'
    | 'reference' | 'taxonomy' | 'link' | 'group' | 'global_field' | 'url' | string;
  backupFieldType: string;
  backupFieldUid: string;
  advanced?: { mandatory?: boolean; multiple?: boolean; [k: string]: any };
  isDeleted?: boolean;
  refrenceTo?: string[];
}
```
