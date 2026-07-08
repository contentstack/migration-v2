# SAP SmartEdit Connector — Progress

**Epic:** [CMG-1062 — SAP SmartEdit](https://contentstack.atlassian.net/browse/CMG-1062)
**Goal:** Add a connector so content from SAP SmartEdit (SAP Commerce Cloud) can be migrated into Contentstack, like the existing WordPress / Contentful / Drupal / AEM / Sitecore connectors.
**Status:** Research done · Sample created · Connector Layers A & B built and verified · Layer C pending.

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
| **C** | api transform (translating) | ⬜ Pending | Turns SAP rows into actual Contentstack entries + resolves references + assets |
| **D** | UI registration (menu button) | ⬜ Pending | Shows "SAP SmartEdit" as an option in the migration screen |

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

---

## 4. What's next

- **Layer C (the big one):** `createEntry` in a new `api/src/services/sap-smartedit.service.ts` — transform parsed rows into Contentstack entries, resolve the references between pages/slots/components, and handle Media → assets. Plus both switches in `migration.service.ts`.
- **Layer D:** register SAP SmartEdit in the UI picker.
- **End-to-end test migration** of the sample.
- **Re-validate against a real SAP export** once SAP access is sorted.

---

## 5. Honest caveats

- Built against **synthetic** data — must be re-validated on a real export.
- v1 handles a **single `.impex` file**; real SAP exports are a ZIP of `.impex` + CSVs (follow-up).
- 16 content types are mapped **1:1** for v1; consolidating the slot/page/component graph into nested page composition is a later refinement.
- Not yet committed — currently on branch `feat/skill` as working changes.
