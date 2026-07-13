# SAP SmartEdit Connector — Jira tickets

Slug: `sap-smartedit` · Source: `prd.md` + `trd.md` · Stage 3 (feature-jira)

## Epic

- **Summary:** SAP SmartEdit connector — migrate SAP Commerce Cloud content into Contentstack via ImpEx
- **Description:** Add a four-layer connector that ingests SAP SmartEdit's file-based ImpEx export (single `.impex` file or extracted folder), parses its page/component/media model into Contentstack content types, entries, references, and assets, and surfaces "SAP SmartEdit" as a selectable source in the migration UI. Source-CMS coverage play, on par with WordPress/Contentful/Drupal/AEM/Sitecore. See `docs/features/sap-smartedit/prd.md` + `trd.md`. **Existing epic: CMG-1062.**
- **Goal:** A migration user can select SAP SmartEdit, upload an ImpEx export, and land all content types + entries + resolved references + downloaded assets in a stack — verified against the sample export (real-export re-validation tracked as a dependency).

## Stories

| Key | Summary | Layer | Estimate | Depends on |
|---|---|---|---|---|
| — | Layer A — custom ImpEx parser package | A | TBD | — |
| — | Layer B — upload-api wiring (single-file + folder) | B | TBD | A |
| — | Layer C — api transform + reference/asset resolution | C | TBD | A |
| — | Layer D — UI registration | D | TBD | — |
| — | Verification — build + smoke + end-to-end migration | Verification | TBD | A, B, C, D |
| — | Follow-ups — enum columns, ZIP export, real-export re-validation | Follow-up | TBD | Verification |

> `Key` stays `—` until the push fills it (Step 4). Stories map to epic CMG-1062.

### Per-story detail

#### Layer A — custom ImpEx parser package
- **Description:** New package `upload-api/migration-sap-smartedit/` with a from-scratch ImpEx parser (semicolon-delimited header/row, not JSON). `libs/contentTypes.ts` classifies columns (`classifyColumn`) and extracts content types, routes `Media`→assets, enforces mandatory `title`/`url`, lowercases CT uids (`toCtUid`), guards reserved field uids (`guardReservedUid` → `src_`). `libs/schemaMapper.ts` maps source type → Contentstack field type. Own `package.json`/`tsconfig.json`. (FR-2, FR-3, FR-4, FR-5)
- **Acceptance criteria:**
  - [ ] 16 content types extracted from the sample; `Media` routed to assets, not a CT
  - [ ] Field typing correct: `$picture`/`media`→file, `template`/`page`/`navigationNode`→reference, `cmsComponents`→reference(multiple), `active`/`external`→boolean, `position`→number, `content`→html, `urlLink`→url, else→single_line_text
  - [ ] Every CT carries mandatory `title` + `url`
  - [ ] CT uids + reference targets lowercased; reserved field uids prefixed `src_`
  - [ ] Package builds clean (`npm run build`, 0 errors)
- **Layer:** A — parser package
- **Dependencies:** none

#### Layer B — upload-api wiring (single-file + folder)
- **Description:** Wire the connector into upload-api: new `src/controllers/sap-smartedit/`, new `src/validators/sap-smartedit/`, `sap-smartedit-impex` + `sap-smartedit-folder` cases in `src/validators/index.ts`, `sap-smartedit` case in `src/services/createMapper.ts`, `file:` dependency in `package.json`. Fix the shared upload route so single-file `.impex` uploads reach the parser with a valid path (mirror the directory branch; leave zip/xml paths untouched). (FR-1)
- **Acceptance criteria:**
  - [ ] Both validator keys accept a valid ImpEx export and reject non-ImpEx
  - [ ] `createMapper` routes `sap-smartedit` to the parser
  - [ ] Single-file `.impex` upload reaches the parser with a valid path; folder upload works too
  - [ ] Existing connectors + zip/xml upload paths unaffected
  - [ ] upload-api compiles clean (0 errors)
