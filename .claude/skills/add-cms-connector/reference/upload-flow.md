# Upload flow: how an export reaches your connector

Line numbers are anchors at time of writing — they drift. Always open the file
and locate the current spot.

When the user uploads an export, `upload-api` derives a `fileExt`, runs a
validator, and (on success) calls `createMapper(filePath, …)`. **The shape of
`data` handed to your validator and the `filePath` handed to your mapper both
depend on the branch** — getting this wrong is why a validator "never fires".

## What determines the branch

- File uploads: `fileExt = fileName.split('.').pop()` (`routes/index.ts` ~185).
- Directory uploads: `fileExt` is hardcoded to **`'folder'`** (`routes/index.ts` ~162),
  regardless of the UI's `fileformat_id` (the UI computes `"directory"` —
  `ui/src/pages/Migration/index.tsx` ~239-241). So the validator key for a
  folder connector is **always `<cms>-folder`**, never `<cms>-directory`.
- Archives (`.tar.gz`/`.tgz`/`.tar`): detected by `isArchive()` and unpacked by
  `extractArchive()` (`src/helper/index.ts` ~134-147), then **re-enter the folder
  branch** (`routes/index.ts` ~189-205): `handleFileProcessing('folder', extractedDir, …)`.

The validator switch key is `` `${type}-${extension}` `` (`validators/index.ts` ~18).

## Per-branch contract

| Upload kind | `fileExt` | Validator key | `data` passed to validator | `filePath` passed to `createMapper` |
|---|---|---|---|---|
| `.zip` | `zip` | `<cms>-zip` | a **JSZip** object | extracted file/dir under `extracted_files/` |
| `.xml` (wordpress/drupal) | `xml` | `<cms>-xml` | raw **string** (XML) | `extracted_files/<name>.json` (parsed to JSON) |
| SQL (drupal) | `sql` | `<cms>-sql` | DB-connection **config object** | `''` (empty — data comes from the DB) |
| **directory** | `folder` | `<cms>-folder` | **directory path string** | the directory path |
| **archive** `.tar.gz` etc. | `folder` (after extract) | `<cms>-folder` | extracted **directory path string** | the extracted directory path |
| anything else | `<ext>` | `<cms>-<ext>` | raw **string** (UTF-8 of the buffer) | extracted file/dir under `extracted_files/` |

Branch bodies live in `services/fileProcessing.ts` (zip ~14, xml ~42, folder ~71,
sql ~93, default-json ~144).

## Consequences for your connector

1. **Folder/archive connectors get a directory PATH, not parsed content.** Your
   validator must `fs.stat` the path and locate the data file; your parser
   (`extractContentTypes`/`extractLocale`) must do the same via `findDataFile`.
   The data file is usually nested (Sanity: `production-export-<ts>/data.ndjson`).
2. **Only one validator case is needed for folder-shaped CMSs:** `<cms>-folder`.
   You do NOT need a `<cms>-gz`/`<cms>-targz` case — archives are normalized to
   the folder branch upstream.
3. **`legacyCms.json` for a folder connector** uses `fileformat_id: "directory"`,
   `title: "Folder"`, `group_name: "directory"` (mirror `aem`) — NOT the archive
   extension. The runtime never reads `fileformat_id` to pick the validator key.
4. If your CMS exports a **single file** (json/xml), the validator gets a
   **string** and the mapper gets a concrete file path — no directory walking.
