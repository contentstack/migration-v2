# Entry creation (api `createEntry`)

Content-type **schemas** are created generically (the mapper UI →
`contenTypeMaker` writes `cmsMigrationData/<stackId>/content_types/<cs_uid>.json`).
Your service's `createEntry` creates the **entries**. If you skip it, the
migration produces content types but **zero entries** — the classic "it ran but
nothing imported" symptom.

## Runtime inputs

`createEntry(file_path, packagePath, destinationStackId, projectId, contentTypes, mapperKeys, master_locale, project)` — set in `migration.service.ts` before the switch:

- **`file_path`** = `project.legacy_cms.file_path` — the **source export**. For a
  folder/archive connector this is the **extracted directory** (locate the data
  file inside it, e.g. `data.ndjson`). For a single-file connector it's the file.
- **`packagePath`** = `project.extract_path` (a sensible fallback path to read from).
- **`contentTypes`** = from `fieldAttacher` (reads the mapper DB). Array of:
  `{ otherCmsTitle, otherCmsUid, contentstackTitle, contentstackUid /* e.g. cs_post */, type /* 'content_type' | 'global_field' */, fieldMapping: Field[] }`
  where each field is `{ otherCmsField /* source field name */, otherCmsType, contentstackFieldUid /* target uid, lowercased */, contentstackFieldType, advanced, isDeleted }`.
  This is what maps a **source field name** → a **Contentstack field uid + type**.
- **`mapperKeys`** = `{ [contentstackUid]: folderName }` — optional per-CT folder rename; fall back to `contentstackUid`.
- **`master_locale`** = the destination stack's master locale (e.g. `en-us`).

The `cs_` (affix) prefix is baked into `contentstackUid` already — no need to re-derive it.

## Output layout (match exactly)

```
cmsMigrationData/<stackId>/entries/<ct_folder>/<locale>/
  ├── <locale>.json   # flat object: { "<entryUid>": { uid, title, locale, publish_details:[], <fieldUid>: <value>, ... } }
  └── index.json      # { "1": "<locale>.json" }
```
`<ct_folder>` = `mapperKeys[ct.contentstackUid] ?? ct.contentstackUid`. Entry uids
must be **hyphen-free**; derive a STABLE uid from the source id so references resolve.
Also write `locales/master-locale.json` (createLocale) and `export-info.json`
(createVersionFile) — see `templates/api-service.ts`.

## Field-value transform

There is a shared `entriesFieldCreator` (`utils/entries-field-creator.utils.ts`),
but it is tuned for **HTML/string** content (AEM/Sitecore) and expects values like
`content.split('|')` refs and redactor mediaids. For a CMS with **structured JSON**
values, hand-roll a small `switch (field.contentstackFieldType)` like Drupal's
`processFieldByType` (and the shipped `sanity.service.ts`). Per type:

| target type | build |
|---|---|
| `single_line_text`/`multi_line_text`/`text`/`markdown` | plain string (extract from your source's wrapper, e.g. Sanity `slug.current`, portable-text → plaintext) |
| `json`/`html` (RTE) | a Contentstack **JSON-RTE doc**: `{type:'doc',uid,attrs:{},children:[{type:'p',uid,attrs:{},children:[{text,bold?,italic?}]}]}` |
| `isodate` | `new Date(v).toISOString()` (guard `isNaN`) |
| `boolean` / `number` | coerce |
| `reference` | `[{ uid: <targetEntryUid>, _content_type_uid: <targetCtUid> }]` — resolve via a doc index |

### Reference resolution
Build an index of every source doc up front: `sourceId -> { type, entryUid }`.
A reference value (your source's pointer, e.g. Sanity `{_ref}`) resolves to
`{ uid: index[ref].uid, _content_type_uid: ctUidByType[index[ref].type] }`. Use the
SAME `toEntryUid()` when indexing and when writing entries, or refs won't match.

## Deferred passes (don't fake them — log and move on)

- **`file` / assets** — needs a `getAllAssets` pass that registers source assets
  (binaries + metadata) as Contentstack assets and maps source id/url → asset uid,
  then `file` fields reference that uid. This is the largest sub-feature (the
  WordPress asset code is ~400 lines). Until then, skip `file` fields and log a count.
- **Nested `group` expansion** — if the parser emits a group with an empty child
  schema (didn't recurse into the nested object's fields), there are no inner uids
  to map. Expand the child schema in the parser first, then map here. Until then,
  emit `[]` for multiple groups and log.

Log skipped counts explicitly — silent drops read as "fully imported" when they aren't.
