# DatoCMS connector — TRD

> Feature: `datocms-connector` · Connector(s): `datocms` · Stage 2 (TRD) · Author: Chirag Chavan · Date: 2026-07-01 · **Last reconciled with code: 2026-08-14** · Status: Implemented

> **Note:** this document has been updated to match the connector as actually built. Sections that changed during implementation are marked **[changed in implementation]**.

## Summary

Implements FR-1…FR-11 from the PRD by adding a `datocms` connector across all four layers. Layer A is a new `upload-api/migration-datocms/` package (**TypeScript**, not JS) modeled on **Contentful's** field-mapping approach (`contentTypeMapper`-style switch producing a Contentstack schema) combined with **AEM's** multi-file-plus-assets-folder discovery (DatoCMS's export is 4 JSON files + an `assets/` binary folder, not Contentful's single JSON file). Because the export is multi-file, DatoCMS needs an orchestrating `upload-api/src/controllers/datocms/` — Contentful and Drupal skip a controller because their exports are single-file/DB-driven; Sitecore, WordPress, and AEM all have one because theirs aren't. **[changed in implementation]** Layer C is *not* a single service file: `api/src/services/datocms.service.ts` is a thin barrel re-exporting a `api/src/services/datocms/` module folder (`assets`, `content-types`, `entries`, `locales`, `version`). It exposes `createAssets`, `createEntry`, `createLocale`, `createVersionFile` plus `mapFieldTypeToDataType`; there is no standalone `createReference` — reference resolution happens inside `entries.service.ts`.

## Architecture impact

