# SAP SmartEdit Connector — Use case

**Slug:** `sap-smartedit` · **Author:** Ayush Sahu · **Date:** 2026-07-13 · **Status:** Draft

## Summary

Add a connector so content authored in **SAP SmartEdit** (the native CMS of SAP Commerce Cloud) can be migrated into Contentstack, on par with the existing WordPress / Contentful / Drupal / AEM / Sitecore connectors. The connector ingests SAP's file-based **ImpEx** export, parses its page/component/media model into Contentstack content types, entries, references, and assets, and exposes "SAP SmartEdit" as a selectable source in the migration UI. This is a source-CMS **coverage** play tracked under epic CMG-1062.

## Problem / motivation

The migration tool cannot ingest content from SAP Commerce Cloud today — customers on SAP SmartEdit have no supported path into Contentstack, leaving a visible gap in the connector line-up. SAP's content is page-and-component based (Site → Page → Template → Content Slots → Components → Media, plus Navigation), a shape none of the existing JSON-based connectors handle. Closing this gap broadens the tool's addressable source-CMS set.

## Stakeholders

- **Migration users moving off SAP Commerce Cloud / SmartEdit** — primary users; need their storefront pages, components, navigation, and media to land in Contentstack.
- **Connector team** — owns the four-layer connector and its ongoing maintenance.
- **Sales / solutions** — SAP-Commerce coverage is a competitive checkbox for prospect conversations.
- **Support** — will field questions once real SAP exports flow through.

## References

| Source | Type | Link/Path | What it tells us |
|---|---|---|---|
| Progress log | local file | `docs/features/sap-smartedit/progress.md` | Full build history: research, data model, ImpEx-vs-REST decision, four-layer build status, verification results, known refinements, honest caveats |
| Epic CMG-1062 | Jira | https://contentstack.atlassian.net/browse/CMG-1062 | Feature is tracked as "SAP SmartEdit" coverage epic |
| Sample export | local file | `docs/features/sap-smartedit/sample-export.impex` | Synthetic ImpEx covering pages, templates, slots, 8 component types, media, navigation — the dataset the connector was built and smoke-tested against |
| Extra sample exports | local dir | `docs/features/sap-smartedit/smartedit-sample-export/`, `smartedit-5mb-export/` | Folder-shaped export variants used to validate the folder-export path |
| Layer A parser | code | `upload-api/migration-sap-smartedit/` (`libs/contentTypes.ts`, `schemaMapper.ts`, `extractLocale.ts`) | Custom ImpEx parser: 16 content types, Media→assets, field typing, lowercase CT uids, reserved-uid guard |
| Layer B wiring | code | `upload-api/src/controllers/sap-smartedit/`, `validators/sap-smartedit/`, `validators/index.ts` (`sap-smartedit-impex` + `sap-smartedit-folder`), `services/createMapper.ts` | Upload receives, validates ImpEx, routes to parser; single-file + folder upload paths |
| Layer C transform | code | `api/src/services/sap-smartedit.service.ts`, `constants/index.ts` (`CMS.SAP_SMARTEDIT`), `migration.service.ts` (both switches, L576 + L1051) | SAP rows → entries, reference resolution, asset download from Media URL |
| Layer D registration | code | `ui/src/cmsData/legacyCms.json` (L259, `cms_id: sap-smartedit`, `fileformat_id: impex`) | "SAP SmartEdit" card renders as a selectable connector |

## Assumptions & decisions

The confident calls made while drafting — flip any by saying so.

| Decision | Choice | Default? | Why |
|---|---|---|---|
| Driver / framing | Expand source-CMS coverage (roadmap, epic CMG-1062) | — | Confirmed with user; not tied to a single named deal |
| Extraction method | ImpEx (file-based export) over REST API | yes | ImpEx is a one-time file export matching every existing connector; REST needs OAuth + a live SAP instance per migration |
| Export shape (v1) | Single `.impex` file **and** extracted folder | yes | Both already built (`sap-smartedit-impex` + `sap-smartedit-folder`); ZIP of `.impex` + CSVs deferred to follow-up |
| Document / record scope | All 16 extracted content types, mapped 1:1 | yes | Real content (pages, slots, components, navigation); `Media` routed to assets, not a content type |
| Assets / binaries | Migrate — download binary from Media `URL` and register | yes | Media is part of the content; mirrors WordPress/Contentful pattern; failures logged to `logs/assets/cs_failed.json` |
| Locales | Single-locale | yes | Sample shows no i18n signal; multi-locale is an open question |
| Rich text | `content` fields → HTML/rich text | yes | Matches Contentstack rich-text target; JSON-RTE vs HTML left as a TRD decision |
| Enum-as-reference & nested composition | Accepted v1 limitations, logged as follow-ups | yes | Ship 1:1 mapping now; refine mis-flagged enum columns and slot/page/component consolidation later |
| Real-export validation | Open dependency on SAP download access | yes | Built on synthetic data; must re-validate on a real export once SAP Software Download Center access is sorted |

