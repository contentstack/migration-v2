# SAP SmartEdit Connector — PRD

> Feature: `sap-smartedit` · Connector(s): `sap-smartedit` · Stage 2 (PRD) · Author: Ayush Sahu · Date: 2026-07-13 · Status: Draft

## Overview

Add a connector so content authored in **SAP SmartEdit** (the native CMS of SAP Commerce Cloud) can be migrated into Contentstack, on par with the existing WordPress / Contentful / Drupal / AEM / Sitecore connectors. The connector ingests SAP's file-based **ImpEx** export, parses its page/component/media model into Contentstack content types, entries, references, and assets, and exposes "SAP SmartEdit" as a selectable source in the migration UI. This closes a visible gap in the tool's source-CMS coverage. Tracked under epic **CMG-1062**.

## Goals

- Let a migration user bring SAP Commerce Cloud / SmartEdit content into Contentstack via a file-based export, with no live SAP instance required at migration time.
- Parse the ImpEx page/component/media model into correctly typed content types, entries, resolved references, and downloaded assets.
- Surface "SAP SmartEdit" as a first-class, selectable connector consistent with the existing five.
- Support the two realistic v1 export shapes: a single `.impex` file and an extracted export folder.

## Non-goals

- Live REST-API extraction from a running SAP instance (explicitly rejected in favour of ImpEx).
- ZIP-bundle export (`.impex` + CSVs) — deferred follow-up.
- Multi-locale / i18n migration — single-locale for v1.
- Nested page composition (consolidating the slot/page/component graph) — ships as a 1:1 content-type mapping in v1.
- Refining enum-ish columns currently mis-detected as references (`approvalStatus`, `restrictedPageTypes`).

## User stories

- As a **migration user moving off SAP Commerce Cloud**, I want to select "SAP SmartEdit" and upload my ImpEx export so that my storefront pages, components, navigation, and media land in Contentstack.
- As a **migration user**, I want references between pages, templates, slots, and components preserved so that my content graph stays intact after migration.
- As a **migration user**, I want media referenced by my content pulled in as Contentstack assets so that images resolve instead of breaking.
- As a **connector-team engineer**, I want the SAP connector to follow the same four-layer shape as the others so that it is maintainable and does not regress existing connectors.

## Functional requirements

- **FR-1** — The system must accept an SAP ImpEx export as either a single `.impex` file or an extracted folder, validate it as ImpEx, and route it to the SAP parser.
- **FR-2** — The parser must extract SAP content types from the ImpEx header/row format (16 in the reference sample), with correct field typing: `$picture`/`media` → file, `template`/`page`/`navigationNode` → reference, `cmsComponents` → reference (multiple), `active`/`external` → boolean, `position` → number, `content` → HTML, `urlLink` → url; everything else → single-line text.
- **FR-3** — The system must route `Media` to Contentstack **assets**, not to a content type.
- **FR-4** — Every content type must carry the mandatory `title` and `url` fields Contentstack requires.
- **FR-5** — Content-type UIDs and reference targets must be lowercased (Contentstack normalises CT uids on create), and reserved field uids (`uid`, etc.) must be prefixed (`src_`) so the CMA accepts the schema.
- **FR-6** — The transform must write entries for every content type and resolve references — both single (`template` → page template) and multiple cross-type (`cmsComponents` → banner/nav components).
- **FR-7** — The transform must coerce booleans and numbers, and `file` fields must hold the full asset record.
- **FR-8** — Asset binaries must be downloaded from the Media `URL` and registered; download failures must be logged to `logs/assets/cs_failed.json` and excluded from the index — never silently dropped.
- **FR-9** — "SAP SmartEdit" must appear as a selectable, active card in the migration UI, wired end-to-end (card → validator key → mapper → parser → transform).
- **FR-10** — The field-mapping screen must render correctly for the parsed SAP schema.

## Non-functional requirements

- **Reliability** — No silent drops. Unresolved references and failed asset downloads are logged, not swallowed. Unknown field types fall through to a safe default (single-line text) rather than erroring.
- **Compatibility** — The five existing connectors and the shared upload route are unaffected; the single-file `.impex` route fix mirrors the existing directory branch and leaves zip/xml paths untouched.
- **Maintainability** — Follows the standard four-layer connector shape so the team can extend it.
- **Build health** — upload-api and api both compile clean (no new type errors in the connector's files).

## Success metrics

- % of source field types mapped with no fall-through to the default type (target: all typed columns in the sample map explicitly).
- Entries created / entries in export ≥ 99% (sample: all 16 content types wrote entries; ~80 entries).
- Assets registered / media referenced (sample: 6/6 downloaded with correct sizes + content types, 0 unresolved).
- References resolved / references present (sample: single + multiple cross-type resolved; the 19 enum-column false-positives are a known, logged limitation).

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Built on synthetic data; real SAP export differs | H | H | Flag as a hard dependency; re-validate on a real export once SAP download access is obtained |
| No SAP Software Download Center access | M | H | Open ask to Contentstack; build/validate on synthetic sample meanwhile |
| Enum columns mis-detected as references (`approvalStatus`, `restrictedPageTypes`) | H (known) | L | Logged as a v1 limitation; classify known enum columns as text in follow-up |
| Real exports are ZIP (`.impex` + CSVs), not a single file | M | M | Folder shape already supported; ZIP is a named follow-up |
| Second `migration.service.ts` switch missed → works in test, no-ops in full | L | H | Both switches wired (L576 test + L1051 full); grep guard in the TRD verification plan |
| Live-import asset `ENOENT` despite standalone download working | M | M | Track as an open question; confirm binary path on a real export |

## Out of scope

- ZIP-bundle (`.impex` + CSVs) export support.
- Multi-locale migration.
- Nested page composition (slot/page/component consolidation).
- Enum-column reclassification.
- REST-API extraction.

## Links

- Use case: `docs/features/sap-smartedit/use-case.md`
- TRD: `docs/features/sap-smartedit/trd.md`
- Confluence: <filled after push — Step 4>
