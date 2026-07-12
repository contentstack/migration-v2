# DatoCMS connector — TRD

> Feature: `datocms-connector` · Connector(s): `datocms` · Stage 2 (TRD) · Author: Chirag Chavan · Date: 2026-07-01 · Status: Draft

## Summary

Implements FR-1…FR-11 from the PRD by adding a `datocms` connector across all four layers. Layer A is a new `upload-api/migration-datocms/` package modeled on **Contentful's** field-mapping approach (`contentTypeMapper`-style switch producing a Contentstack schema) combined with **AEM's** multi-file-plus-assets-folder discovery (DatoCMS's export is 4 JSON files + an `assets/` binary folder, not Contentful's single JSON file). Because the export is multi-file, DatoCMS needs an orchestrating `upload-api/src/controllers/datocms/` — Contentful and Drupal skip a controller because their exports are single-file/DB-driven; Sitecore, WordPress, and AEM all have one because theirs aren't. Layer C follows Contentful's `contentful.service.ts` shape (`createLocale`, `createAssets`, `createEntry`, `createReference`, `createVersionFile`) minus the Contentful-only extras (`createWebhooks`, `createEnvironment`, `createTaxonomy` — no DatoCMS analog in the sampled export, out of scope per the PRD).

## Architecture impact

| Layer | Files to change | Change |
|---|---|---|
| **A — parser** `upload-api/migration-datocms/` | `index.js` (exports), `libs/contentTypes.js`, `libs/schemaMapper.js`, `libs/extractLocale.js`, `libs/createInitialMapper.js` | New package. `contentTypes.js` reads `content_types.json` + `fields.json`, splits the 13 `modular_block:false` entry types from the 19 `modular_block:true` block types. `schemaMapper.js` runs the per-field switch (see *Data & field-type mapping*) producing Contentstack field schema — the Layer A/B equivalent of Contentful's `contentTypeMapper()`. `extractLocale.js` derives locale codes from `assets.json`'s `default_field_metadata` keys (no separate `locales[]` array exists in this export, unlike Contentful). `createInitialMapper.js` assembles the final `{ contentTypes: [...] }` payload, mirroring Contentful's `createInitialMapper()`. |
| **B — upload-api wiring** | `src/services/createMapper.ts` (switch, ~line 96), `src/validators/index.ts` (switch, ~line 19), new `src/controllers/datocms/index.ts`, new `src/validators/datocms/index.ts`, `package.json` | New `case 'datocms': createDatocmsMapper(...)` in `createMapper.ts`. New `case 'datocms-folder': datocmsValidator({ data })` in `validators/index.ts`. New controller orchestrates the parser (mirrors `controllers/aem/index.ts`'s `createAemMapper()`: call `contentTypes()`, `locales()`, POST to `.../v2/migration/localeMapper/{projectId}`, POST to `.../v2/mapper/createDummyData/{projectId}`). `package.json:70` already has the uncommitted `"migration-datocms": "file:migration-datocms"` line — just needs the package to exist. |
| **C — api transform** | `api/src/services/datocms.service.ts`, `api/src/constants/index.ts` (`CMS` enum), `api/src/services/migration.service.ts` (**TWO switches**, ~line 452 test / ~line 856 full) | New service exporting `createLocale`, `createAssets`, `createEntry`, `createReference`, `createVersionFile` (Contentful's core four plus a reference-index step — no `mapFieldTypeToDataType` function exists anywhere in this codebase today; field-type→Contentstack-type mapping happens in Layer A's `schemaMapper.js`, and Layer C's `createEntry` only switches on the *already-assigned* Contentstack type to transform values, matching how `contentful.service.ts`'s `processField()` works). New `DATOCMS: 'datocms'` in the `CMS` enum. New `case CMS.DATOCMS` in **both** `migration.service.ts` switches. |
| **D — ui registration** | `ui/src/cmsData/legacyCms.json` (`all_cms` entry), `ui/src/utilities/constants.ts` (doc url) | New entry with `cms_id: "datocms"`, `allowed_file_formats: [{ fileformat_id: "directory", title: "Folder" }]` — following the **AEM** entry's `"directory"` format (not Contentful's `"json"`), since the export is a folder. |

## Data & field-type mapping

Verified against the sample's actual `fields.json` (field types + validators) and `content_types.json`.

