# SAP SmartEdit → Contentstack: demo runbook

Live demo of the full path: real content in SAP Commerce Cloud → ImpEx export
pulled over curl → migrated into Contentstack by the connector.

Catalog used: **`myContentCatalog:Online`** — 290 rows across 13 CMS types,
4 locales, real image assets. Original content (not SAP sample data), so it
stands in for a customer's own catalog.

---

## 0. Pre-flight — do this ~10 minutes before, not during

**a) Capture a fresh HAC session.** This is the #1 thing that breaks a demo:
the cookie/CSRF token expire with the browser session.

1. Open HAC → Console → Scripting Languages, run `println "ok"`.
2. DevTools → Network → right-click the `execute` request → **Copy as cURL**.
3. Pull the two values out of it and export them:

```bash
export HAC_BASE_URL='https://backoffice.ct8lafaf1m-contentst2-d1-public.model-t.cc.commerce.ondemand.com'
export HAC_COOKIE='JSESSIONID=...; ROUTE=...'
export HAC_CSRF_TOKEN='...'
```

**b) Prove the export works end to end, once, before anyone is watching:**

```bash
cd "/Users/ayush.sahu/Migration v2/migration-v2/docs/features/sap-smartedit/scripts" && ./hac-export.sh myContentCatalog-export-v2.groovy stress-export-bundle/myContentCatalog-stress-export.impex
```

Expect `Wrote field 'outputText' -> ...`. If it errors, the session is stale —
redo step (a). The script fails loudly with the reason; it will not write a
silent empty file.

**c) Restart both services** so they pick up the current code and config:

```bash
cd "/Users/ayush.sahu/Migration v2/migration-v2/api" && npm run dev
```

```bash
cd "/Users/ayush.sahu/Migration v2/migration-v2/upload-api" && npm run dev
```

**d) Confirm the input path** the tool will read (already set):

```bash
python3 -c "import json;print(json.load(open('/Users/ayush.sahu/Migration v2/migration-v2/upload-api/src/config/index.json'))['localPath'])"
```

Must print `.../docs/features/sap-smartedit/scripts/stress-export-bundle`.

---

## 1. Show the data living in SAP

Two options — the Backoffice one is more convincing to a non-technical audience.

**Visual (recommended):** open Backoffice, switch to the CMS perspective,
select catalog `myContentCatalog` / version `Online`. Show a couple of pages,
their slots and components, and an image asset rendering. Point out this is
ordinary authored content, nothing special done for the migration.

**Numbers (fast, and proves scale):** HAC → Console → Scripting Languages,
paste `myContentCatalog-export-v2.groovy` and Execute. The tail of the output
is a per-type row count ending in `# TOTAL = 290`.

Talking point: 13 distinct CMS types, content localized into 4 languages,
multi-level references (navigation nodes pointing at other navigation nodes),
rich text, and real binary assets.

---

## 2. Export it over curl

This is the "no hand-crafted files" moment — the data comes straight out of the
live instance.

```bash
cd "/Users/ayush.sahu/Migration v2/migration-v2/docs/features/sap-smartedit/scripts" && ./hac-export.sh myContentCatalog-export-v2.groovy stress-export-bundle/myContentCatalog-stress-export.impex
```

It writes the export **directly into the folder the connector reads**, so
there is no copying step between export and migration.

Show what came out:

```bash
head -40 "/Users/ayush.sahu/Migration v2/migration-v2/docs/features/sap-smartedit/scripts/stress-export-bundle/myContentCatalog-stress-export.impex"
```

```bash
grep -c "^                   ;" "/Users/ayush.sahu/Migration v2/migration-v2/docs/features/sap-smartedit/scripts/stress-export-bundle/myContentCatalog-stress-export.impex"
```

Talking point: genuine SAP ImpEx — one `INSERT_UPDATE` block per type, with
catalog-version columns, `[lang=xx]` localized columns and `&componentRef`
reference aliases. This same file can be re-imported into SAP.

---

## 3. Migrate it with the tool

In the UI:

1. **Select Legacy CMS** → SAP SmartEdit. It reads the folder from `localPath`
   and validates the ImpEx.