| Layer | Files to change | Change |
|---|---|---|
| **A — parser** `upload-api/migration-datocms/` **[changed in implementation]** | `index.ts` (exports `extractContentTypes`, `extractLocale`), `libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`, `utils/helper.ts`, `interface/interface.ts`, `config/index.json`, `package.json`, `tsconfig.json` | New package, written in **TypeScript** (the original plan said `.js`). `contentTypes.ts` reads `content_types.json` + `fields.json`, splits the 13 `modular_block:false` entry types from the 19 `modular_block:true` block types, and builds the shared `blocksById` id → `{apiKey, contentstackUid, isBlock}` lookup once. `schemaMapper.ts` runs the per-field switch (see *Data & field-type mapping*) producing Contentstack field schema — the Layer A/B equivalent of Contentful's `contentTypeMapper()`. `extractLocale.ts` derives locale codes from **two** signals — `assets.json`'s `default_field_metadata` (locale keys sit one level below the field name, e.g. `{ alt: { en: … } }`) *and* any `{locale: value}`-shaped field value in `records.json`, closing the locale-gap risk noted below. **No `createInitialMapper` module was built** — the mapper payload is assembled by the Layer B controller instead. |
| **B — upload-api wiring** | `src/services/createMapper.ts` (switch, **line 118**), `src/validators/index.ts` (switch, **line 41**), new `src/controllers/datocms/index.ts`, new `src/validators/datocms/index.ts`, `package.json:70` | New `case 'datocms': createDatocmsMapper(filePath, projectId, app_token, affix, config)` in `createMapper.ts`. New `case 'datocms-folder': datocmsValidator({ data })` in `validators/index.ts`. New controller orchestrates the parser (mirrors `controllers/aem/index.ts`'s `createAemMapper()`: call `contentTypes()`, `locales()`, POST to `.../v2/migration/localeMapper/{projectId}`, POST to `.../v2/mapper/createDummyData/{projectId}`). `package.json:70` carries `"migration-datocms": "file:migration-datocms"` and the package now exists. |
| **C — api transform** **[changed in implementation]** | `api/src/services/datocms.service.ts` (barrel), `api/src/services/datocms/{assets,content-types,entries,locales,version}.service.ts` + `interface.ts`, `api/src/constants/index.ts` (`CMS` enum), `api/src/services/migration.service.ts` (**TWO switches**, **line 491** test / **line 916** full) | Split into a module folder rather than one file — `datocms.service.ts` is a 14-line barrel exporting `datocmsService = { createAssets, createEntry, createLocale, createVersionFile }` plus `mapFieldTypeToDataType`. `entries.service.ts` (~516 lines) carries the bulk: value transformation, reference resolution, DAST embedded-entry handling, and locale-specific block records. **`mapFieldTypeToDataType` does exist** (`content-types.service.ts:7`) — it maps the *already-assigned* Contentstack field type to its API data type (copied from Drupal's, extended with `modular_blocks` → `blocks`); source-field-type→Contentstack-type mapping still happens in Layer A's `schemaMapper.ts`. New `DATOCMS: 'datocms'` in the `CMS` enum (`constants/index.ts:48`). New `case CMS.DATOCMS` in **both** `migration.service.ts` switches. |
| **D — ui registration** | `ui/src/cmsData/legacyCms.json` (`all_cms` entry), `ui/src/utilities/constants.ts` (doc url) | New entry with `cms_id: "datocms"`, `allowed_file_formats: [{ fileformat_id: "directory", title: "Folder" }]` — following the **AEM** entry's `"directory"` format (not Contentful's `"json"`), since the export is a folder. |

## Data & field-type mapping

Reconciled against the implemented switch in `upload-api/migration-datocms/libs/schemaMapper.ts` (`mapField`, from line 165). Rows marked **[changed]** differ from the original TRD design.

| DatoCMS `field_type` | Editor / validator signal | Contentstack type | Notes |
|---|---|---|---|
| `string` / `slug` | `single_line` (default) | `single_line_text` | Direct, matches Contentful's `Symbol`/`singleLine` → `single_line_text`. `slug` shares this case. |
| `string` / `slug` **[changed]** | `string_radio_group` or `string_select` | `dropdown` | Options come from `appearance.parameters` — `radios` for radio groups, `options` for selects — emitted as `{key: label, value}` pairs on `advanced.options`. (The original TRD paired this with `string_checkbox_group`; checkbox/multi-select actually arrive as `json`, see below.) |
| `text` | `markdown` editor | `markdown` | Direct. |
| `text` | `wysiwyg` editor | `html` (RTE) | Mirrors Contentful's `jsonToHtml()` path for `html` fields. |
| `text` | `textarea` / any other editor | `multi_line_text` | Default branch of the `text` case. |
| `boolean` | — | `boolean` | Direct. |
| `integer` / `float` | — | `number` | Direct. |
| `integer` / `float` **[changed]** | `star_rating` editor or `starRating` field extension | **`extension`** (`dato_star_rating`) | Added during implementation — star ratings render as a Contentstack custom field extension rather than a plain number. |
| `date` / `date_time` **[changed]** | `date_picker` | `isodate` | `date_time` was added to the switch during implementation; it is schema-only in the sample (no populated instances). |
| `json` **[changed]** | `string_checkbox_group` or `string_multi_select` | `dropdown` with `advanced.multiple: true` | DatoCMS stores multi-select/checkbox values as `json`; options read from `appearance.parameters.options`. |
| `json` **[changed]** | any other editor | **`extension`** (`dato_json`) | Was a plain `json` passthrough in the original design; now a custom field extension. |
| `color` **[changed]** | `color_picker` | **`extension`** (`dato_color`) | Was `json` in the original design. Now a Contentstack custom field extension so the colour renders as a picker rather than a raw object. |
| `lat_lon` | `map` editor | `group` with two `number` sub-fields | Sub-fields are named **`latitude`** / **`longitude`** (the original TRD said `lat`/`lon`). Direct analog to Contentful's `Location` → `group` handling. |
| `seo` | — | `group` with `title` (`single_line_text`), `description` (`multi_line_text`), `image` (`file`) sub-fields | No native Contentstack SEO field. |
| `file` | `file` editor | `file` (single asset reference) | Resolved via the asset-id index (see *Assets*). |
| `gallery` | `gallery` editor | `file`, `advanced.multiple: true` | Matches Contentful's `assetGalleryEditor` → `file` + multiple flag. |
| `video` **[changed]** | — | **`link`** | Was `json` in the original design. DatoCMS video fields carry external-provider metadata, so the `url` + `title` pair maps onto a Contentstack `link` field. |
| `link` | validators: `item_item_type.item_types` | `reference` (single) | Target UIDs resolved through the shared `blocksById` index; unresolvable ids are filtered out. |
| `links` | validators: `items_item_type.item_types` | `reference`, `advanced.multiple: true` | Same index, array form. |
| `single_block` **[changed]** | validators: `single_block_blocks.item_types` | **`reference`** to the block's content type | **Resolved differently than designed.** The original TRD proposed a `global_field` reference and flagged it as an unverified design risk. Implementation converts block types into real Contentstack **content types** and points a `reference` field at them; a missing/unresolvable `item_types` list logs a warning rather than failing silently. *(Some inline comments in `schemaMapper.ts` still say `global_field` — stale wording, not behaviour.)* |
| `rich_text` | validators: `rich_text_blocks.item_types` | `modular_blocks` (`blocks`) | One block definition per allowed `item_type`, each block's schema coming from that block content type. Blocks with no resolvable info or no fields are skipped with a warning. |
| `structured_text` **[changed]** | validators: `structured_text_blocks` / `structured_text_inline_blocks` / `structured_text_links` | **`json`** (JSON RTE) with `advanced.embedObjects` | Implemented concretely rather than left open. The three validator arrays are unioned and de-duplicated into the allowed content-type UIDs, set on `advanced.embedObjects` so the content-type builder emits `embed_entry: true` + `reference_to`. DAST `block`/`inlineItem`/`itemLink` extraction happens in Layer C (`entries.service.ts`). Structured-text record linking is configured via the field's **Validations** tab per prior session notes; confirm those are set before testing linked structured text. |

## Entry-creation considerations

- **References** **[changed in implementation]** — no separate `createReference` step or `references.json` file was built. Reference resolution lives inside `api/src/services/datocms/entries.service.ts`, which maintains its own in-memory document index and resolves `reference`-typed fields (and DAST embedded entries) during `createEntry`.
- **Nested groups** — `lat_lon` and `seo` become Contentstack `group` fields with fixed sub-fields, following Contentful's `Location` → `group` handling directly (no dotted-child schema-tree needed since these are fixed shapes, not open-ended nesting).
- **Modular blocks** **[changed in implementation]** — `rich_text` fields become `modular_blocks`, one block schema per `rich_text_blocks.item_types` entry. The 19 `modular_block: true` DatoCMS types are converted into **real Contentstack content types** (not global fields), parsed once and referenced wherever allowed. `single_block` fields resolve to a `reference` at those content types — the open design question in the original TRD is closed.
- **Locale-specific block records** — because a parent record's locales can reference *different* block record ids, `entries.service.ts` tracks which destination locales actually reference each block record and writes a block record only for those locales, rather than duplicating it across all five.
- **Assets** — DatoCMS's `assets.json` entries and the `assets/` folder's filenames are deterministically linked: a local file is always named `u_{assets.json id}__{basename}.{ext}` (verified against the sample — e.g. id `SLZgKoSbQR6_XHDzvcuiTA` ↔ file `u_SLZgKoSbQR6_XHDzvcuiTA__assorted-color-clothes-hanging.jpg`). This is simpler than AEM's path-dedup-by-filename logic (DatoCMS ids are already unique per asset) and closer to Contentful's `saveAsset()` shape — read `assets.json`, resolve each entry's local file directly by id-prefixed filename, upload, and build a `assetId[id] → uid` index (Contentful's `assetId[sys.id]` pattern) before `createEntry` runs, since `file`/`gallery` fields resolve through that index.

