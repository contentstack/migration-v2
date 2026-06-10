---
name: add-cms-connector
description: Scaffold a brand-new legacy-CMS connector (e.g. Sanity, Strapi, Joomla, a custom/traditional CMS) end-to-end across the upload-api parser, the api transform service, and the ui registration. Use this when the user wants to add support for migrating a NEW source CMS into Contentstack and gives a sample export of that CMS's data. For adding/changing a single field-type mapping in an EXISTING connector, use add-connector-field instead.
---

# Add a new CMS connector

This repo (`migration-v2`) migrates content from a legacy CMS into Contentstack. A connector spans **four layers**. This skill scaffolds all of them from a **sample export** of the new CMS so nothing is missed.

> Read `reference/touchpoints.md` for the exact file list and line anchors before editing. Never rely on memory for which files to touch — open the file and find the current anchor (line numbers drift).

## Inputs you need from the user

1. **CMS name** — e.g. `Sanity`. Derive three forms:
   - `<cms>` — lowercase, no spaces, used as the enum value / cms_id / dep key (`sanity`).
   - `<Cms>` — PascalCase for symbols (`Sanity`) → `create<Cms>Mapper`.
   - `<CMS>` — UPPER_SNAKE for the enum key (`SANITY`).
2. **A sample export file/folder** — JSON, XML, SQL dump, an **archive** (`.tar.gz`/`.zip`), or a folder. Determine the export **shape** (this drives everything downstream):
   - **single file** (json/xml) → `<ext>` = the real extension; validator key `<cms>-<ext>`; parser reads one file.
   - **NDJSON** (one JSON doc per line, e.g. Sanity `data.ndjson`) → still a file, but use `readNdjson`, not `JSON.parse`.
   - **folder** or **archive** → `<ext>` = **`folder`** at runtime (archives are extracted server-side and re-enter the folder branch); validator key `<cms>-folder`; the validator/parser receive a **directory path** and must locate the data file. The `legacyCms.json` file-format uses `directory`/`Folder` (mirror `aem`), NOT the archive extension.
   - **database** (e.g. Drupal/MySQL) → no file; query the DB.

   ⚠️ Read `reference/upload-flow.md` — it maps each upload kind to its `fileExt`, the `data` shape your validator gets, and the `filePath` your mapper gets. Most CMS exports download as a `.tar.gz`/`.zip` archive; the upload-api extracts them (`isArchive`/`extractArchive` in `src/helper/index.ts`) and runs them as `folder`.

If the user has not given a sample export, ask for one. The whole point is to infer the real field shapes — do not invent them.

## Workflow

### Step 1a — Research the source CMS's documented field types
The sample export only shows types that happen to APPEAR in it — a connector seeded
solely from the sample silently drops every documented type the sample lacks.
Before inspecting the sample, fetch the CMS's official docs:

- `WebSearch`/`WebFetch` the CMS's **schema / field-type reference** and **export-format docs**. Examples:
  - Sanity: schema-types reference (`string`, `text`, `slug`, `image`, `file`, `reference`, `array`, `object`, `block`, `boolean`, `number`, `date`, `datetime`, `url`, `geopoint`) + the dataset-export format (NDJSON, `_sanityAsset` vs `asset._ref` forms).
  - Joomla: the `#__content` / custom-fields tables and field-type list (text, textarea, editor, calendar, checkboxes, list, media, sql, subform, user…) + how `com_fields` values serialize in an export/dump.
