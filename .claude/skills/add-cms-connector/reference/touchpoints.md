# Connector touch points (exact files)

Line numbers are anchors at time of writing — they drift. Always open the file and locate the current spot (grep for the neighbouring connector, e.g. `wordpress` / `WORDPRESS`).

> Before wiring, read `upload-flow.md` — it documents how each upload kind
> (zip/xml/sql/folder/archive/json) derives `fileExt`, what `data` shape the
> validator receives, and what `filePath` the mapper gets. This drives the
> validator key, the folder-vs-file parsing, and the `legacyCms.json` entry.

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
- `upload-api/src/controllers/<cms>/index.ts` → NEW `create<Cms>Mapper`. Model: `src/controllers/wordpress/index.ts`. Default-export it. ⚠️ Export style is inconsistent across connectors: most `export default`, but `aem` uses a named `export { createAemMapper }` (so `createMapper.ts` imports it as `import { createAemMapper }`). Also note `contentful`/`drupal` controllers live under `src/services/`, not `src/controllers/` — `createMapper.ts` imports them from `./contentful` / `./drupal`. Follow the wordpress (default-export, `../controllers/<cms>`) pattern for new connectors.
- `upload-api/src/services/createMapper.ts` → import (top, ~3–8) + `case '<cms>':` in the switch (~96–119).
- `upload-api/src/validators/<cms>/index.ts` → NEW validator (validators are **directories**, not single files). Model: `src/validators/wordpress/index.ts` (or `validators/aem/index.ts` for a folder connector). Default-export it.
- `upload-api/src/validators/index.ts` → import (~1–6, `import <cms>Validator from './<cms>';`) + `case '<cms>-<ext>':` in switch (~19–47). Key = `${type}-${extension}`. ⚠️ For folder/archive connectors the runtime `<ext>` is always **`folder`** (see `upload-flow.md`) → key `<cms>-folder`. The `data` arg shape is branch-dependent (string / JSZip / DB config / directory path) — match it.

## Layer C — api transform + registration
- `api/src/constants/index.ts` → `CMS` object, add `<CMS>: '<cms>',` (~40–48).
- `api/src/services/<cms>.service.ts` (monolithic, like `wordpress.service.ts`) OR `api/src/services/<cms>/` (modular, like `drupal/`) → export `{ createEntry, createLocale, createVersionFile, ... }`. ⚠️ `createEntry` produces the entries (schemas are generic) — see `entry-creation.md` for inputs, output layout, the field-value switch, reference resolution, and the asset/group passes to defer.
- Contentstack-type → API-data-type map `mapFieldTypeToDataType`: `api/src/services/drupal/content-types.service.ts` ~448–474. Copy/extend in the new service.
- `api/src/services/migration.service.ts`:
  - service import ~26–42.
  - **Test migration** switch case `case CMS.<CMS>:` ~452–590 (model `CMS.WORDPRESS` ~480).
  - **Full migration** switch case `case CMS.<CMS>:` ~856–1020. ⚠️ Must add to BOTH.

## Layer D — ui
- `ui/src/cmsData/legacyCms.json` → append to `all_cms` (`cms_id` == enum string, `isactive: true`, `parent`, `doc_url`, `allowed_file_formats`). For a **folder/archive** connector, the file format mirrors `aem`: `fileformat_id: "directory"`, `title: "Folder"`, `group_name: "directory"` — NOT the archive extension (the runtime maps directory uploads to `fileExt 'folder'`). For a single-file connector use the real extension (`xml`/`json`/…). `_metadata.uid` on existing entries is CMS-managed; hand-added entries may omit it (the card renders off `cms_id`).
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
