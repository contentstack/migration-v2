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
2. **A sample export file/folder** — JSON, XML, SQL dump, or a folder. The extension/shape becomes `<ext>` (`json`/`xml`/`sql`/`folder`), which drives the validator key and `allowed_file_formats`.

If the user has not given a sample export, ask for one. The whole point is to infer the real field shapes — do not invent them.

## Workflow

### Step 1 — Inspect the sample export & infer the field map
- Read the sample. Enumerate the **distinct source field/widget types** present (e.g. Sanity: `string`, `text`, `slug`, `image`, `reference`, `array`, `object`, `block`/portable-text, `boolean`, `number`, `datetime`).
- For each, choose a Contentstack target type from the vocabulary in `migration-wordpress/interface/interface.ts` (`Field.contentstackFieldType`):
  `single_line_text`, `multi_line_text`, `text`, `html`, `json`, `markdown`, `number`, `boolean`, `isodate`, `file`, `reference`, `taxonomy`, `link`, `group`, `global_field`, `url`.
- Present the proposed table to the user with `AskUserQuestion` (or inline) and **get confirmation before generating code**. Suggested mapping for common source types:

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
- `libs/schemaMapper.ts` — **seed the switch with the confirmed mapping from Step 1**. Each case returns a `Field` with the chosen `contentstackFieldType`.
- `utils/helper.ts`

Parse logic in `contentTypes.ts`/`extractItems` must match the real sample shape (where the array of records lives, how locales are encoded). Adapt the wordpress traversal (`rss.channel.item`) to the new CMS's structure.

### Step 3 — Wire Layer B: `upload-api/src/`
1. `upload-api/package.json` — add to `dependencies`: `"migration-<cms>": "file:migration-<cms>"` (alongside the other `migration-*` entries, ~lines 67–71). Keep the package-folder name and the dep key both `migration-<cms>`.
2. `upload-api/src/controllers/<cms>/index.ts` — create `create<Cms>Mapper` from `templates/upload-api-controller.ts`. It calls `extractLocale` → POST `/v2/migration/localeMapper/:projectId`, then `extractContentTypes` → POST `/v2/mapper/createDummyData/:projectId`.
3. `upload-api/src/services/createMapper.ts` — `import create<Cms>Mapper from '../controllers/<cms>';` and add `case '<cms>': { return create<Cms>Mapper(filePath, projectId, app_token, affix, config); }` to the switch.
4. `upload-api/src/validators/<cms>.ts` — create a validator (model the existing `wordpress`/`contentful` validators: return `{ status, data }`). Then in `upload-api/src/validators/index.ts` import it and add `case '<cms>-<ext>': { return <cms>Validator(...); }` (the key is `${type}-${extension}`).

### Step 4 — Wire Layer C: `api/src/`
1. `api/src/constants/index.ts` — add `<CMS>: '<cms>',` to the `CMS` object (~lines 40–48).
2. Create the transform service. Two options — match an existing one:
   - **Monolithic** like `api/src/services/wordpress.service.ts`: a single file exporting `{ createEntry, createLocale, createVersionFile, getAllAssets?, createTaxonomy?, createRefrence? }`.
   - **Modular** like `api/src/services/drupal/`: a folder of per-concern files re-exported from `<cms>.service.ts`.
   Use `templates/api-service.ts` as the starting skeleton. The Contentstack-type → API-data-type map (`mapFieldTypeToDataType`, see `drupal/content-types.service.ts` ~lines 448–474) belongs here — copy it and extend if the new connector introduces a type not already listed.
3. `api/src/services/migration.service.ts` — **two edits in two switches**:
   - import: `import { <cms>Service } from './<cms>.service.js';` (~lines 26–42).
   - **Test migration** switch (~lines 452–590): add `case CMS.<CMS>: { ... break; }` calling the service methods (model the `CMS.WORDPRESS` case).
   - **Full migration** switch (~lines 856–1020): add the **same** `case CMS.<CMS>:`.
   ⚠️ Forgetting the second switch is the classic bug — the connector works in test but silently no-ops in full migration. The grep guard in verification catches this.

### Step 5 — Wire Layer D: `ui/`
1. `ui/src/cmsData/legacyCms.json` — append an entry to `all_cms` (model the `wordpress` entry):
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
   `cms_id` MUST equal the `CMS` enum value string. The card renders automatically — no component changes.
2. `ui/src/utilities/constants.ts` — optionally add a `VALIDATION_DOCUMENTATION_URL['<cms>']` entry (data-requirements PDF link).

### Step 6 — Verify
Run the checklist below. Report results honestly — if a build fails, show the output, don't claim success.

## Verification checklist

```bash
# A. Parser package compiles
cd upload-api/migration-<cms> && npm install && npm run build

# B. file: dep resolves and upload-api server compiles (catches missing import/case)
cd ../ && npm install && npm run build

# C. api compiles — confirms BOTH migration.service switches + the new service typecheck
cd ../api && npx tsc --noEmit

# D. ui compiles / legacyCms.json parses
cd ../ui && npx tsc --noEmit

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -rn "CMS.<CMS>" api/src/services/migration.service.ts
```

End-to-end smoke (optional but recommended): start `api`, `upload-api`, `ui`; pick the new CMS in the selection screen; upload the sample export; confirm content types + entries are written under `upload-api/cmsMigrationData/` and the field-mapping screen shows the inferred fields.

## Conventions to preserve (do not "fix")
- The misspelling `createRefrence` is the real method name — match it where used.
- `file:` local deps, not npm workspaces.
- Parser package emits to `./cmsMigrationData` per its `config/index.json`.
- Keep the `Field` interface identical across parser packages so the api side stays generic.
