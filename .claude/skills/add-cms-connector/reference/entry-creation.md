# Entry creation (api `createEntry`)

Content-type **schemas** are created generically (the mapper UI →
`contenTypeMaker` writes `cmsMigrationData/<stackId>/content_types/<cs_uid>.json`).
Your service's `createEntry` creates the **entries**. If you skip it, the
migration produces content types but **zero entries** — the classic "it ran but
nothing imported" symptom.

## Runtime inputs

`createEntry(file_path, packagePath, destinationStackId, projectId, contentTypes, mapperKeys, master_locale, project)` — set in `migration.service.ts` before the switch:

- **`file_path`** = `project.legacy_cms.file_path` — the **original upload, verbatim**.
  ⚠️ For an **archive** connector this is the **raw archive** (e.g.
  `backup-export.tar.gz`), NOT the extracted directory. Reading it as data fails
  silently: gzip bytes parse to 0 records → content types appear (schemas are
  created generically) but **0 entries / 0 assets**. For a plain folder upload
  it's the directory; for a single-file connector, the file.
- **`packagePath`** = `project.extract_path` — where server-side extraction put
  the usable export (e.g. `upload-api/extracted_files/<name>/` holding
  `data.ndjson` + `images/`).
- **Resolve, don't trust:** locate the data root by trying **both** bases and
  accepting only a real data file (e.g. an existing `.ndjson` — the archive gets
  skipped, the extracted dir wins). See `resolveDataFile`/`findExportRoot` in the
  shipped `sanity.service.ts`. Both `createEntry` **and** `getAllAssets` must
  resolve this way — asset binaries (`images/`…) live under the extracted dir too.
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

Every entry MUST have a non-empty `title`. The CT schema side guarantees `title`
and `url` rows exist (parser `ensureMandatoryFields` — Contentstack rejects CT
updates without them: `should have a 'title'/'url' field`). On the entry side:
when the parser **re-pointed** a display field (e.g. Sanity `name`) at uid
`title`, read the value via the row's `otherCmsField`, not the uid; when `title`
was **synthesized** (no display candidate), derive one (source id / first text
field). The `url` field may be left empty on entries — only the schema row is
mandatory.
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
records exist on disk when entries are built). Same `file_path` caveat as above:
for an archive upload the binaries are under `packagePath`'s extracted dir, not
next to the `.tar.gz` — resolve the export root the same way `createEntry` does. It writes the standard asset
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

## Modular blocks (heterogeneous arrays)

Arrays whose elements carry a per-element type discriminator with **≥ 2 distinct
values** (e.g. a Sanity `pageBuilder` mixing `infoSection`/`callToAction`) map to
Contentstack **modular blocks** — one block type per element type — instead of a
union-shaped group. Homogeneous arrays (one type / no discriminator) stay
group+multiple.

**Parser rows** (3 levels, all via `baseField`):
- parent: bare uid, `contentstackFieldType: 'modular_blocks'` (no `advanced.multiple`
  — the CT builder hardcodes `multiple: true`);
- one block row per distinct type: uid `<parent>.<blockUid>`,
  `'modular_blocks_child'`, and **`otherCmsField` = the RAW source type string** —
  that's the entry-time join key;
- per-block field rows recursed from THAT type's elements only: uid
  `<parent>.<block>.<field>` (groups inside blocks nest further — supported).

`buildSchemaTree` recognizes `modular_blocks_child` rows one level under the
parent and emits `data_type: 'blocks'` with `{title: <raw type>, uid, schema}` per
block. A blocks field consumes TWO uid segments, so recurse block fields at
`depth + 2`.

**Two hard rules:**
- **No blocks inside blocks** (Contentstack rejects them). Thread an `inBlocks`
  flag through the recursion ctx; heterogeneous arrays under a blocks ancestor
  fall back to group+multiple. Blocks inside plain groups are fine.
- Emit `isDeleted: false` on every parser row — the CT builder's block path
  filters on `isDeleted === false` **strictly**.

**Entry value** — array of single-key objects in **source order** (this preserves
the author's interleaving, e.g. `info, cta, info, cta`):
```json
"pagebuilder": [
  { "infosection":  { "heading": "About", "content": { "type": "doc", ... } } },
  { "calltoaction": { "title": "Buy now", "link": { "href": "/buy" } } }
]
```
The transform routes each element by its RAW type → block row (`otherCmsField`
match, with a uid-normalized `backupFieldUid` fallback for UI renames), builds the
inner object from the block's child rows (recursing the same switch — images →
asset records, portable text → JSON-RTE, nested groups), and skips elements with
no matching block (count + log; don't synthesize a catch-all block).

Log skipped/unresolved counts explicitly — silent drops read as "fully imported" when they aren't.
