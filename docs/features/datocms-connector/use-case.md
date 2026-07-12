# DatoCMS connector — Use case

**Slug:** `datocms-connector` · **Author:** Chirag Chavan · **Date:** 2026-07-01 · **Status:** Draft

## Summary

Add DatoCMS as a supported source CMS in the migration tool, so a DatoCMS Management-API export (content types, fields, records, assets) can be parsed, mapped, and migrated into a Contentstack stack — following the same four-layer pattern already used for Sitecore, WordPress, AEM, Contentful, and Drupal.

## Problem / motivation

DatoCMS is a common headless CMS and is not currently a migration source. Customers/prospects on DatoCMS have no path into Contentstack through this tool today.

## Stakeholders

- Migration users moving off DatoCMS onto Contentstack.
- The connector/migration-tool team, closing a gap in CMS coverage (parity with existing connectors).

## References

| Source | Type | Link/Path | What it tells us |
|---|---|---|---|
| DatoCMS export sample | local file (folder) | `/Users/chirag.chavan/Documents/dato-export-script/dato_data` | Raw DatoCMS Management API export: `content_types.json` (32 item types), `fields.json` (dict keyed by item-type id → `model_name`/`model_api_key`/`is_block`/`fields[]`), `records.json` (1,806 flat items with `__itemTypeId` + `meta`), `assets.json` (144 uploads with per-locale `default_field_metadata`), `assets/` (146 binary files, hashed filenames). |
| `content_types.json` | local file | `dato_data/content_types.json` | 32 content types; 13 are standalone entries (`product`, `home`, `legal_page`, `layout`, `brand`, `collection`, `store`, `showcase`, `material`, `general_interface`, `example`, ...), 19 are flagged `modular_block: true` (`testimonial`, `hero_section`, `link_item`, `popup`, `dropdown_menu`, ...) — DatoCMS "blocks" nested inside `rich_text`/`single_block` fields rather than standalone records. |
| `fields.json` | local file | `dato_data/fields.json` | Field types in use: `boolean, color, date, file, float, gallery, integer, json, lat_lon, link, links, rich_text, seo, single_block, slug, string, structured_text, text, video`. 71 of 178 fields are flagged `localized: true` (per-field, not per-content-type). |
| `records.json` | local file | `dato_data/records.json` | 1,806 records, flat shape (fields live directly on the record alongside `__itemTypeId`/`item_type`/`meta`); localized field values appear as `{locale: value}` maps (e.g. `name: {en: "Cotton Blend", es: "Mezcla de Algodón", ...}`); non-localized fields are plain scalars. |
| `assets.json` | local file | `dato_data/assets.json` | 144 uploads with `url`, `path`, `format`, `mime_type`, `width`/`height`, and `default_field_metadata` keyed by locale (`en`, `it`, `de`, `fr`, `es`) for alt/title text — confirms real multi-locale content, not just schema capability. |
| `assets/` folder | local file (folder) | `dato_data/assets/` | 146 binary files (images), named by upload id, matching `assets.json` entries — the actual media to migrate. |
| Repo grep (`createMapper.ts`, `validators/index.ts`, `api/src/services`, `api/src/constants`, `ui/src/cmsData/legacyCms.json`) | repo | see paths below | No existing DatoCMS wiring in any of the four layers today. |
| `upload-api/package.json` (uncommitted diff) | repo | `upload-api/package.json:70` | Already has an uncommitted line `"migration-datocms": "file:migration-datocms"` added as a dependency — but no `upload-api/migration-datocms/` package exists yet. Signals a migration package was planned/started but not finished. |
| `upload-api/datocmsMigrationData/` | repo (untracked, gitignored via `*MigrationData*`) | `upload-api/datocmsMigrationData/content_types/*.json` | Leftover local output from a prior manual mapping attempt (fieldMapping-shaped JSON per content type, e.g. `cs_product.json`, `cs_material.json`) — evidence someone explored the mapping by hand, not connector code. Not authoritative; excluded as a design reference. |
| DatoCMS structured-text notes | prior session memory | `memory/project_datocms_notes.md` | Record linking inside DatoCMS structured-text fields is enabled via the field's **Validations** tab, not the editor toolbar — relevant when the TRD designs how `structured_text` blocks/inline links map onto Contentstack. |

## Assumptions & decisions

| Decision | Choice | Default? | Why |
|---|---|---|---|
| Driver | Internal roadmap — reach parity with existing connectors (Sitecore, WordPress, AEM, Contentful, Drupal) | Recommended default (confirmed by user) | No named customer/deal; DatoCMS is a common headless-CMS migration source with an obvious coverage gap. |
| Record scope | All 32 content types, including the 19 `modular_block` types | Recommended default (confirmed by user) | Blocks must resolve to real Contentstack content types/global fields so nested modular content in `rich_text`/`single_block` fields isn't lost or flattened to opaque JSON. |
| Assets | Migrate the 144 binaries and resolve `file`/`gallery`/`video` fields to real Contentstack asset references | Recommended default (confirmed by user) | Media is part of the content; the sample includes the actual asset files, not just references. |
| Locales | Multi-locale — migrate all 5 (`en`, `it`, `de`, `fr`, `es`); `en` is the Contentstack master locale | Recommended default (confirmed by user) — flips the skill's "single-locale unless sample shows i18n" default | Sample shows real i18n signal: per-locale asset metadata and 71/178 fields flagged `localized` in the schema. |
| Export-shape variants | Support the extracted-folder form the sample is in (4 top-level JSON files + `assets/` folder); a zipped version of the same structure is an obvious sibling to support | Yes (skill default) | Matches the reference sample; mirrors how Sitecore/AEM accept zip/folder variants. |
| Rich text / structured text | Map DatoCMS `rich_text` and `structured_text` fields to Contentstack rich text; exact JSON-RTE-vs-HTML shape and inline-block/link handling deferred to the TRD | Yes (skill default) | Keeps this use case at the "what," not the "how"; structured-text record linking (Validations tab) needs a TRD-level decision either way. |