- **Layer:** B — upload-api wiring
- **Dependencies:** A

#### Layer C — api transform + reference/asset resolution
- **Description:** New `api/src/services/sap-smartedit.service.ts` with `createEntry` / `createLocale` / `createVersionFile` / `getAllAssets` and `mapFieldTypeToDataType`, carrying a self-contained copy of the ImpEx parser (no cross-package dep). Add `CMS.SAP_SMARTEDIT = 'sap-smartedit'` to `api/src/constants/index.ts`. Wire **BOTH** switches in `migration.service.ts` (test L576 + full L1051). Resolve references (single + multiple cross-type via source-id→entry-uid index); download asset binaries from Media `URL` before entry creation, log failures to `logs/assets/cs_failed.json`. (FR-6, FR-7, FR-8)
- **Acceptance criteria:**
  - [ ] All content types write entries against the sample (~80 entries)
  - [ ] Single + multiple cross-type references resolve
  - [ ] Booleans/numbers coerced; `file` fields hold the full asset record
  - [ ] Asset binaries download from Media `URL`; failures logged + excluded (never silently dropped)
  - [ ] **Both** `case CMS.SAP_SMARTEDIT` arms present in `migration.service.ts` (grep returns 2)
  - [ ] api typecheck shows no new errors in `sap-smartedit.service` / `migration.service`
- **Layer:** C — api transform
- **Dependencies:** A

#### Layer D — UI registration
- **Description:** Add the `sap-smartedit` entry to `ui/src/cmsData/legacyCms.json` `all_cms` (`cms_id: sap-smartedit` matching `CMS.SAP_SMARTEDIT`, `fileformat_id: impex`, `isactive: true`). Card renders automatically. (FR-9)
- **Acceptance criteria:**
  - [ ] "SAP SmartEdit" card appears as an active, selectable connector
  - [ ] `cms_id` matches the `CMS.SAP_SMARTEDIT` enum value so selection → validator → mapper → parser → transform line up
  - [ ] `legacyCms.json` parses as valid JSON
- **Layer:** D — ui registration
- **Dependencies:** none (but only useful once C's enum exists)

#### Verification — build + smoke + end-to-end migration
- **Description:** Cross-layer checks: all packages build, both `migration.service.ts` switches present, and a real end-to-end migration of `sample-export.impex` through the live UI (api + upload-api + ui). Confirm content types, entries, assets, and the field-mapping screen. (FR-10, all success metrics)
- **Acceptance criteria:**
  - [ ] Parser package + upload-api + api all build clean
  - [ ] `grep "case CMS.SAP_SMARTEDIT" migration.service.ts` returns 2 matches
  - [ ] End-to-end run: select SAP SmartEdit → upload sample → 16 CTs + ~80 entries + 6 assets + resolved refs
  - [ ] Field-mapping screen renders correctly for the parsed schema
- **Layer:** Verification
- **Dependencies:** A, B, C, D

#### Follow-ups — enum columns, ZIP export, real-export re-validation
- **Description:** Deferred, non-blocking refinements captured from the PRD/TRD out-of-scope + risks: (1) classify enum-ish columns (`approvalStatus`, `restrictedPageTypes`) as text instead of references; (2) support ZIP export (`.impex` + CSVs); (3) re-validate against a real SAP export once SAP Software Download Center access is obtained; (4) investigate live-import asset `ENOENT`; consider multi-locale + nested page composition.
- **Acceptance criteria:**
  - [ ] Enum columns no longer produce unresolved references
  - [ ] ZIP export shape accepted and parsed
  - [ ] Connector re-validated on a real SAP export (blocked on SAP access — dependency)
  - [ ] Live-import asset binary path confirmed (no `ENOENT`)
- **Layer:** Follow-up
- **Dependencies:** Verification

## Created issues

Filled after a successful Jira push (Step 4).

| Key | URL |
|---|---|
| — | — |