| DatoCMS `field_type` | Editor / validator signal | Contentstack type | Notes |
|---|---|---|---|
| `string` | `single_line` | `single_line_text` | Direct, matches Contentful's `Symbol`/`singleLine` → `single_line_text`. |
| `string` | `string_radio_group` / `string_checkbox_group` | `dropdown` | Options from the field's `validators` (mirrors Contentful's `createDropdownOrRadioFieldObject()`). |
| `text` | `markdown` editor | `markdown` | Direct. |
| `text` | `wysiwyg` editor | `html` (RTE) | Mirrors Contentful's `jsonToHtml()` path for `html` fields. |
| `text` | `textarea` editor | `multi_line_text` | Direct. |
| `boolean` | — | `boolean` | Direct. |
| `integer` / `float` | — | `number` | Direct. |
| `date` | `date_picker` | `isodate` | Direct, matches Contentful's `Date` → `isodate`. |
| `slug` | — | `single_line_text` | Matches Contentful's `slugEditor` → `single_line_text`. |
| `json` | — | `json` | Passthrough. |
| `color` | `color_picker` | `json` | No native Contentstack color field; store the `{red,green,blue,alpha}` object as-is. *(Not the same as the leftover `datocmsMigrationData/` sample's JSON-for-everything shortcut — this is scoped to the `color` type only.)* |
| `lat_lon` | `map` editor | `group` with two `number` sub-fields (`lat`, `lon`) | Direct analog to Contentful's `Location` → `group` handling (lines ~386–418 of `contentTypeMapper.js`). |
| `seo` | — | `group` with `title` (`single_line_text`), `description` (`multi_line_text`), `image` (`file`) sub-fields | No native Contentstack SEO field; validators confirm `title_length`/`description_length` caps — carry those as field-level validation. |
| `file` | `file` editor | `file` (single asset reference) | Resolved via the asset-id index (see *Assets*). |
| `gallery` | `gallery` editor | `file`, `multiple: true` | Matches Contentful's `assetGalleryEditor` → `file` + multiple flag. |
| `video` | — | `json` | Sample schema declares the type but no populated instances exist in `records.json`; DatoCMS video fields are normally Mux-hosted metadata objects, not files in `assets.json`. Store the raw object as JSON pending a real sample — flagged as an open question below. |
| `link` | validators: `item_item_type.item_types` | `reference` (single) | Target content type(s) from `item_types`; resolved via the entry-id index. |
| `links` | validators: `items_item_type.item_types` | `reference`, `multiple: true` | Same index, array form — mirrors Contentful's `entryLinksEditor` → `reference` handling. |
| `single_block` | validators: `single_block_blocks.item_types` (exactly one item type in every sampled field) | `global_field` reference to the one block type | **No existing connector implements this pattern** — flagged as a design risk below; recommended approach, not a verified one. |
| `rich_text` | validators: `rich_text_blocks.item_types` (one or more block item types) | `modular_blocks` (`blocks`) | One block definition per allowed `item_type`, each block's own schema coming from that block content type — direct analog to AEM's `modular_blocks` + `buildSchemaTree()` pattern (`api/src/services/aem.service.ts` `processFieldsRecursive()`). |
| `structured_text` | validators: `structured_text_blocks` / `structured_text_inline_blocks` / `structured_text_links` (`item_types` arrays, empty in the sample) | Contentstack RTE (JSON RTE) | The DAST tree's `block`/`inlineItem`/`itemLink` nodes need extraction analogous to Contentful's `arrangeRte()` (`contentTypeMapper.js` line ~357) — this is the deferred TRD-level decision the use-case's open questions flagged. Structured-text record linking is configured via the field's **Validations** tab per prior session notes; confirm the target field's Validations are set before testing linked structured text. |

## Entry-creation considerations

- **References** — `link`/`links` fields resolve via an id→uid index built from `records.json`'s `id` + `__itemTypeId`, mirroring Contentful's `entryId[id]` lookup inside `createEntry()`. Emit a `references.json`-equivalent file (Contentful's `createReference`/`createRefrence` pattern) so `createEntry` can resolve refs without re-scanning all 1,806 records per lookup.
- **Nested groups** — `lat_lon` and `seo` become Contentstack `group` fields with fixed sub-fields, following Contentful's `Location` → `group` handling directly (no dotted-child schema-tree needed since these are fixed shapes, not open-ended nesting).
- **Modular blocks** — `rich_text` fields become `modular_blocks`, one block schema per `rich_text_blocks.item_types` entry; each DatoCMS block type (the 19 `modular_block: true` content types) is parsed once as a Contentstack global-field-shaped schema and reused across every `rich_text` field that allows it, avoiding duplicate block definitions per parent content type. `single_block` fields are the open design question noted above — recommend prototyping against Contentstack's global-field-reference support before committing to the `modular_blocks`-with-exactly-one-block-type fallback if a true global-field reference isn't viable.
- **Assets** — DatoCMS's `assets.json` entries and the `assets/` folder's filenames are deterministically linked: a local file is always named `u_{assets.json id}__{basename}.{ext}` (verified against the sample — e.g. id `SLZgKoSbQR6_XHDzvcuiTA` ↔ file `u_SLZgKoSbQR6_XHDzvcuiTA__assorted-color-clothes-hanging.jpg`). This is simpler than AEM's path-dedup-by-filename logic (DatoCMS ids are already unique per asset) and closer to Contentful's `saveAsset()` shape — read `assets.json`, resolve each entry's local file directly by id-prefixed filename, upload, and build a `assetId[id] → uid` index (Contentful's `assetId[sys.id]` pattern) before `createEntry` runs, since `file`/`gallery` fields resolve through that index.

## Upload / validation flow

- **Export shape** — extracted folder: `content_types.json`, `fields.json`, `records.json`, `assets.json`, `assets/` (per FR-1); a zip of the same structure is the supported sibling.
- **Validator key** — `datocms-folder` in `upload-api/src/validators/index.ts`, following AEM's `aem-folder` convention (folder-shaped input) rather than Contentful's `contentful-json` (single-file input).
- **`data` arg shape** — directory path string, passed through to `upload-api/src/validators/datocms/index.ts`, which checks all four required JSON files are present and parse as valid JSON (mirroring `validators/aem/index.ts`'s presence checks) before the controller runs.

## Test & verification plan

```bash
# A. Parser package compiles
cd upload-api/migration-datocms && npm install && npm run build

# B. upload-api compiles (file: dep + switches)
cd .. && npm install && npm run build

# C. api typecheck — success = no NEW errors in YOUR files
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "datocms.service|migration.service" || echo "no new errors in your files"

# D. ui typecheck / legacyCms.json parses
cd ../ui && npm install && npx tsc --noEmit 2>&1 | grep -iE "legacycms|datocms" || echo "no new errors in your files"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -n "case CMS.DATOCMS" api/src/services/migration.service.ts

# F. Field-type coverage: every field_type seen in the sample must appear in schemaMapper.js's switch
python3 -c "
import json
d = json.load(open('/Users/chirag.chavan/Documents/dato-export-script/dato_data/fields.json'))
print(sorted({f.get('field_type') for v in d.values() for f in v.get('fields', [])}))
"
# Cross-check the printed list against the switch cases in upload-api/migration-datocms/libs/schemaMapper.js — no type should be missing.

# G. End-to-end smoke test against the sample export
# Upload dato_data/ (or a zip of it) through the tool's UI/API, run a TEST migration,
# then a FULL migration, and confirm: 32 content types created (13 entries + 19
# blocks-as-global-fields/modular-blocks), 1,806 entries, 144 assets, 5 locales.
```

## Risks / rollout

| Risk | Mitigation |
|---|---|
| Second `migration.service.ts` switch missed — works in test, no-ops in full | The grep guard above must show 2 matches. |
| `single_block` has no verified Contentstack mapping pattern in this codebase (no connector does global-field-style single-block references today) | Spike the mapping against a real Contentstack stack before writing `schemaMapper.js`'s `single_block` case; fall back to `modular_blocks` restricted to one block type if a true global-field reference isn't practical. |
| `structured_text`/`rich_text` DAST-tree extraction is more complex than Contentful's `arrangeRte()` (DatoCMS's tree format differs from Contentful's rich-text node format) and may drop inline block/link references if under-scoped | Treat as a dedicated implementation task, not a copy-paste of `arrangeRte()`; verify against records that actually contain populated `structured_text` values, not just the schema. |
| `video` field type has no populated sample instances — the JSON-passthrough mapping is unverified against real data | Flagged as an open question; revisit if a sample with populated video fields surfaces before or during implementation. |
| Locale extraction has no `locales[]` array to read (unlike Contentful) — deriving locales from `assets.json`'s `default_field_metadata` keys could miss a locale that has zero localized assets | Cross-check the derived locale list against every `localized: true` field's value shape in `records.json` as a second signal, not just `assets.json`. |

## Links

- PRD: `docs/features/datocms-connector/prd.md`
- Use case: `docs/features/datocms-connector/use-case.md`
- Confluence: <filled after push — Step 4>
