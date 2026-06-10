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

## Assets (the `getAllAssets` pass)

`file` fields need a separate `getAllAssets(file_path, packagePath, destinationStackId, projectId)`
that runs **before** `createEntry` in the migration.service switch (so the asset
records exist on disk when entries are built). It writes the standard asset
package and `createEntry` re-reads it. Model: `wordpress.service.ts`
(`startingDirAssests`/`saveAsset`); the shipped `sanity.service.ts` is the local-copy variant.

**Package layout** under `cmsMigrationData/<stackId>/assets/`:
- `assets.json` = `{ "1": "index.json" }` (manifest)
- `index.json` = the asset-record map, keyed by **asset uid** (this is what `createEntry` re-reads)
- `folders.json` = `{}`
- `files/<assetUid>/<filename>` = the raw binary bytes
- `logs/assets/cs_failed.json` = `{}` (record assets whose binary couldn't be read)

**Asset record shape** (match `wordpress.service.ts:saveAsset`):
```
{ uid, urlPath:`/assets/<uid>`, status:true, content_type /* getMimeTypeFromExtension(ext) */,
  file_size /* STRING `${bytes}` */, tag:[], filename, url, is_dir:false, parent_uid:null,
  _version:1, title, publish_details:[], description:"" }
```

**Binary handling — download vs copy:** WordPress/Contentful exports only carry a
CDN **url**, so they download (`saveAssetFromUrl`). A Sanity export **ships the
bytes** in `images/` (+ `files/`) with no CDN url, so **copy the local file** and
set `url:""`. Pick per export; don't fabricate a url.

**Asset uid / identity:** derive a STABLE uid from the source's content/asset
identity so re-runs and references are deterministic and duplicates collapse. For
Sanity that's the 40-hex hash shared by the `images/` filename, the `assets.json`
key (`image-<hash>`), and the in-doc `_sanityAsset` path → `assets_<hash>`.
⚠️ That identity hash is NOT the record's `sha1hash` field (a different content
hash) — key on the filename/path hash so `getAllAssets` and `createEntry` agree.

**`file` field value:** the entry stores the **full asset record object** (not a
uid, not `{uid,_content_type_uid}`) — same as every connector
(`entries-field-creator.utils.ts:249`). Single field → the record; `multiple` →
an array of records. `createEntry` resolves it by parsing the source ref → identity
hash → `assetLookup['assets_'+hash]` (the parsed `index.json`).

⚠️ **Galleries / arrays of media:** an array of media objects (e.g. `[{image…},{image…}]`)
must become a **`multiple` file field**, NOT a group — if the parser maps it to a
group, the entry transform drops every asset. Detect "array whose first element is
a media object" in the parser and emit `file` + `advanced.multiple=true`; the
transform then returns the array of asset records.

⚠️ **Embedded assets aren't only top-level.** `transformField` dispatches on the
top-level field type, so assets **inside rich text or nested objects/arrays** are
missed unless you walk them. For RTE (`json`/`html`), when a portable-text / body
element is a media object (not a text block), emit a Contentstack **embedded-asset
node** instead of dropping it (proven shape — `entries-field-creator.utils.ts:151`):
```
{ uid, type:'reference', attrs:{ 'display-type':'display', 'asset-uid':rec.uid,
  'content-type-uid':'sys_assets', 'asset-link':rec.urlPath, 'asset-name':rec.title,
  'asset-type':rec.content_type, type:'asset', 'class-name':'embedded-asset', inline:false },
  children:[{text:''}] }
```
Assets nested inside **groups** are linked via nested-group expansion (next section).

## Nested groups (the dotted-child contract)

Nested objects / arrays-of-objects become Contentstack **group** fields. The whole
mechanism rides on ONE convention, proven by wordpress and the shared CT builder:

**Parser side:** for each group, emit the parent row (bare uid, `group`,
`advanced.multiple` for arrays) plus one row per child whose THREE uid fields all
carry the **dotted path** `<parentUid>.<childUid>` (uid, `contentstackFieldUid`,
`backupFieldUid`); display name `Parent > child`. Children are the **union**
across all sample objects/array elements (heterogeneous element shapes contribute
their keys; internal keys like `_type`/`_key` skipped). Recursion nests further
(`a.b.c`); cap at `MAX_GROUP_DEPTH` (5) and fall back to a raw `json` leaf beyond
it or for zero-child groups (no data dropped, and empty-schema groups are invalid).
The templates ship this as `emitFieldRows` (contentTypes.ts) + a `parent` ctx on
`mapField`/`baseField` (schemaMapper.ts).

**Why dotted uids:** the api's `buildSchemaTree` (content-type-creator.utils.ts)
joins children to their group by prefix + one-level check on `contentstackFieldUid`
(falling back to `backupFieldUid` after UI remaps) and strips the dots from the
final CT schema. The mapper round-trip (`createDummyData` → lowdb → `fieldAttacher`)
stores and returns the rows **as-is**, so dotted rows flow to both CT creation and
entry creation unchanged.

**Entry side (`transformField case 'group'`):**
- find direct children from the flat `ct.fieldMapping` with the SAME prefix +
  one-level predicate (+ `backupFieldUid` fallback);
- per source element, build an object keyed by the **last uid segment**
  (`getLastUid`), transforming each child by re-entering the same switch — so
  nested rich text, images (→ full asset records), references, and deeper groups
  all reuse the existing machinery;
- single group → object; `multiple` → array of objects; absent keys per element
  stay unset (heterogeneous unions); empty results → `undefined` (key unset).
- ⚠️ **Mandatory companion fix:** in `createEntry`'s field loop, `continue` on any
  row whose `contentstackFieldUid` contains `.` — child rows must never be
  processed at top level (a child named like a top-level key would otherwise write
  a literal `parent.child` key into the entry).

**Faithfulness note:** heterogeneous arrays (per-element `_type`) flatten into one
union-shaped group; the per-element discriminator is not preserved. The faithful
alternative is **modular blocks** (one block type per element `_type`) — a
worthwhile follow-up, not the default.

Log skipped/unresolved counts explicitly — silent drops read as "fully imported" when they aren't.