## Current behaviour

Today the migration tool offers no way to bring SAP Commerce Cloud / SmartEdit content into Contentstack — there is no SAP source card in the UI, no validator that recognises ImpEx, and no transform that understands the page/component/media model. A user with an SAP export has no supported entry point (per `progress.md` and the connector-layer code, which did not exist before this branch).

## Desired behaviour

"SAP SmartEdit" appears as a selectable connector in the migration screen. A user uploads their ImpEx export (a single `.impex` file or an extracted folder); the tool validates it, parses it into content types, entries, references, and assets, and drives them through the standard mapping → migration flow — landing storefront pages, templates, content slots, components, navigation, and media in the destination stack with references resolved and media downloaded as assets.

## Scope

### In

- Custom ImpEx parser (Layer A) — semicolon-delimited header/row format → 16 content types with correct field typing (file, reference single/multiple, boolean, number, HTML, url), mandatory `title`/`url`, lowercase CT uids, reserved-uid guarding.
- Upload-api wiring (Layer B) — controller, `sap-smartedit-impex` + `sap-smartedit-folder` validators, `createMapper` case, `file:` dependency; single-file and folder upload paths.
- Api transform (Layer C) — `createEntry` / `createLocale` / `createVersionFile` / `getAllAssets`, `CMS.SAP_SMARTEDIT`, both `migration.service.ts` switches; reference resolution (single + multiple cross-type); asset binary download from Media `URL`.
- UI registration (Layer D) — `all_cms` entry, `impex` file format, active card.
- Single `.impex` file and extracted-folder export shapes.
- Verification against the synthetic sample export.

### Out

- **ZIP export** (`.impex` + CSV bundle) — named follow-up.
- **Real-export validation** — blocked on SAP download access (open dependency).
- **Enum-column refinement** — `approvalStatus`, `restrictedPageTypes` mis-flagged as references; accepted v1 limitation.
- **Nested page composition** — slot/page/component graph consolidation; ships as 1:1 mapping in v1.
- **Multi-locale** — single-locale only for v1.
- **REST API extraction** — explicitly rejected in favour of ImpEx.

## Affected connectors & layers

| Layer (A/B/C/D) | Touched? | Notes |
|---|---|---|
| A — parser package `upload-api/migration-sap-smartedit/` | yes | New custom ImpEx parser: `libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`; own `package.json`/`tsconfig.json` |
| B — upload-api wiring | yes | `controllers/sap-smartedit/`, `validators/sap-smartedit/`, `validators/index.ts` (`sap-smartedit-impex` + `sap-smartedit-folder`), `services/createMapper.ts` case, `file:` dep; shared upload-route fix so single-file `.impex` reaches the parser |
| C — api transform `api/src/services/sap-smartedit.service.ts` | yes | `createEntry` + `getAllAssets` + `createLocale` + `createVersionFile`; `CMS.SAP_SMARTEDIT` in `constants/index.ts`; BOTH switches in `migration.service.ts` (test L576 + full L1051); self-contained ImpEx parser inside the service |
| D — ui registration `ui/src/cmsData/legacyCms.json` | yes | `all_cms` entry `cms_id: sap-smartedit`, `fileformat_id: impex`, `isactive: true` |

## Success criteria

- SAP SmartEdit is selectable in the migration UI; selecting it and uploading an ImpEx export (single file or folder) reaches the parser without error.
- All 16 content types extract with correct field typing; `Media` is routed to assets, not a content type.
- All content types write entries; single and multiple cross-type references resolve; booleans/numbers coerced; `file` fields hold the asset record.
- Asset binaries download from the Media `URL` and register; failures are logged (not silently dropped) to `logs/assets/cs_failed.json`.
- upload-api and api both compile clean; a live import creates all content types + entries with references resolved.
- The field-mapping screen renders correctly for the parsed schema.

## Open questions

- **Real SAP export access** — does Contentstack have SAP Software Download Center access to obtain a real export for re-validation? Until then everything is validated on synthetic data. (Carry to PRD/TRD as a hard dependency.)
- **Multi-locale** — do real SAP exports carry i18n, and is multi-locale in scope for a later version?
- **Rich text target** — JSON-RTE vs HTML for `content` fields (TRD decision).
- **Enum-column classification** — final approach for `approvalStatus` / `restrictedPageTypes` (treat known enum columns as text vs re-map in field UI).
- **Asset ENOENT in live import** — real-binary download works standalone, but live end-to-end import still showed asset `ENOENT`; confirm the metadata-vs-binary path once a real export is available.
