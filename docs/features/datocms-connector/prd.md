# DatoCMS connector — PRD

> Feature: `datocms-connector` · Connector(s): `datocms` · Stage 2 (PRD) · Author: Chirag Chavan · Date: 2026-07-01 · **Last reconciled with code: 2026-08-14** · Status: Implemented

> **Note:** updated to match the connector as actually built. The main change from the original PRD is FR-4 — DatoCMS blocks became real Contentstack **content types**, not global fields.

## Overview

Add DatoCMS as a supported source CMS in the migration tool. Today the tool migrates Sitecore, WordPress, AEM, Contentful, and Drupal into Contentstack; DatoCMS — a common headless CMS — has no path in. This feature parses a DatoCMS Management-API export (content types, fields, records, assets) and migrates it into a Contentstack stack through the same four-layer connector pipeline as the existing five sources.

## Goals

- Let a user upload a DatoCMS export and run both a test migration and a full migration into Contentstack, end to end.
- Preserve DatoCMS's modular-content model: the 19 `modular_block` content types become real Contentstack content types referenced from the 13 entry-level types, instead of collapsing to opaque JSON.
- Preserve the export's real multi-locale content (`en`, `it`, `de`, `fr`, `es`) with `en` as the Contentstack master locale.
- Migrate the export's assets (144 binaries) as real Contentstack asset references, not source URLs.

## Non-goals

- Live/API-based pulling from a DatoCMS project (this connector is export-file-based, like the other five).
- DatoCMS features absent from the reference export — workflows, scheduled publishing, singleton/tree item types beyond what's sampled.
- Finalizing the exact `structured_text`/`rich_text` → Contentstack RTE shape (JSON-RTE vs HTML) or inline block/reference-link resolution mechanics — settled in the TRD, not here.
- ~~Cleaning up the stray `upload-api/datocmsMigrationData/` folder or the existing uncommitted `package.json` dependency line~~ — **both done**: the folder is gone and `upload-api/package.json:70` now resolves to a real package.

## User stories

- As a migration user on DatoCMS, I want to upload my DatoCMS export so that I can migrate my content into a Contentstack stack without hand-mapping it myself.
- As a migration user, I want my DatoCMS blocks (testimonials, hero sections, popups, etc.) to come across as real nested content in Contentstack, so that my modular page layouts aren't flattened into unusable JSON blobs. *(Delivered as real content types referenced from their parents.)*
- As a migration user with a multi-language DatoCMS project, I want all 5 locales migrated with the correct locale-specific values, so that I don't have to re-translate content that already exists.
- As a migration user, I want my DatoCMS images and files to show up as real Contentstack assets, so that my content isn't left pointing at soon-to-be-deleted DatoCMS URLs.
- As the connector team, I want this feature built on the same createMapper → validate → transform → upload pipeline as the other five connectors, so that it's consistent to maintain and doesn't fork the architecture.

## Functional requirements

- **FR-1** — The tool must accept a DatoCMS export in the extracted-folder shape sampled (`content_types.json`, `fields.json`, `records.json`, `assets.json`, `assets/`) and an equivalent zip of the same structure.
- **FR-2** — The tool must validate that an uploaded export contains the four required JSON files and reject/report clearly if any is missing or malformed.
- **FR-3** — The tool must parse all 32 DatoCMS content types from `content_types.json` + `fields.json`, correctly distinguishing the 13 standalone entry types from the 19 `modular_block: true` types.
- **FR-4** *(revised during implementation)* — The tool must create a corresponding Contentstack content type for each of the 13 entry-level DatoCMS types, **and a Contentstack content type for each of the 19 block types**, referenced from their parents via `reference` (for `single_block`/`link`/`links`) or `modular_blocks` (for `rich_text`). The original wording required a *global field* per block type; implementation uses real content types instead, which satisfies the underlying goal — blocks nest as structured content, not opaque JSON.
- **FR-5** — The tool must map every DatoCMS field type present in the sample (`boolean, color, date, file, float, gallery, integer, json, lat_lon, link, links, rich_text, seo, single_block, slug, string, structured_text, text, video`, plus `date_time` seen in the schema) to a Contentstack field type — no field type may silently fall through un-mapped. Three types (`color`, `json`, and star-rating `integer`/`float`) map to Contentstack **custom field extensions** rather than native types; see the TRD's mapping table.
- **FR-6** — The tool must migrate all 1,806 records from `records.json` as Contentstack entries, preserving field values per the FR-5 mapping.
- **FR-7** — The tool must migrate content across all 5 locales found in the export (`en`, `it`, `de`, `fr`, `es`), respecting each field's `localized` flag from `fields.json`, with `en` as the Contentstack master locale.
- **FR-8** — The tool must migrate all 144 assets in `assets.json`/`assets/` to Contentstack, and resolve every `file`, `gallery`, and `video` field on a record to the corresponding migrated asset reference(s).
- **FR-9** — The tool must resolve DatoCMS `link`/`links` fields (entry-to-entry references) to Contentstack reference fields pointing at the correct migrated entry.
- **FR-10** — Both the test-migration and full-migration code paths must support DatoCMS (i.e., both switches in `migration.service.ts` must be wired) — a DatoCMS project must be able to complete a full migration, not just a test one.
- **FR-11** — DatoCMS must appear as a selectable legacy CMS option in the UI, consistent with the other five connectors.

