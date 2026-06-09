# Wiring snippets (Layers B / C / D)

Replace `<cms>` (lowercase), `<Cms>` (Pascal), `<CMS>` (UPPER), `<ext>` (file extension/shape).

## Layer B

### `upload-api/package.json` → dependencies
```json
"migration-<cms>": "file:migration-<cms>",
```

### `upload-api/src/services/createMapper.ts`
Import near the other controllers:
```ts
import create<Cms>Mapper from '../controllers/<cms>';
```
Add inside the `switch (CMSIdentifier)`:
```ts
case '<cms>': {
  return create<Cms>Mapper(filePath, projectId, app_token, affix, config);
}
```

### `upload-api/src/validators/index.ts`
Import near the other validators:
```ts
import <cms>Validator from './<cms>';
```
Add inside the `switch (CMSIdentifier)` (key is `${type}-${extension}`):
```ts
case '<cms>-<ext>': {
  return <cms>Validator({ data });
}
```
For a folder/archive connector `<ext>` is **`folder`** (key `<cms>-folder`) and
`data` is a **directory path string** — see `reference/upload-flow.md`. Existing
folder validators take `{ data }` (e.g. `aemValidator`, `sanityValidator`);
single-file ones may take the raw string directly (e.g. `wordpressValidator(data)`).

## Layer C

### `api/src/constants/index.ts` → `CMS`
```ts
export const CMS = {
  // ...existing...
  <CMS>: '<cms>',
};
```

### `api/src/services/migration.service.ts`
Import (top, with the other services):
```ts
import { <cms>Service } from './<cms>.service.js';
```
Add the SAME case to BOTH switches (test migration ~452, full migration ~856).
Use `project?.current_test_stack_id` in the test switch and the full-migration stack id in the full switch (copy exactly what the neighbouring `CMS.WORDPRESS` case uses in each switch):
```ts
case CMS.<CMS>: {
  await <cms>Service?.createEntry(file_path, packagePath, /* stackId */, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project);
  await <cms>Service?.createLocale(req, /* stackId */, projectId, project);
  await <cms>Service?.createVersionFile(/* stackId */, projectId);
  break;
}
```

## Layer D

### `ui/src/cmsData/legacyCms.json` → `all_cms`

Pick the `allowed_file_formats` variant that matches your upload shape.

**Single-file connector** (json/xml/sql/zip — real extension):
```json
{
  "cms_id": "<cms>",
  "title": "<Cms>",
  "description": "",
  "group_name": "lightning",
  "doc_url": { "title": "https://<cms>.io/", "href": "https://<cms>.io/" },
  "parent": "<Cms>",
  "isactive": true,
  "allowed_file_formats": [
    { "fileformat_id": "<ext>", "title": "<EXT>", "description": "", "group_name": "<ext>", "isactive": true }
  ]
}
```

**Folder / archive connector** (mirror `aem`) — use `directory`, NOT the archive
extension. Directory uploads (and server-extracted archives) run as `fileExt
'folder'` → validator key `<cms>-folder` (see `reference/upload-flow.md`):
```json
{
  "cms_id": "<cms>",
  "title": "<Cms>",
  "description": "",
  "group_name": "lightning",
  "doc_url": { "title": "https://<cms>.io/", "href": "https://<cms>.io/" },
  "parent": "<Cms>",
  "isactive": true,
  "allowed_file_formats": [
    { "fileformat_id": "directory", "title": "Folder", "description": "", "group_name": "directory", "isactive": true }
  ]
}
```
(`_metadata.uid` on existing entries is CMS-managed; new hand-added entries may omit it.)

### `ui/src/utilities/constants.ts` (optional)
```ts
export const VALIDATION_DOCUMENTATION_URL: { [key: string]: string } = {
  // ...existing...
  <cms>: 'https://.../<cms>-data-requirements.pdf',
};
```