## Current behaviour

The migration tool supports Sitecore, WordPress, AEM, Contentful, and Drupal as legacy CMS sources (`ui/src/cmsData/legacyCms.json`, `api/src/constants/index.ts` `CMS` enum). DatoCMS is not in the `CMS` enum, has no validator, no parser package, and no UI entry — a DatoCMS export cannot be uploaded or migrated today. The only DatoCMS-related artifact in the repo is an untracked, gitignored `upload-api/datocmsMigrationData/` folder of hand-mapped output and one uncommitted dependency line in `upload-api/package.json` — neither is functional connector code.

## Desired behaviour

A user can upload a DatoCMS export (the folder/zip shape above) and have the tool: parse all 32 content types and their fields, migrate 1,806 records across 5 locales with `en` as master, resolve `file`/`gallery`/`video` fields to migrated Contentstack assets, and represent DatoCMS blocks as their own Contentstack content types/global fields so modular content nests correctly — using the same createMapper → validate → transform → upload pipeline as the other five connectors.

## Scope

### In

- New `upload-api/migration-datocms/` parser package (content-type + field extraction, locale extraction, schema mapping).
- Wiring into `createMapper.ts`, `validators/index.ts`, a `datocms` controller/validator, and the already-declared (uncommitted) `migration-datocms` dependency in `upload-api/package.json`.
- New `api/src/services/datocms.service.ts` (`createEntry`, `createLocale`, `createVersionFile`, `mapFieldTypeToDataType`), a `DATOCMS` entry in the `CMS` enum, and both switches in `api/src/services/migration.service.ts`.
- `ui/src/cmsData/legacyCms.json` `all_cms` entry (and doc URL in `ui/src/utilities/constants.ts` if applicable).
- All 32 content types (13 entry-level + 19 block-level), all field types found in the sample, asset migration, and all 5 locales.

### Out

- DatoCMS-specific features not present in the sample export (e.g. workflows, scheduled publishing, SEO-field-specific structured data beyond what `seo`/`slug` field types carry) — revisit if a later sample surfaces them.
- Exact structured-text-to-Contentstack-RTE mapping mechanics and inline block/reference-linking behavior — deferred to the TRD.
- Any DatoCMS API-live-pull mode (this connector, like the others, is export-file-based).

## Affected connectors & layers

| Layer (A/B/C/D) | Touched? | Notes |
|---|---|---|
| A — parser package `upload-api/migration-datocms/` | Yes | New package: `libs/contentTypes.ts` (parse `content_types.json` + `fields.json`, split entry vs block types), `libs/schemaMapper.ts` (map 19 DatoCMS field types → Contentstack field types), `libs/extractLocale.ts` (derive `en/it/de/fr/es` from `assets.json`/localized field values). `upload-api/package.json:70` already has the (uncommitted) `"migration-datocms": "file:migration-datocms"` dependency line waiting on this package to exist. |
| B — upload-api wiring | Yes | New `case 'datocms'` in `createMapper.ts`'s switch (~line 96); new `case` in `validators/index.ts` (e.g. `'datocms-folder'` / `'datocms-zip'`, mirroring `aem-folder`/`sitecore-zip`); new `upload-api/src/controllers/datocms/` and `upload-api/src/validators/datocms/` (repo currently has these dirs only for `aem`, `contentful` (validator only), `drupal`, `sitecore`, `wordpress`). |
| C — api transform `api/src/services/datocms.service.ts` | Yes | New service file with `createEntry`/`createLocale`/`createVersionFile`/`mapFieldTypeToDataType`; new `DATOCMS: 'datocms'` in the `CMS` enum (`api/src/constants/index.ts:41-47`); new `case CMS.DATOCMS` in **both** switches in `migration.service.ts` (line ~452 test-migration switch, line ~856 full-migration switch — the skill flags forgetting the second one as a silent no-op). |
| D — ui registration `ui/src/cmsData/legacyCms.json` | Yes | New `all_cms` entry (`cms_id: "datocms"`, title, doc URL, `allowed_file_formats` for the folder/zip shape), following the `contentful` entry as the closest analog. |

## Success criteria

- A DatoCMS export in the sample's folder shape (or an equivalent zip) can be uploaded and validated by the tool.
- All 32 content types are created in Contentstack, with the 19 block types represented as global fields/blocks referenced from the 13 entry-level content types.
- All 1,806 records migrate with correct field values across all 5 locales (`en` master).
- All 144 assets are migrated and `file`/`gallery`/`video` fields resolve to them.
- Test migration and full migration both work end-to-end (both `migration.service.ts` switches wired).

## Open questions

- Exact mapping for `structured_text` and `rich_text` block/inline-link resolution onto Contentstack RTE, and whether record linking needs the Validations-tab-style setup noted in memory — for the TRD.
- Which locale, if any, DatoCMS itself designates as its "default" locale in a live project (not present in this static export) — confirm `en` is safe to assume as master beyond this sample.
- Whether `seo` and `lat_lon` field types need bespoke Contentstack field-group mappings or can fall back to JSON — for the TRD.
- Whether the stray `upload-api/datocmsMigrationData/` folder and the uncommitted `package.json` line should be cleaned up / built on top of when development starts (flag to `feature-develop`).