## Non-functional requirements

- **Performance** — Parsing and mapping the sampled export (32 content types, 1,806 records, 144 assets) should complete within the same order of magnitude as the Contentful connector processes a comparably-sized export; no connector-specific performance regression for other CMSs.
- **Reliability** — No silent drops: an unrecognized DatoCMS field type, a broken entry-reference, or a missing asset must fail loudly (logged/reported) rather than be dropped without trace.
- **Compatibility** — Adding DatoCMS must not change behavior for the existing five connectors; shared switches (`createMapper.ts`, `validators/index.ts`, both `migration.service.ts` switches) get an additive `case`, not a rewrite.

## Success metrics

- 100% of the DatoCMS field types found in the sample export have an explicit mapping (no fall-through to a generic/default type).
- ≥ 99% of the 1,806 sample records successfully create a Contentstack entry.
- All 144 sample assets migrate and are correctly referenced from the records that use them.
- A full migration (not just test) of the sample export completes end-to-end without manual intervention.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Second `migration.service.ts` switch (full migration) is wired incorrectly or forgotten, so DatoCMS test-migrates fine but silently no-ops on full migration | M | H | **Closed** — both switches wired (`migration.service.ts` lines 491 and 916). Grep guard retained in the TRD test plan. |
| DatoCMS blocks (19 `modular_block` types) get flattened into JSON instead of real nested Contentstack content, defeating the point of the migration | M | H | **Closed** — block types are converted into real Contentstack content types and referenced from their parents. |
| Multi-locale mapping mis-assigns localized vs. non-localized field values (schema says `localized`, but a record's shape differs) | M | M | Parser (Layer A) reads the per-field `localized` flag from `fields.json` as the source of truth, not the record shape; TRD's field-mapping table documents this explicitly. |
| Asset resolution race — records reference assets that haven't been migrated yet | L | M | Follow the existing pattern from other connectors (assets migrated before/alongside `createEntry`, per the TRD's entry-creation section). |
| DatoCMS `structured_text`/`rich_text` content loses inline block references or links during RTE conversion | M | M | Scoped out of this PRD's hard requirements (see Non-goals); TRD documents the chosen approach and residual risk explicitly rather than leaving it implicit. |

## Out of scope

- Live DatoCMS API sync/pull mode.
- DatoCMS-specific features not present in the sampled export (workflows, scheduled publishing, tree/singleton item types beyond what's sampled).
- Exact `structured_text`/`rich_text` → Contentstack RTE conversion mechanics (JSON-RTE vs HTML, inline-block/link resolution) — decided in the TRD, tracked as residual risk.
- ~~Cleanup of the stray `upload-api/datocmsMigrationData/` folder and the pre-existing uncommitted `package.json` dependency line~~ — completed during development.

## Links

- Use case: `docs/features/datocms-connector/use-case.md`
- TRD: `docs/features/datocms-connector/trd.md`
- Confluence: <filled after push — Step 4>