- From the docs, list the CMS's **complete field-type vocabulary** — not just what the sample shows.
- Also note **export-format variants** the sample may not contain (e.g. Sanity asset refs come in two forms; only one appeared in our sample). The parser/validator must handle the documented variants, not just the observed ones.
- Contentstack side: the **repo stays the oracle** (existing connectors + written packages define the package formats this pipeline's importer consumes). Use Contentstack docs only as a tie-breaker when the repo has no precedent.

### Step 1b — Inspect the sample export & infer the field map
- Read the sample. Enumerate the **distinct source field/widget types** present (e.g. Sanity: `string`, `text`, `slug`, `image`, `reference`, `array`, `object`, `block`/portable-text, `boolean`, `number`, `datetime`).
- Build the mapping table from the **union: documented types (Step 1a) ∪ sample types** — docs give completeness, the sample gives ground truth on the real serialized shapes. **On conflict, the sample wins** (docs describe the studio schema; the export is what you actually parse).
- For each, choose a Contentstack target type from the vocabulary in `migration-wordpress/interface/interface.ts` (`Field.contentstackFieldType`):
  `single_line_text`, `multi_line_text`, `text`, `html`, `json`, `markdown`, `number`, `boolean`, `isodate`, `file`, `reference`, `taxonomy`, `link`, `group`, `global_field`, `url`.
- Present the proposed table to the user with `AskUserQuestion` (or inline) and **get confirmation before generating code**. Mark which rows came from docs-only (untested against real data) vs sample-verified. Suggested mapping for common source types:

  | source kind | Contentstack type |
  |---|---|
  | short string / title | `single_line_text` |
  | long text / textarea | `multi_line_text` |
  | rich text / portable-text / blocks / HTML | `json` (RTE/JSON-RTE) or `html` |
  | image / file / media / asset ref | `file` |
  | reference / relation / entry link | `reference` |
  | array of objects / repeatable group | `group` (with `multiple: true`) |
  | object / nested fields | `group` |
  | enum / select / dropdown | `single_line_text` (or `dropdown`) |
  | boolean / toggle | `boolean` |
  | integer / float | `number` |
  | date / datetime | `isodate` |
  | url / link | `link` or `url` |
  | taxonomy / category / tag | `taxonomy` |

### Step 2 — Scaffold Layer A: the parser package `upload-api/migration-<cms>/`
Create the package from `templates/upload-api-package/`. Copy each template file, replacing `<cms>`/`<Cms>`/`<CMS>` placeholders:
- `package.json`, `tsconfig.json`, `config/index.json`
- `index.ts` (exports `extractContentTypes`, `extractLocale`)
- `interface/interface.ts` (the `Field` shape — keep identical to wordpress so the api side consumes it unchanged)
- `libs/extractLocale.ts`, `libs/contentTypes.ts`
- `libs/schemaMapper.ts` — **seed the switch with the confirmed mapping from Step 1b** (the docs ∪ sample union — include the docs-only types so fields absent from the sample don't fall through to the default case). Each case returns a `Field` with the chosen `contentstackFieldType`.
- `utils/helper.ts`

Parse logic in `contentTypes.ts`/`extractLocale.ts` must match the real sample shape. Concretely:
- **Pick the read strategy** for your export shape — JSON array (`JSON.parse`), NDJSON (`readNdjson`), folder-of-files (walk it), or DB (query). The template now ships `findDataFile` (resolves a directory/archive-extracted path to the real data file — adapt its `targetName`) and `readNdjson` in `utils/helper.ts`. `filePath` may be a **directory** for folder/archive connectors.
- **Filter system/internal/draft records** before grouping by type (the `isSystemRecord` hook in `contentTypes.ts`). Every CMS ships internal docs — Sanity `sanity.*` + `drafts.*`, WordPress `attachment`/`wp_*`, etc. Skipping this generates junk content types.
- **Infer types from data** (no schema in most exports): the template's `inferSourceType` detects ISO-8601 dates → `datetime`, tagged objects (`{_type: image|reference|slug}` — CMS-specific) → their type, `block[]` → rich text, media arrays → multiple file, object arrays → repeatable group. Some distinctions (short vs long string) collapse without a schema — that's fine, the user refines in the field-mapping UI.
- **Expand groups into dotted child rows** (the template's `emitFieldRows`): nested objects / arrays-of-objects emit a group parent row plus per-child rows whose uids carry the dotted path (`parent.child`) — this is what nests the CT schema AND lets the entry transform build group values. See `reference/entry-creation.md` § Nested groups.
- The emitted CT object keys are `otherCmsTitle`/`otherCmsUid`/`contentstackTitle`/`contentstackUid`/`type`/`fieldMapping` (no top-level `uid`/`title`) — this is the contract the api side consumes; keep them.

### Step 3 — Wire Layer B: `upload-api/src/`
1. `upload-api/package.json` — add to `dependencies`: `"migration-<cms>": "file:migration-<cms>"` (alongside the other `migration-*` entries, ~lines 67–71). Keep the package-folder name and the dep key both `migration-<cms>`.
2. `upload-api/src/controllers/<cms>/index.ts` — create `create<Cms>Mapper` from `templates/upload-api-controller.ts`. It calls `extractLocale` → POST `/v2/migration/localeMapper/:projectId`, then `extractContentTypes` → POST `/v2/mapper/createDummyData/:projectId`.
3. `upload-api/src/services/createMapper.ts` — `import create<Cms>Mapper from '../controllers/<cms>';` and add `case '<cms>': { return create<Cms>Mapper(filePath, projectId, app_token, affix, config); }` to the switch.
4. `upload-api/src/validators/<cms>/index.ts` — create a validator (validators are **directories**, not single files; default-export). Use `templates/upload-api-validator.ts`. ⚠️ The `data` arg shape is **branch-dependent** (see `reference/upload-flow.md`): folder/archive → a **directory path string** (stat it, locate the data file, sniff the first record — model `validators/aem` / `validators/sanity`); xml/json → a raw string; zip → a JSZip object. Then in `upload-api/src/validators/index.ts` import it (`import <cms>Validator from './<cms>';`) and add `case '<cms>-<ext>': { return <cms>Validator({ data }); }`. For folder/archive connectors `<ext>` is **`folder`** → key `<cms>-folder` (you do NOT need a `<cms>-gz`/`-zip` case; archives are normalized to the folder branch upstream).

### Step 4 — Wire Layer C: `api/src/`
1. `api/src/constants/index.ts` — add `<CMS>: '<cms>',` to the `CMS` object (~lines 40–48).
2. Create the transform service. Two options — match an existing one:
   - **Monolithic** like `api/src/services/wordpress.service.ts`: a single file exporting `{ createEntry, createLocale, createVersionFile, getAllAssets?, createTaxonomy?, createRefrence? }`.
   - **Modular** like `api/src/services/drupal/`: a folder of per-concern files re-exported from `<cms>.service.ts`.
   Use `templates/api-service.ts` as the starting skeleton. The Contentstack-type → API-data-type map (`mapFieldTypeToDataType`, see `drupal/content-types.service.ts` ~lines 448–474) belongs here — copy it and extend if the new connector introduces a type not already listed.

   ⚠️ **`createEntry` is where entries are actually produced** — content-type *schemas* are created generically, so if `createEntry` is a stub the migration yields content types but **zero entries**. Read `reference/entry-creation.md` before writing it: it documents the runtime inputs (`file_path`/`packagePath`, the `contentTypes` shape from `fieldAttacher`, `mapperKeys`), the exact output layout (`entries/<ct>/<locale>/<locale>.json` + `index.json`), the per-`contentstackFieldType` value transform (hand-roll a switch like Drupal's `processFieldByType` — the shared `entriesFieldCreator` is HTML-oriented), reference resolution via a source-id → entry-uid index, the **`getAllAssets`** pass (runs *before* `createEntry`; copies local export binaries or downloads by url, then `file` fields resolve to the full asset record), and **nested groups** via the dotted-child contract (parser emits `parent.child` rows; `buildSchemaTree` nests the CT schema; the group case builds values keyed by the last uid segment — children recurse through the same switch, and `createEntry` must skip dotted rows at top level).
3. `api/src/services/migration.service.ts` — **two edits in two switches**:
   - import: `import { <cms>Service } from './<cms>.service.js';` (~lines 26–42).
   - **Test migration** switch (~lines 452–590): add `case CMS.<CMS>: { ... break; }` calling the service methods (model the `CMS.WORDPRESS` case).
   - **Full migration** switch (~lines 856–1020): add the **same** `case CMS.<CMS>:`.
   ⚠️ Forgetting the second switch is the classic bug — the connector works in test but silently no-ops in full migration. The grep guard in verification catches this.

### Step 5 — Wire Layer D: `ui/`
1. `ui/src/cmsData/legacyCms.json` — append an entry to `all_cms`. Use the variant matching your shape (full snippets in `templates/wiring-snippets.md`):
   - **single file** (json/xml/sql): `allowed_file_formats` uses the real extension (model `wordpress`: `fileformat_id: "xml"`).
   - **folder / archive**: mirror `aem` — `fileformat_id: "directory"`, `title: "Folder"`, `group_name: "directory"`. ⚠️ Do NOT use the archive extension (`tar.gz`/`zip`); directory uploads and server-extracted archives run as `fileExt 'folder'` → validator key `<cms>-folder` (see `reference/upload-flow.md`).
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
   `cms_id` MUST equal the `CMS` enum value string. The card renders automatically — no component changes. `_metadata.uid` (present on existing entries) is CMS-managed; new hand-added entries may omit it.
2. `ui/src/utilities/constants.ts` — optionally add a `VALIDATION_DOCUMENTATION_URL['<cms>']` entry (data-requirements PDF link).

### Step 6 — Verify
Run the checklist below. Report results honestly — if a build fails, show the output, don't claim success.

⚠️ **`api` and `ui` do NOT compile cleanly from scratch.** A bare `tsc --noEmit`
emits dozens of **pre-existing** errors (missing `@types/express|lodash|mysql2|
jsonwebtoken|fs-extra`, `import.meta`, implicit-any in untouched files). Run
`npm install` first, then judge success by **"no NEW errors in YOUR files"**
(`<cms>.service.ts`, your `migration.service.ts` case lines) — not by zero global
errors. Filter the output (e.g. `... | grep -E '<cms>.service|migration.service'`).

## Verification checklist

```bash
# A. Parser package compiles
cd upload-api/migration-<cms> && npm install && npm run build

# A2. SMOKE-TEST THE PARSER against the real sample BEFORE wiring the rest.
#     This catches NDJSON/folder/system-doc/type-inference bugs immediately.
node -e "const {extractContentTypes,extractLocale}=require('./build/index.js');(async()=>{ \
  console.log('locales',await extractLocale('<path-to-sample-export>')); \
  const cts=await extractContentTypes('aff','<path-to-sample-export>',{}); \
  cts.forEach(c=>console.log(c.otherCmsTitle, c.fieldMapping.map(f=>f.otherCmsField+':'+f.contentstackFieldType)));})()"
# expect: real content-type titles (NOT system docs) + the confirmed field map.
# clean up: rm -rf cmsMigrationData   (the smoke test writes content_types there)

# B. file: dep resolves and upload-api server compiles (catches missing import/case).
#    NOTE: `npm run build` here also builds ALL migration-* packages (its
#    `for d in migration-*` loop), so the parser is rebuilt too.
cd ../ && npm install && npm run build

# C. api compiles — confirms BOTH migration.service switches + the new service typecheck.
#    Pre-existing errors are expected (see warning above); confirm none in YOUR files.
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "<cms>.service|migration.service" || echo "no new errors in your files"

# D. ui compiles / legacyCms.json parses (pre-existing vite/client error is expected)
cd ../ui && npm install && npx tsc --noEmit 2>&1 | grep -iE "legacycms|<cms>" || echo "no new errors in your files"
python3 -c "import json; json.load(open('ui/src/cmsData/legacyCms.json')); print('legacyCms.json OK')"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -rn "CMS.<CMS>" api/src/services/migration.service.ts
```

End-to-end smoke (optional but recommended): start `api`, `upload-api`, `ui`; pick the new CMS in the selection screen; upload the sample export **exactly as the CMS produces it** (e.g. the `.tar.gz` — the server extracts archives); confirm content types + entries are written under `upload-api/cmsMigrationData/` and the field-mapping screen shows the inferred fields.

## Conventions to preserve (do not "fix")
- The misspelling `createRefrence` is the real method name — match it where used.
- `file:` local deps, not npm workspaces.
- Parser package emits to `./cmsMigrationData` per its `config/index.json`.
- Keep the `Field` interface identical across parser packages so the api side stays generic.
- **Validators and controllers are DIRECTORIES** (`validators/<cms>/index.ts`, `controllers/<cms>/index.ts`), not single `.ts` files.
- **Controller export style is inconsistent**: most `export default` (follow this), but `aem` uses a named `export { createAemMapper }`. Also `contentful`/`drupal` controllers live under `src/services/`, not `src/controllers/`. Follow the wordpress pattern (default-export from `../controllers/<cms>`) for new connectors.
- **Folder connectors:** the runtime `fileExt` for any directory upload is hardcoded `folder` (and archives are extracted into the folder branch) — so the validator key is `<cms>-folder` and `legacyCms.json` uses `fileformat_id: "directory"`, regardless of the actual archive format.
- The emitted content-type object uses `otherCmsTitle`/`otherCmsUid`/`contentstackTitle`/`contentstackUid` (no top-level `uid`/`title`).