## Upload / validation flow

- **Export shape** — extracted folder: `content_types.json`, `fields.json`, `records.json`, `assets.json`, `assets/` (per FR-1); a zip of the same structure is the supported sibling.
- **Validator key** — `datocms-folder` in `upload-api/src/validators/index.ts`, following AEM's `aem-folder` convention (folder-shaped input) rather than Contentful's `contentful-json` (single-file input).
- **`data` arg shape** — directory path string, passed through to `upload-api/src/validators/datocms/index.ts`, which checks all four required JSON files are present and parse as valid JSON (mirroring `validators/aem/index.ts`'s presence checks) before the controller runs.

## Test & verification plan

```bash
# A. Parser package compiles (TypeScript)
cd upload-api/migration-datocms && npm install && npm run build

# B. upload-api compiles (file: dep + switches)
cd .. && npm install && npm run build

# C. api typecheck — success = no NEW errors in YOUR files
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "datocms.service|migration.service" || echo "no new errors in your files"

# D. ui typecheck / legacyCms.json parses
cd ../ui && npm install && npx tsc --noEmit 2>&1 | grep -iE "legacycms|datocms" || echo "no new errors in your files"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -n "case CMS.DATOCMS" api/src/services/migration.service.ts

# F. Field-type coverage: every field_type seen in the sample must appear in schemaMapper.ts's switch
python3 -c "
import json
d = json.load(open('/Users/chirag.chavan/Documents/dato-export-script/dato_data/fields.json'))
print(sorted({f.get('field_type') for v in d.values() for f in v.get('fields', [])}))
"
# Cross-check the printed list against the switch cases in upload-api/migration-datocms/libs/schemaMapper.ts — no type should be missing.

# G. End-to-end smoke test against the sample export
# Upload dato_data/ (or a zip of it) through the tool's UI/API, run a TEST migration,
# then a FULL migration, and confirm: 32 content types created (13 entries + 19
# blocks-as-global-fields/modular-blocks), 1,806 entries, 144 assets, 5 locales.
```

## Risks / rollout

| Risk | Status | Mitigation |
|---|---|---|
| Second `migration.service.ts` switch missed — works in test, no-ops in full | **Closed** | Both switches wired — `case CMS.DATOCMS` at lines 491 and 916. The grep guard above must keep showing 2 matches. |
| `single_block` has no verified Contentstack mapping pattern in this codebase | **Closed** | Resolved by converting block types into real Contentstack content types and mapping `single_block` to a `reference` at them, rather than the proposed `global_field` reference. |
| Locale extraction has no `locales[]` array to read (unlike Contentful) — deriving locales from `assets.json` alone could miss a locale with zero localized assets | **Closed** | `extractLocale.ts` combines both signals — `assets.json`'s `default_field_metadata` *and* `{locale: value}`-shaped field values in `records.json`. |
| `structured_text`/`rich_text` DAST-tree extraction is more complex than Contentful's `arrangeRte()` and may drop inline block/link references if under-scoped | **Open** | Mapping is implemented (`json` + `embedObjects`, with DAST handling in `entries.service.ts`), but still needs verification against records that actually contain populated `structured_text` values, not just the schema. |
| `video` field type has no populated sample instances — the `link` mapping is unverified against real data | **Open** | Mapping changed from JSON-passthrough to `link` (`url` + `title`); revisit if a sample with populated video fields surfaces. |
| Custom field extensions (`dato_color`, `dato_json`, `dato_star_rating`) must exist in the destination Contentstack stack for those fields to render | **Open** | Three field types now emit `extension` rather than a native type; confirm the extensions are installed/registered in the target stack as part of migration setup. |

## Links

- PRD: `docs/features/datocms-connector/prd.md`
- Use case: `docs/features/datocms-connector/use-case.md`
- Confluence: <filled after push — Step 4>
