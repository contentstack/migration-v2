# SAP SmartEdit Connector — Progress

**Epic:** [CMG-1062 — SAP SmartEdit](https://contentstack.atlassian.net/browse/CMG-1062)
**Goal:** Add a connector so content from SAP SmartEdit (SAP Commerce Cloud) can be migrated into Contentstack, like the existing WordPress / Contentful / Drupal / AEM / Sitecore connectors.
**Status:** All four connector layers (A–D) built and verified against the sample. SAP SmartEdit is now a selectable connector that parses an ImpEx export into content types, entries, references, and assets. Remaining: end-to-end run in the live UI + re-validation against a real SAP export.

---

## 1. Research (done)

**What SAP SmartEdit is:** the native CMS of SAP Commerce Cloud — a WYSIWYG editor for building e-commerce storefront pages (home, category, product, content pages). Content is page-and-component based.

**Data model mapped:**
```
Site → Page (Content/Category/Product) → Page Template → Content Slots → Components → Media
        + Navigation (nodes → entries)
```

**Two ways to get content out of SAP — evaluated both:**
| Method | What it is | Verdict |
|---|---|---|
| REST API | Live JSON from SAP's CMS webservices | ❌ Needs OAuth + a running SAP instance during every migration |
| **ImpEx** | SAP's native file-based Import/Export format | ✅ Chosen — file-based, one-time export, matches all existing connectors |

**Getting real SAP data:** There is no self-serve SAP Commerce trial. Real data needs either a hosted trial (enterprise customers) or a local install downloaded from SAP's Software Download Center (requires SAP customer/partner access). **Open ask:** does Contentstack have SAP download access? Until then we build against a synthetic sample.

---

## 2. Sample dataset (done)

Created a representative ImpEx export at [`sample-export.impex`](sample-export.impex) covering all major content: pages, page templates, content slots, slot-to-page mapping, 8 component types (banners, rich text, carousels, links, navigation), media/assets, and navigation nodes/entries.

> Synthetic — based on SAP documentation and real ImpEx syntax. To be re-validated against a real export once SAP access is available.

---

## 3. Connector build

A connector spans four layers. Progress:

| Layer | Name | Status | What it does |
|---|---|---|---|
| **A** | Parser (reading) | ✅ **Done + tested** | Reads the `.impex` file and understands its content types & fields |
| **B** | upload-api wiring (mailroom) | ✅ **Done + tested** | Receives the upload, validates it's ImpEx, hands it to the parser |
| **C** | api transform (translating) | ✅ **Done + tested** | Turns SAP rows into Contentstack entries + resolves references + registers assets |
| **D** | UI registration (menu button) | ✅ **Done** | "SAP SmartEdit" now appears as a selectable connector in the migration screen |

### Layer A — parser (`upload-api/migration-sap-smartedit/`)
Custom ImpEx parser written from scratch (existing connectors read JSON; ImpEx is a semicolon-delimited header/row text format, so none of the templates applied).

Smoke-test result against the sample:
- **16 content types** extracted (pages, slots, components, navigation)
- `Media` correctly routed to **assets** (not a content type)
- Correct field typing: `$picture`/`media` → **file**, `template`/`page`/`navigationNode` → **reference**, `cmsComponents` → **reference (multiple)**, `active`/`external` → **boolean**, `position` → **number**, `content` → **HTML**, `urlLink` → **url**
- All 16 content types carry the mandatory `title` + `url` fields Contentstack requires
- Builds clean (`tsc`, 0 errors)

### Layer B — upload-api wiring
Five touchpoints wired: new controller, new validator (`sap-smartedit-impex`), `createMapper` case, `file:` dependency, validators switch case. Plus a small fix to the shared upload route so single-file `.impex` uploads reach the parser with a valid path (mirrors the existing directory branch; zip/xml paths untouched).
- **upload-api compiles clean (0 errors).**

### Layer C — api transform (`api/src/services/sap-smartedit.service.ts`)
`createEntry` + `getAllAssets` + `createLocale` + `createVersionFile`, plus `CMS.SAP_SMARTEDIT` and both `migration.service.ts` switches (test + full). Self-contained ImpEx parser inside the service (no cross-package dependency). Runtime smoke test against the sample:
- **All 16 content types wrote entries** (ContentPage 6, ContentSlot 15, NavigationNode 8, …)
- **6 asset records** registered from Media, **0 unresolved**
- **References resolved** — single (`template` → `sap_PageTemplate`) and multiple cross-type (`cmsComponents` → banner + nav components)
- Booleans coerced (`defaultpage: true`); `file` fields hold the full asset record
- Compiles with no new errors in the service or `migration.service.ts`.

**Known refinement:** 19 references didn't resolve — enum-ish columns (`approvalStatus`, `restrictedPageTypes`) carry a `(code)` qualifier so the parser flagged them as references. They're values, not item pointers. Fix: treat known enum columns as text, or re-map in the field UI. (Logged, not silently dropped.)

**Asset binaries:** `getAllAssets` now **downloads the binary from the Media `URL`** (the WordPress/Contentful pattern) and writes it to `assets/files/<uid>/<filename>`; failures are logged to `logs/assets/cs_failed.json` and excluded from the index. The synthetic sample's Media URLs point at `placehold.co` so they're reachable for testing; a real SAP export would carry real DAM URLs. Verified: 6/6 images download with correct sizes + content types.

**Fixes from live end-to-end testing (import into a real stack):**
1. **Lowercase content-type UIDs** — Contentstack normalizes CT uids to lowercase on create, so mixed-case uids (`cs_ContentPage`) caused "Content Type not found" on every later update/entry call. Parser now lowercases all CT uids + reference targets (`toCtUid`).
2. **Reserved field UIDs** — `uid` (and other system uids) can't be a custom field; the CMA rejected the CT schema (`schema.N.uid: has a restricted value 'uid'`). Parser now prefixes reserved field uids with `src_` (`guardReservedUid`); `title`/`url` remain the standard built-ins.

After both fixes, a live import creates all 16 content types + 80 entries with references resolved. (Assets still fail with `ENOENT` — the known metadata-only limitation. The `getExistingExtensions` `api_key` error in the migration log is a pre-existing, unrelated app/extension-service issue and is non-fatal.)

---

### Layer D — UI registration (`ui/src/cmsData/legacyCms.json`)
Added the `sap-smartedit` entry to `all_cms` (single-file, `fileformat_id: "impex"`, `isactive: true`). The card renders automatically. `cms_id` matches the `CMS.SAP_SMARTEDIT` enum value, so selection → validator key `sap-smartedit-impex` → mapper → parser → transform all line up. JSON validated.

## 4. What's next

- **End-to-end run in the live UI** — start `api` + `upload-api` + `ui`, select SAP SmartEdit, upload the `.impex`, confirm content types + entries + assets appear and the field-mapping screen looks right.
- **Refine enum-as-reference columns** (`approvalStatus`, `restrictedPageTypes`) — classify known enum columns as text.
- **Real asset binaries** — download/copy bytes once a real export is available.
- **Re-validate against a real SAP export** once SAP access is sorted; add ZIP (`.impex` + CSVs) support.

---

## 5. Honest caveats

- Built against **synthetic** data — must be re-validated on a real export.
- v1 handles a **single `.impex` file**; real SAP exports are a ZIP of `.impex` + CSVs (follow-up).
- 16 content types are mapped **1:1** for v1; consolidating the slot/page/component graph into nested page composition is a later refinement.
- Not yet committed — currently on branch `feat/skill` as working changes.