2. **Configure Destination Stack** → pick the org, then **create a new stack**
   (do not reuse an old demo stack — stale entries make the result ambiguous).
3. **Map Content Fields** → show the generated content types. Worth pausing on:
   - `Media` is diverted to Assets rather than becoming a content type
   - `cmsComponents` → a multi-reference field
   - `content` → HTML (rich text)
   - `media` → a file/asset field
4. **Run Test Migration** → Create Test Stack → Start Test Migration. Let the
   execution log stream; it shows the audit, then per-module import.
5. **Execute Migration** once the test looks right.

---

## 4. Show the result in Contentstack

Open the destination stack and show, in this order:

| What | Where | Why it matters |
|---|---|---|
| Entries per type | Entries | 290 source rows landed |
| **Assets** | Assets | 8 images with real bytes, no duplicates |
| **Reference** | open `body-nimbusDocsIndex` (ContentSlotForPage) | `page` and `contentSlot` are live entry links, not text |
| **Multi-reference** | open `Nimbus Mixed 4-Type Slot` (ContentSlot) | one slot referencing 4 *different* component types |
| **Nested reference** | open `supportNav-kbSubNav` (CMSNavigationEntry) | its `item` points at another navigation node — a reference chain |
| **Rich text** | open `RTE Complex Table` (CMSParagraphComponent) | tables/lists preserved in the RTE editor |
| **Asset link** | open `Docs Diagram` (CMSImageComponent) | `media` resolves to the migrated asset |
| **Localization** | open `Welcome (4 locales)`, switch locale | *Bienvenue chez Nimbus* / *Willkommen bei Nimbus* / *Bienvenido a Nimbus* |
| **Localized page title** | open `Nimbus Support Page`, switch locale | Support / Kundendienst / Assistance / Soporte |

Locale switcher is top-right of the entry editor.

### Be ready for this question

> "Why is this French entry showing English?"

Only 13 of the 290 rows are genuinely translated in SAP — the rest exist in
English only. For those, the connector copies the English value into every
locale rather than leaving the field blank. Use the entries listed above, which
have real translations. Genuinely-translated rows:

- `Welcome (4 locales)`, `Support Promise (4 locales)`, `Partner Pitch (4 locales)` — EN/DE/FR/ES
- `Nimbus Support Page`, `Nimbus Partners Page`, `Nimbus Events Page` (title) — EN/DE/FR/ES
- `Support Navigation`, `Knowledge Base`, `Events Navigation`, `Partners Navigation` (title) — EN/DE/FR/ES
- `Nimbus Hero Intro (localized)`, `Nimbus Footer Note (localized)`, `Main Navigation (localized)` — EN/DE only

---

## Known limitations — disclose these rather than get caught by them

- **Embedded images in rich text lose their `src`.** SAP's own CMS sanitizer
  strips `src` from `<img>` tags on import, so an image embedded *inside* RTE
  does not survive. Assets referenced through a proper media field are fine.
  This is SAP behavior, not the connector.
- **Scale is unproven past ~290 rows.** Do not claim a large customer catalog
  will migrate cleanly; that test has not been run.
- **Only the `Online` catalog version, one catalog.** `Staged` and
  multi-catalog setups are untested.
- **Type coverage is 13 CMS types.** A customer catalog will contain types we
  have not seen (restrictions, product carousels, flex components).

---

## If something breaks mid-demo

| Symptom | Cause | Fix |
|---|---|---|
| `HTTP 302` / expired session from `hac-export.sh` | HAC cookie expired | Re-capture cookie + CSRF (step 0a) |
| Export runs but file is empty | Groovy error | The script prints `stacktraceText` — read it |
| "No Content Types available" at Map Content Fields | Wrong/flattened input file | Confirm `localPath` points at the folder |
| Migration log stops at `? Are you sure you want to update name of master language? (Y/n)` | Locale name mismatch (fixed — needs the current code) | Restart the api so the fix is loaded |
| Duplicate assets in Contentstack | Extra copies of the images in the input folder | Folder must hold exactly the `.impex` + one `images/` |

**Safest recovery:** migrate into a brand-new stack. Most confusing demo
failures are stale data from a previous run, not a live fault.
