# TRD: Audit Report (source stack health check)

- **Slug:** `cs-audit-report`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** Chirag Chavan
- **Engineers:** Chirag Chavan
- **Created:** 2026-08-05
- **Last updated:** 2026-08-05

## 1. Overview

A new `api/v3` audit service scans a project's export folder on disk, resolves four health checks over it, and caches the result next to the export it derives from. A new `ui/v3` panel replaces the Audit step's existing placeholder, renders the scan's progress and its findings, and records the user's include/exclude decisions on the project record. No network calls to Contentstack are involved — the audit is pure filesystem work over data the export already wrote.

See [prd.md §1](./prd.md) for product framing and [feature.md §1](./feature.md) for the spec summary.

## 2. Scope

- **In scope:** the audit scan service and its four checks; the findings document and its cache; an async scan job with per-check progress; four new endpoints plus one write endpoint; the decision-resolution engine; the audit panel and its three states; the flagged-items table with server-side filter/search/pagination; the shared toast added to the wizard chrome; wiring the step's footer context and advance function.
- **Out of scope:**
  - **Fixing the exporter.** Two known defects — fallback records and un-fetched variants — are worked around here (TR-2, TR-5) rather than fixed at source. Deliberate: the user deferred both, and the workarounds make the audit correct on exports that already exist.
  - **Generating content mappings.** This feature persists decisions; Content mapping reads them (INT-4).
  - **Playwright / e2e specs.** Separate stage in the pipeline.
  - **Telemetry.** No analytics pipeline exists ([prd.md §10](./prd.md)).

Product-level non-goals live in [feature.md §5](./feature.md).

## 3. Requirements traceability

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1 | TR-1 | |
| FR-1.2 | TR-1 | Branch-folder tolerance |
| FR-1.3 | TR-1 | Both entry-filename forms |
| FR-1.4 | TR-2 | |
| FR-1.5 | TR-3 | |
| FR-1.6 | TR-1 | |
| FR-1.7 | TR-2 | Fallback-record filter |
| FR-2.1 | TR-4, TR-6 | |
| FR-2.2 | TR-4 | Folder locale, not record locale |
| FR-2.3 | TR-4 | Reinforces FR-2.2; corrected 2026-08-05 |
| FR-2.4 | TR-4 | |
| FR-2.5 | TR-5 | |
| FR-2.6 | TR-5 | Uncertain ⇒ used |
| FR-2.7 | TR-4 | |
| FR-2.8 | TR-4 | |
| FR-2.9 | TR-5 | |
| FR-2.10 | TR-6 | |
| FR-2.11 | TR-6, TR-17 | Enforced in both the resolver and the renderer |
| FR-2.12 | TR-5, TR-16 | Scan half in TR-5, caveat copy in TR-16 |
| FR-3.1 … FR-3.7 | TR-14 | Pure derivation |
| FR-4.1 … FR-4.6 | TR-16 | |
| FR-5.1 … FR-5.4 | TR-17 | |
| FR-6.1, FR-6.2 | TR-18 | |
| FR-6.3, FR-6.4 | TR-12, TR-18 | Server pages; client renders |
| FR-6.5, FR-6.6 | TR-12, TR-18 | Filter + search server-side |
| FR-6.7 … FR-6.10 | TR-18, TR-9 | |
| FR-6.11 … FR-6.13 | TR-18, TR-9 | Bulk button |
| FR-7.1 … FR-7.4 | TR-9 | Resolution engine |
| FR-7.2a | TR-9 | Category toggle clears that category's overrides |
| FR-7.5, FR-7.6 | TR-10 | Single write, on Continue |
| FR-7.7 | TR-9 | Stale overrides ignored, not deleted |
| FR-7.8, FR-7.9 | TR-7 | Cache location and invalidation |
| FR-8.1 … FR-8.4 | TR-20 | Chrome integration |
| FR-9.1 … FR-9.4 | TR-21 | Shared toast |
| FR-10.1 … FR-10.6 | TR-15 | Panel states |
| NFR-13, NFR-7 | TR-22 | Structured logging without customer content |

### Technical requirements

- **TR-1:** A shape-tolerant export reader resolves a project's export directory and enumerates its modules. It MUST accept modules at the export root or inside a single branch sub-folder, MUST accept entry files named `<locale>.json` or `*-entries.json`, MUST skip `index.json` chunk-pointer files, and MUST derive module presence from what exists on disk rather than from `project.source.*.selectedModules`.
- **TR-2:** Entry records are keyed by the pair (entry uid, folder locale). A record whose own `locale` field differs from the folder locale is a **fallback record** and MUST be dropped before any check, count or listing sees it.
- **TR-3:** Each check runs inside its own error boundary. An unreadable or unparseable file fails only the check that needed it, resolving that check to `Unavailable`; the remaining checks complete.
- **TR-4:** Four check resolvers, each a pure function over the parsed export: unpublished entry records (publish row matching the **folder** locale), empty content types, unused global fields, and — via TR-5 — unused assets. None may read `_in_progress`.
- **TR-5:** An asset-reference resolver walks every retained entry record and every variant record, collecting asset references from file fields, nested group fields, modular-block fields, rich-text and JSON-rich-text embeds, and asset URLs in text. It MUST default to "referenced" when it cannot decide, and MUST exclude `is_dir` assets from both the denominator and the flagged set.
- **TR-6:** A check-state resolver assigns each check exactly one of `done` (with a count), `notPresent` (module absent) or `unavailable` (module present, required data missing). A count MUST be absent — not zero — for the latter two, so a renderer cannot accidentally display `0`.
- **TR-7:** A findings document is written to the export directory after a successful scan and read on subsequent visits. It carries the export's own `exportedAt` as a cache key. It MUST NOT be written into the project record.
- **TR-8:** An async scan job with an in-memory registry, mirroring the existing export job: start returns a job id, and a poll returns the per-check states and a completion flag. A failed scan MUST leave no findings document behind.
- **TR-9:** A pure decision-resolution function takes the findings and the persisted decisions and returns, per item, whether it is included. Category state is a standing policy; per-item overrides are interpreted relative to it; an override matching no current item is ignored without being removed from storage. Toggling a category's state MUST clear that category's overrides (FR-7.2a) — so the resolver never has to reconcile an override with a category state the user has since changed.
- **TR-10:** Decisions are persisted on the project record through the existing store, behind the same region/owner scope predicate as every other project read.
- **TR-11:** A findings read endpoint returns the cached findings summary together with the resolved decisions, or 404 when no findings are cached.
- **TR-12:** An items endpoint applies category filter, case-insensitive search over title/uid/type/content-type, and pagination server-side, returning one page plus the total and page count.
- **TR-13:** A decisions write endpoint replaces the project's stored decisions wholesale.
- **TR-14:** A pure impact derivation computes the denominator, the excluded count and the migrating count from the findings plus the resolved decisions. It MUST derive the excluded count from resolved per-item decisions only, never by summing category totals with per-item counts.
- **TR-15:** The audit panel renders exactly one of three states — analyzing, ready, error — driven by the job and findings state, never by a stored flag.
- **TR-16:** Category cards for the excludable categories, each with a keyboard-operable switch, a danger-bordered excluded state with its count strip, and the variant caveat when variant data is absent.
- **TR-17:** Informational cards for the non-excludable categories, rendering `Keeping` / `All clean` / `Not present` / `Unavailable` and offering no exclusion control at all.
- **TR-18:** The flagged-items table: collapsible, six columns, filter pills with counts, search input, per-row checkbox (disabled for locked rows), excluded-row styling carrying a text label as well as colour, empty-result copy, and the bulk button.
- **TR-19:** A Redux slice holding the audit's client state — job progress, findings summary, current page of items, filter, search, page number, and the working decision set.
- **TR-20:** Chrome integration: the panel supplies `auditReady`, `excludedCount` and `migratingCount` to the wizard step context, and an advance function that persists decisions and resolves true only on success.
- **TR-21:** A shared toast component living in the wizard chrome, driven by a queue in the chrome's own state, self-dismissing after 2600ms.
- **TR-22:** Structured logging of each audit run — project id, per-check state, per-check count, duration — through the existing v3 logger, carrying identifiers and numbers only.

## 4. Architecture

- **Components touched:**
  - `api/v3/index.ts` — mount the new audit routes.
  - `api/v3/models/project.store.ts` — read/write the new decisions field.
  - `api/v3/models/types.ts` — new types.
  - `api/v3/utils/migrationData.util.ts` — reused to resolve the export directory.
  - `ui/v3/pages/Migration/index.tsx` — replace the Audit placeholder with the panel.
  - `ui/v3/components/wizard/*` — host the shared toast; consume the new step context values.
  - `ui/v3/store/index.ts` — register the audit slice.
- **New components:**
  - `api/v3/services/auditReader` — TR-1, TR-2, TR-3. Owner: BE. Pure over the filesystem; no network.
  - `api/v3/services/auditChecks` — TR-4, TR-5, TR-6. Owner: BE. Pure functions over parsed input, so every check is unit-testable without touching disk.
  - `api/v3/services/auditScan` — TR-7, TR-8. Owner: BE. Orchestrates reader → checks → findings document, and owns the job registry.
  - `api/v3/services/auditDecisions` — TR-9, TR-14. Owner: BE. Pure resolution and impact derivation, shared by the items endpoint and the findings endpoint.
  - `api/v3/controllers` + `api/v3/routes` — TR-11, TR-12, TR-13. Owner: BE.
  - `ui/v3/components/audit/*` — TR-15…TR-18. Owner: FE.
  - `ui/v3/store/slice/audit.slice.ts` + thunks — TR-19. Owner: FE.
  - `ui/v3/components/wizard/Toast` — TR-21. Owner: FE, but lives in the chrome's directory (feature.md FR-9.1).
- **Data flow (happy path):**
  1. The panel mounts and requests the findings (API-3).
  2. **404** — nothing cached. The panel starts a scan (API-1) and polls (API-2), rendering per-check progress.
  3. The scan resolves the export directory, reads the modules, drops fallback records, runs the four checks, and writes the findings document.
  4. The panel's poll reports completion; it re-requests API-3 and receives the findings summary plus the resolved decisions.
  5. The panel requests the first page of items (API-4) and renders the ready state.
  6. Toggles mutate the working decision set in the slice; the impact panel re-derives locally from the same pure function the server uses.
  7. Continue calls API-5, then resolves the chrome's advance gate.
- **Data flow (cached path):** step 1 returns 200 and the panel goes straight to step 5. No scan, no job (AC-1.4).
- **Data flow (error path):**
  1. The export directory is missing or unreadable → the scan fails, writes no findings document, and the job reports failure with a reason.
  2. The panel renders the error state with the route back to Source, and the chrome's gate stays closed.
  3. A single unreadable *module* file is not this path — it degrades one check to `unavailable` and the scan still succeeds (TR-3).
- **Concurrency / ordering constraints:**
  - Fallback filtering (TR-2) MUST happen before any check runs. A check that sees fallback records produces wrong counts, which is the exact defect FR-1.7 exists to prevent.
  - The findings document MUST be written only after all four checks resolve, so a crash mid-scan cannot leave a partial cache (NFR-11).
  - Decisions resolution (TR-9) MUST run against the *current* findings, never against the findings the decisions were authored against — that is what makes a category a standing policy (FR-7.4).
  - Two concurrent scans for the same project are permitted but wasteful; the second wins the cache write. Last write wins, consistent with A-5.

## 5. Data model

- **DM-1:** `AuditFindings` — a JSON document written to `<exportDir>/audit.json`. **No database change.** Contents: the cache key (the export's `exportedAt`), the module-presence map, the four check states with their counts, the denominator components, and the flagged item inventory. Written whole, read whole. Deleted implicitly when the export folder is replaced, because the exporter clears the directory before rewriting — which is what makes FR-7.8's invalidation structural rather than a rule someone has to remember.

- **DM-2:** `V3Project.audit?: V3AuditDecisions` — a new **optional** field on the existing lowdb project record. Shape: a category-state map, a per-item override map keyed per FR-7.3, and an `updatedAt`. **No migration and no backfill:** absent means "no decisions yet", which resolves to everything included (FR-7.1) — the same default a new project gets. Existing records are valid unchanged.

- **DM-3:** `AuditItem` — the per-item shape inside DM-1: the FR-7.3 key, category, type label, title, uid, content type, locale, status label. Assets carry no locale; content types and global fields carry neither locale nor content type. Nothing else from the source record is copied in, which is what keeps FR-10.6 and NFR-7 satisfiable — the findings document cannot leak entry bodies because it never holds them.

- **DM-4:** In-memory scan job registry — process-local, not persisted. Contents per job: project id, per-check state, completion flag, failure reason. Lost on restart (TRR-1).

**Item key format (FR-7.3), the contract Content mapping will read (INT-4):**

```
entry:<contentTypeUid>:<entryUid>:<locale>
asset:<assetUid>
```

Prefixed so an entry uid and an asset uid can never collide, and locale-qualified because the same entry uid legitimately exists in several locales with independent publish state.

## 6. API contracts

All five endpoints sit under the existing authenticated `/v3/project/:projectId` mount, so the session guard and the region/owner scope predicate apply without new code (NFR-6). `:projectId` is resolved through the scoped project read first; the export directory is then derived from the project's *stored* source data, never from the URL — see §12.

### API-1: `POST /v3/project/:projectId/audit/run`

- **Purpose:** start a scan. Used on first visit and for "Re-run audit".
- **Auth:** valid session; project must be in the caller's scope.
- **Request:** `{ force?: boolean }` — `force: true` ignores any cached findings (UC-8).
- **Response (202):** `{ jobId: string }`
- **Error cases:** 404 project not found or out of scope · 409 export directory unreadable (→ the panel's error state, EC-1/EC-2)
- **Idempotency:** no. Two calls start two scans; the later cache write wins.
- **Realizes:** UC-1, UC-8, FR-10.1 · TR-8

### API-2: `GET /v3/project/:projectId/audit/run/:jobId`

- **Purpose:** poll scan progress for the analyzing state's four check rows.
- **Auth:** as API-1.
- **Response (200):**
  ```
  { status: 'running' | 'succeeded' | 'failed',
    checks: [ { id, state: 'queued'|'checking'|'done'|'notPresent'|'unavailable' } ],
    resolvedCount: number,
    error?: string }
  ```
- **Error cases:** 404 unknown job id — including after a server restart (TRR-1)
- **Idempotency:** yes, read-only.
- **Realizes:** FR-10.1, FR-2.10 · TR-6, TR-8

### API-3: `GET /v3/project/:projectId/audit`

- **Purpose:** the cached findings summary plus the resolved decisions — everything the ready state needs except the item rows.
- **Auth:** as API-1.
- **Response (200):**
  ```
  { findings: {
      checks:   [ { id, state, count?, label } ],
      modules:  { entries: boolean, assets: boolean, contentTypes: boolean, globalFields: boolean },
      totals:   { contentTypes, globalFields, assets, entryRecords, denominator },
      variantsInspected: boolean },
    decisions: { categories: {...}, itemOverrides: {...} },
    impact:    { denominator, excluded, migrating } }
  ```
- **Error cases:** 404 no findings cached for the current export (→ the client starts API-1) · 404 project out of scope
- **Idempotency:** yes, read-only.
- **Realizes:** AC-1.4, AC-7.1, FR-3.1…FR-3.4, FR-5.4 · TR-11, TR-14

`count` is **absent**, not `0`, for a `notPresent` or `unavailable` check — the wire format itself enforces FR-2.11 rather than trusting the renderer.

### API-4: `GET /v3/project/:projectId/audit/items`

- **Purpose:** one page of flagged items, filtered and searched server-side.
- **Auth:** as API-1.
- **Request (query):** `filter=all|entries|assets|contentTypes|globalFields` · `q=<string>` · `page=<1-based>` · `pageSize=<default 50>`
- **Response (200):**
  ```
  { items: AuditItem[], page: number, pageCount: number, total: number,
    counts: { all, entries, assets, contentTypes, globalFields } }
  ```
- **Error cases:** 404 no findings cached · 400 page out of range
- **Idempotency:** yes, read-only.
- **Realizes:** FR-6.3…FR-6.6, FR-6.10, AC-4.1…AC-4.4 · TR-12

`counts` is returned on every page so the filter pills stay correct without a second request, and so a pill's count never reflects only the current page.

### API-5: `PUT /v3/project/:projectId/audit/decisions`

- **Purpose:** persist the decision set.
- **Auth:** as API-1.
- **Request:** `{ categories: {...}, itemOverrides: {...} }`
- **Response (200):** `{ decisions: {...} }`
- **Error cases:** 400 malformed keys · 404 project out of scope
- **Idempotency:** yes — a full replace, so repeating it is harmless.
- **Realizes:** FR-7.5, FR-8.4, AC-6.4, AC-6.5 · TR-10, TR-13

### Events

**None.** No event bus exists in this repository, and the scan's progress is polled rather than pushed (TC-1).

## 7. Integration points

- **INT-1 (DEP-1):** **Source export folder** — we read, nobody writes on our behalf. Contract owner: the export services. Latency: filesystem-local. Fallback when absent or unreadable: the scan fails and the panel renders its error state (EC-1, EC-2). **Two known defects are worked around here rather than at source** — fallback records (TR-2) and un-fetched variants (TR-5) — both deferred by explicit decision.
- **INT-2 (DEP-2):** **Migration wizard chrome** — bidirectional. We consume its step definition (labels, status lines, gate) and supply its step context values plus the advance function; we also add the shared toast into its component tree. Contract owner: `migration-wizard-chrome`. Fallback: none needed — the chrome already renders and already declares the three context fields we fill.
- **INT-3 (DEP-3):** **v3 project store** — we call. Provides the scoped project read and the decisions write (DM-2). Contract owner: this repository's `api/v3/models`. Fallback when a write fails: the wizard does not advance and the error surfaces (AC-6.5).
- **INT-4 (DEP-4):** **Content mapping (step 4)** — they will call, downstream and not yet built. They read DM-2 and hide excluded items. Contract owner: the Content mapping feature. **The item-key format in §5 is the contract**; it needs joint sign-off before this feature ships, because changing it once decisions exist in the wild requires a data migration ([prd.md §12](./prd.md), PR-6).
- **INT-5 (DEP-5):** **Contentstack Management API** — **explicitly none.** The audit makes no network calls of any kind. Recorded rather than omitted so that a future change introducing one is a visible decision, not a drift.

## 8. Technology choices

- **TC-1: Async job with polling, not a synchronous request** — chosen because NFR-1 permits a 10-second scan, and holding an HTTP request open that long is fragile behind proxies while giving the client nothing to render. It also makes the design's four progressing check rows reflect real state rather than being decoration, and lets a single failing check be reported individually (TR-3). Alternatives: **synchronous GET** — rejected for the reasons above, though it is genuinely simpler and would be adequate if the cache always hit; **server-sent events / WebSocket** — rejected, no such transport exists anywhere in this repository and polling a short-lived job is not worth introducing one. Recorded as TQ-1 because the user has not confirmed it.
- **TC-2: Findings cached in the export directory, decisions on the project record** — chosen because the two have opposite lifetimes and opposite sizes. Findings are derived, potentially megabytes, and must die with the export; decisions are user-authored, tiny, and must outlive it. Putting findings in the project record would send them to the browser on every project-list request, since that endpoint returns whole records. Putting them in the export folder makes FR-7.8's invalidation structural: the exporter clears the directory, so the stale cache cannot survive its input. Alternatives: **both in the project record** — rejected on size and on the list-response leak; **a new lowdb store for findings** — rejected, it would need its own invalidation logic to do what a directory deletion already does; **recompute on every request, no cache** — rejected against NFR-2.
- **TC-3: Server-side filter, search and pagination** — forced by FR-6.3/FR-6.4: the client holds one page, so it cannot filter or search the rest. Alternative: **ship the whole inventory and filter client-side** — rejected because it defeats pagination's purpose and would send tens of thousands of rows to the browser on a large stack.
- **TC-4: Filter fallback records inside the audit rather than waiting for the exporter fix** — chosen because it makes the audit correct on the exports that exist today (8 unpublished, not 55) and stays correct after the exporter is fixed, so the workaround costs nothing beyond the code itself. Alternative: **trust the export and fix the exporter first** — rejected because the user deferred that fix, and shipping the audit meanwhile would ship a wrong headline number. The cost is TRR-5: a workaround nobody dares delete later.
- **TC-5: Reuse the export's job-registry pattern rather than generalising it** — chosen to keep this feature's surface small; the two registries are ~30 lines each and a shared abstraction over two callers is premature. Alternative: **extract a shared job runner** — deferred, and worth revisiting when a third async job appears.
- **TC-6: Decisions saved on Continue, not on every toggle** — chosen to match how Source and Destination already behave in this wizard, and because it makes AC-6.4/AC-6.5 (persist fails ⇒ do not advance) coherent: there is one write, at one moment, whose failure has one meaning. Alternatives: **autosave per toggle** — rejected for now because the project store rewrites its whole JSON file per write, so a user clicking twenty checkboxes triggers twenty full-file rewrites, and it introduces a silent-failure mode where a toggle appears to work but did not save; **debounced autosave** — rejected as the worst of both for testability. The cost is real and recorded: a browser refresh mid-audit loses unsaved toggles. This directly contradicts [feature.md UC-2](./feature.md)'s postcondition — see TQ-2.

## 9. Sequencing & phases

- **Phase 1 — the scan and its findings (server only).** Covers TR-1…TR-8, TR-22. Unlocks a verifiable, correct findings document for any export on disk, testable entirely through the api suite with no UI. This is where every subtle rule lives (fallback filtering, folder-locale publish matching, uncertain-means-used), so landing it alone means those rules get tested without UI noise.
- **Phase 2 — decisions and the read endpoints.** Covers TR-9…TR-14. Unlocks the full server contract: findings, paginated items, resolved decisions, impact numbers, persistence.
- **Phase 3 — the panel.** Covers TR-15…TR-20. Unlocks the user-visible feature: three states, cards, table, footer gate.
- **Phase 4 — the shared toast.** Covers TR-21. P1 throughout ([prd.md §6](./prd.md)); deliberately last so deferring it cannot block the rest. FR-9.4 is P0 precisely so that Phase 4 slipping leaves no gap in feedback.

Phases 1 and 2 are both server-side and could merge; they are listed separately because Phase 1 is where correctness lives and it benefits from landing behind its own green suite.

## 10. Testing strategy

The test-cases skill generates detailed cases from feature.md ACs; this is the engineering placement plan. Conventions follow the three prior v3 features: pure logic as `unit`, endpoint contracts via supertest as `integration`, and React components as `unit (component)` under `ui/`.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit (component) | `ui/` audit panel | Analyzing state renders unprompted; counter at "0 of 4 checks" |
| AC-1.2 | unit (component) | `ui/` audit panel | Mid-scan per-check states from a mocked poll |
| AC-1.3 | unit (component) | `ui/` audit panel | Transition to ready renders all four regions |
| AC-1.4 | integration | `api/` audit routes | 200 from API-3 ⇒ no scan started; assert the reader was not invoked |
| AC-2.1 | unit (component) | `ui/` category card | F1 · switch, danger border, count strip copy verbatim |
| AC-2.2 | unit | `ui/` impact derivation | F1 · 30 of 36, 83%, impact-line copy — pure function, no render |
| AC-2.3 | unit (component) | `ui/` category card | F1 · toggle back clears border, strip and the excluded count |
| AC-2.4 | unit (component) | `ui/` chrome toast | Appears with the count; self-dismisses on a fake timer |
| AC-2.5 | unit (component) | `ui/` audit panel | Zero-count category renders no card |
| AC-3.1 | unit (component) | `ui/` items table | F1 · single-row exclude ⇒ 35 of 36 |
| AC-3.2 | unit | `ui/` decision resolution | F1 · override re-includes one row inside a bulk-excluded category ⇒ 31 of 36 |
| AC-3.3 | unit (component) | `ui/` items table | Locked row: disabled checkbox, explanation, click is inert |
| AC-3.4 | unit | `api/` decision resolution | Locale independence — `de` excluded leaves `en` included |
| AC-4.1 | integration | `api/` audit items endpoint | F2 · 50 rows, page 1 of 3 |
| AC-4.2 | integration | `api/` audit items endpoint | Category filter applied server-side |
| AC-4.3 | integration | `api/` audit items endpoint | Case-insensitive search across all four fields |
| AC-4.4 | unit (component) | `ui/` items table | Empty-result copy verbatim |
| AC-4.5 | unit (component) | `ui/` audit panel | "Review items ↓" expands, sets the filter, scrolls |
| AC-4.6 | unit (component) | `ui/` items table | Collapse/expand preserves per-item decisions |
| AC-5.1 | unit | `ui/` decision resolution | F1 · exclude-all ⇒ 26 of 36 |
| AC-5.2 | integration | `api/` items + decisions | F2 · bulk acts on all 120, not the visible 50 nor the filtered subset |
| AC-5.3 | unit | `ui/` decision resolution | Include-everything clears categories **and** overrides |
| AC-5.4 | unit (component) | `ui/` items table | Bulk button label flips on first exclusion |
| AC-6.1 | unit (component) | `ui/` chrome footer | Disabled + explanation + analyzing status line |
| AC-6.2 | unit (component) | `ui/` chrome footer | Enabled + "nothing excluded" status line |
| AC-6.3 | unit (component) | `ui/` chrome footer | F1 · "Audit complete — 10 excluded, 26 will migrate" |
| AC-6.4 | integration | `api/` decisions + `ui/` thunk | Persist precedes advance; assert call order |
| AC-6.5 | integration | `ui/` thunk | Persist fails ⇒ no advance, error surfaced |
| AC-7.1 | integration | `api/` audit routes | Persisted category + override reapplied on read |
| AC-7.2 | unit (component) | `ui/` audit panel | No decisions ⇒ all included, default impact line |
| AC-8.1 | integration | `api/` audit run endpoint | `force: true` bypasses the cache and re-reads disk |
| AC-8.2 | integration | `api/` audit scan | Re-run reflects changed export contents |
| AC-8.3 | unit | `api/` decision resolution | Standing policy — 4 flagged grows to 9, all excluded |
| AC-9.1 | integration | `api/` audit scan | F3 · `notPresent`; assert `count` key is **absent**, not 0 |
| AC-9.2 | unit | `api/` impact derivation | F3 · denominator 16 |
| AC-9.3 | integration | `api/` audit scan | No `publish_details` ⇒ `unavailable`, never 0 |
| AC-9.4 | unit (component) | `ui/` informational card | Zero-count ⇒ "All clean" pill |

- **Fixtures / test data:** the three fixtures in [feature.md §11](./feature.md) become **on-disk temp-directory fixtures** built by a helper in the api suite — a real folder tree written to `os.tmpdir()`, matching the pattern the existing `bundleWriter` folder tests already use. Never a copy of a real customer export: fixtures are synthetic, so no customer content enters the repository. The ui suite uses the same fixture *numbers* against mocked endpoints.
  - A fourth, deliberately hostile fixture is needed and is not in feature.md's list: an export containing **fallback records** (a `de/` folder holding a record whose `locale` is `en`), to prove TR-2 drops them. Without it FR-1.7 is untested.
- **Test-only feature flag or seed hook:** none. The audit reads a directory, so pointing it at a temp directory is the seam — no hook required.
- **CI signal:** `api` unit + integration green, `ui` unit green, `tsc --noEmit` clean for `api/v3` and `ui/v3`. Note the pre-existing `@types` gaps in this repository produce TS7016/TS7006 noise across `src/` and `v3/` alike; the gate is "no *new* error classes", as with the prior three features.
- **Known coverage gap:** `ui/vitest.config.ts` excludes `src/components/**` and `src/pages/**` from coverage thresholds. The audit's components will not appear in coverage numbers. Not changed unilaterally — recorded here as it was for the three prior features.

## 11. Observability

- **Logs** (through the existing `v3Log`, one JSON line per event):
  - `audit.scan.started` — `{ projectId }`
  - `audit.scan.check` — `{ projectId, check, state, count }`
  - `audit.scan.succeeded` — `{ projectId, durationMs, denominator }`
  - `audit.scan.failed` — `{ projectId, reason }` where `reason` is a fixed classification (`export_missing`, `export_unreadable`, `internal`), never a raw filesystem path — a path can contain a stack api key.
  - `audit.decisions.saved` — `{ projectId }` only. Whether to log exclusion counts is a product decision, not an incidental one ([prd.md §10](./prd.md), PQ-2).
  - **Never logged:** entry titles, entry uids, asset filenames, asset uids, content-type titles — all customer content under NFR-7.
- **Metrics:** none. No metrics backend exists in this repository. Scan duration is available from the log line above; that is the whole of it, and stating so is more honest than naming a counter nobody collects.
- **Alerts:** none — no alerting destination exists.
- **Dashboards:** none.
- **Traces / spans:** none.

## 12. Security

- **Auth / authz:** no new scopes. Every endpoint mounts under the authenticated `/v3/project/:projectId` path, and the project is resolved through the existing scoped read, so region and ownership come from the verified token only (NFR-6). A project outside the caller's scope is indistinguishable from one that does not exist (EC-16) — the store's existing predicate already provides this, so it is inherited rather than re-implemented.
- **Path traversal — the one genuinely new surface.** These endpoints take a `projectId` from the URL and turn it into a filesystem path. The mitigation is ordering: `projectId` is used **only** as a lookup key into the scoped project read, and the export directory is derived from the project's own stored source data via the existing `stackDataDir` helper. No URL segment is ever concatenated into a path. A traversal attempt therefore fails as a project-not-found before touching the filesystem. This ordering is a requirement, not an implementation detail — see TRR-4.
- **PII handling:** none introduced. The findings document holds only the fields DM-3 lists; entry bodies, asset binaries and user identifiers are never copied into it, which is what makes FR-10.6 and NFR-7 enforceable at the data layer rather than the render layer. Retention: findings die with the export; decisions live as long as the project.
- **Threat model deltas:** one new read surface over the operator's own filesystem, and one new write to an existing record. No new network egress (INT-5). No new user input reaches a shell, a query or a path.
- **Secret handling:** none. This feature reads no credentials and writes none. Note the project record it writes to *also* holds the encrypted destination management-token secret; the decisions write must therefore be a field-level update on the existing record, not a whole-record replace, or it could clobber that secret.
- **Compliance flags:** none. No new data collection, no external transmission.

## 13. Performance

References `NFR-1` … `NFR-5` in [feature.md §9](./feature.md).

- **Expected load:** single-operator self-hosted tool. Effectively one concurrent scan; a handful of item-page requests per audit. Dataset size is the variable that matters, not request rate — the reference stack is 366 records and 80 assets, and 50,000 records is the stated ceiling (NFR-5).
- **Hot paths / bottlenecks:**
  1. **The asset-reference scan (TR-5)** is the expensive one — it must inspect every retained record's field values, and a naive implementation is *assets × records*. It should build a single set of referenced asset uids in one pass over the records, then diff against the asset list, making it *records + assets* rather than a product.
  2. **Reading and parsing every entry file.** Unavoidable for both the publish check and the asset scan; the mitigation is doing it once and running all checks over the parsed result, not once per check.
  3. **Findings document size.** With 50,000 flagged records, DM-1 grows large enough that reading it whole for a single 50-row page becomes the dominant cost of API-4. Acceptable at the reference scale; the ceiling is TQ-3.
- **Caching strategy:** one cache, DM-1, keyed on the export's `exportedAt`, invalidated structurally by the exporter clearing the directory. No in-memory cache layer, no TTL — a stale findings document is impossible by construction rather than by expiry.
- **Load-test plan:** none automated. Verification is a timed scan of the real 366-record reference export against NFR-1, plus a synthetic 50,000-record fixture to establish where NFR-5 actually breaks (feeding TQ-3). Recorded as a manual step rather than a pipeline stage, because no load-testing harness exists here.

## 14. Rollout / feature flag

- **Flag name:** none ([prd.md §9](./prd.md)). Gated by the audit endpoints existing and the panel replacing the step's placeholder.
- **Default state at merge:** the `api/v3` audit routes mounted; the Audit step renders the panel instead of *"The Audit step is not built yet."* Source, Destination, the dashboard and v2 are untouched.
- **Gated code paths:** `api/v3/services/audit*`, `api/v3/routes/audit.routes.ts` and its controller, `ui/v3/components/audit/**`, `ui/v3/store/slice/audit.slice.ts`, the audit branch in `ui/v3/pages/Migration/index.tsx`, and the toast in `ui/v3/components/wizard/`.
- **Config surface:** none new.
- **Per-stage flip:** manual, same as every prior v3 feature — it is the same `/v3` surface.

## 15. Rollback plan

- **How to disable:** restore the placeholder branch in `ui/v3/pages/Migration/index.tsx` (one line) and stop mounting the audit routes. Full revert deletes the audit-specific `api/v3` and `ui/v3` files plus the `audit` field on the project type. **This rollback is unusually clean** compared with Source or Destination: the Audit step already existed in the tracker with a placeholder body, so reverting returns the wizard to a state it has already shipped in, rather than leaving a hole.
- **Data cleanup on rollback:**
  - `project.audit` (DM-2) is additive and optional; leaving it costs nothing and it is ignored by every other reader.
  - `audit.json` files inside export directories become orphans. Harmless — nothing else reads them, and the next export deletes the directory containing them. No cleanup step required.
  - The shared toast (TR-21) lives in the chrome. If other steps have begun using it by rollback time, it must **not** be reverted with this feature — that coupling is the one part of this rollback that is not isolated.
- **What breaks if we rollback mid-flow:**
  - A user mid-audit loses their unsaved decisions — under TC-6 that is *every* decision they have made, since nothing is written until Continue. This is the sharpest consequence of the save-on-Continue choice and is the honest cost of TQ-2.
  - Already-persisted decisions become dormant, not lost: they stay on the project record and are reapplied if the feature returns.
  - **Content mapping, if it has shipped by then, silently loses its exclusion source.** It would show every item again, including ones the user excluded. Nothing errors — the user simply sees their decisions quietly undone, which is worse than a failure. This is the one downstream break worth planning for, and it is why the INT-4 key-format sign-off matters before ship.
  - Nothing in Source, Destination, the dashboard or v2 breaks. This feature only reads the export and adds one optional field.
- **Rollback SLA:** minutes — one route mount, one panel branch, no data migration, no external state to reverse.

## 16. Risks & mitigations (technical)

- **TRR-1:** **The job registry is in-memory (DM-4).** An api restart mid-scan orphans the client's poll, which then 404s forever. Likelihood: low in normal use, certain during development. Impact: low — the user re-runs, and the findings cache means nothing is lost. Mitigation: the panel MUST treat a 404 from API-2 as "start again", not as a fatal error. This is the same class of defect the export's own in-memory jobs already have; not worsening it, but not fixing it either.
- **TRR-2:** **Scan cost and memory on large exports.** TR-5 holds every retained record's parsed content in memory long enough to collect asset references. At 50,000 records this may exceed NFR-1 or exhaust the heap. Likelihood: medium at the stated ceiling, low at real scale today. Impact: medium — a failed scan blocks the step. Mitigation: single-pass reference collection (§13); the real ceiling is TQ-3, to be established with a synthetic fixture rather than guessed.
- **TRR-3:** **Incomplete asset-reference detection.** The most consequential technical risk in the feature, because its failure mode is advising a user to delete content that is in use. Likelihood: medium — there are at least five distinct places an asset can be referenced, and rich-text embeds are the easiest to miss. Impact: high, and invisible until after migration. Mitigation: FR-2.6 makes uncertainty resolve to "used"; the test plan requires one case per reference location; and the known variant blind spot is disclosed in the UI rather than hidden (FR-2.12).
- **TRR-4:** **Path traversal via `projectId`.** These are the first v3 endpoints to turn a URL segment into a filesystem lookup. Likelihood: low, given the mitigation. Impact: high if the ordering in §12 is ever inverted — reading arbitrary directories on the api host. Mitigation: the ordering is stated as a requirement (§12), and it should carry an explicit negative test asserting that a traversal-shaped `projectId` returns not-found without any filesystem access.
- **TRR-5:** **The fallback-record workaround becomes permanent.** TR-2 exists only because the exporter is wrong (TC-4). Once the exporter is fixed the filter becomes a no-op — but a no-op that nobody will dare delete, because its purpose will not be obvious. Likelihood: high. Impact: low functionally, medium as accumulated confusion. Mitigation: FR-1.7 carries its own reason inline; the api-side test for it should be named so it is findable when the exporter is fixed.
- **TRR-6:** **Cache invalidation depends on the exporter's current behaviour.** DM-1's invalidation is structural *because* `writeStackBundleFolder` clears the directory before rewriting. If that ever changes to an in-place update, stale findings would survive a re-export and the audit would report on data that no longer exists. Likelihood: low. Impact: high — silently wrong findings, the worst outcome for this feature. Mitigation: the `exportedAt` cache key is stored in DM-1 as a second, independent check, so a stale document is detectable even if the directory is not cleared.
- **TRR-7:** **The decisions write must not clobber the encrypted management-token secret.** The project record now also holds `destinationToken.secretEncrypted`. A whole-record replace from the audit's write path would destroy a live credential. Likelihood: low. Impact: high — an unrecoverable credential loss, since the token cannot be re-read from Contentstack. Mitigation: API-5 performs a field-level update through the store, and the store test should assert the token survives a decisions write.

## 17. Task breakdown

**Phase 1 — scan and findings (server)**

- **T-1:** Export-directory resolution + shape-tolerant module reader — realizes TR-1 — M
- **T-2:** Entry-record model with fallback-record filtering — realizes TR-2 — depends on T-1 — S
- **T-3:** Per-check error isolation — realizes TR-3 — depends on T-1 — S
- **T-4:** The three non-asset checks (unpublished / empty content types / unused global fields) — realizes TR-4 — depends on T-2 — M
- **T-5:** Asset-reference resolver, including variant files and the uncertain-means-used rule — realizes TR-5 — depends on T-2 — L
- **T-6:** Check-state resolver (`done` / `notPresent` / `unavailable`, count absent not zero) — realizes TR-6 — depends on T-4, T-5 — S
- **T-7:** Findings document write/read with the `exportedAt` cache key — realizes TR-7 — depends on T-6 — S
- **T-8:** Async scan job + in-memory registry — realizes TR-8 — depends on T-7 — M
- **T-9:** Structured logging for the scan — realizes TR-22 — depends on T-8 — S

**Phase 2 — decisions and read endpoints (server)**

- **T-10:** `V3AuditDecisions` types + the field-level store read/write (must not clobber `destinationToken`) — realizes TR-10 — depends on T-7 — S
- **T-11:** Decision-resolution engine (category policy + overrides + stale-override tolerance) — realizes TR-9 — depends on T-10 — M
- **T-12:** Impact derivation — realizes TR-14 — depends on T-11 — S
- **T-13:** API-1 / API-2 run + poll endpoints — realizes TR-8 — depends on T-8 — S
- **T-14:** API-3 findings read endpoint — realizes TR-11 — depends on T-12 — S
- **T-15:** API-4 items endpoint with server-side filter, search and pagination — realizes TR-12 — depends on T-11 — M
- **T-16:** API-5 decisions write endpoint — realizes TR-13 — depends on T-10 — S
- **T-17:** Path-traversal ordering + its negative test — realizes TRR-4's mitigation — depends on T-13 — S

**Phase 3 — the panel (client)**

- **T-18:** Audit slice + thunks — realizes TR-19 — depends on T-14, T-15, T-16 — M
- **T-19:** Panel shell with the three states — realizes TR-15 — depends on T-18 — M
- **T-20:** Impact panel — realizes TR-14 (client half) — depends on T-18 — S
- **T-21:** Category cards, switches, count strips, variant caveat — realizes TR-16 — depends on T-18 — M
- **T-22:** Informational cards — realizes TR-17 — depends on T-18 — S
- **T-23:** Flagged-items table: columns, pills, search, per-row checkboxes, bulk button — realizes TR-18 — depends on T-18 — L
- **T-24:** Chrome integration — step context values + the advance function — realizes TR-20 — depends on T-19, T-16 — S
- **T-25:** Replace the Audit placeholder in `Migration/index.tsx` — realizes TR-15 — depends on T-19 — XS

**Phase 4 — toast (P1)**

- **T-26:** Shared toast in the wizard chrome + queue — realizes TR-21 — depends on T-24 — S

## 18. Open questions

- **TQ-1:** Is the async job + polling design (TC-1) the right call, or is a synchronous findings request acceptable given the cache? The user has not confirmed. Affects API-1, API-2 and TR-8; the client's analyzing state changes shape either way. — owner: Chirag — needed by: start of Phase 1.
- **TQ-2:** ~~Are decisions saved on every toggle or only on Continue?~~ **Resolved 2026-08-05: only on Continue**, confirming TC-6. feature.md FR-7.5 now states the write moment explicitly and the three UC postconditions that claimed a toggle persists have been corrected, so the contradiction no longer exists in the spec. TR-10 and API-5 stand as written.
- **TQ-3:** What is the real memory and time ceiling for the scan, and what happens past it — refuse, sample or stream (feature.md NFR-5, Q-6, EC-14)? To be measured with a synthetic 50,000-record fixture rather than estimated. — owner: Chirag — needed by: before GA, not before Phase 1.
- **TQ-4:** ~~When a category switch is toggled, are its per-item overrides cleared or preserved?~~ **Resolved 2026-08-05: cleared**, now specified as feature.md FR-7.2a. TR-9's resolution rule is therefore: a category toggle drops every override belonging to that category, which also makes EC-9's determinism requirement trivially satisfied rather than something the resolver has to guarantee.
- **TQ-5:** Should the findings document be versioned, so that a shape change in a later release invalidates old `audit.json` files rather than being misparsed? Cheap to add now, awkward later. — owner: Chirag — needed by: implementation of T-7.
- **TQ-6:** Should `pageSize` be a client-supplied query parameter at all, or fixed server-side at 50? A client-supplied value is an unbounded-response risk if it is not capped (feature.md Q-7, PQ-4). — owner: Chirag — needed by: implementation of T-15.

### Spec inconsistencies found while writing this TRD

Recorded here rather than corrected, because feature.md is immutable to this skill. None block Phase 1.

1. ~~**UC-2 postcondition vs AC-6.4** — the persistence contradiction in TQ-2.~~ **Corrected in feature.md on 2026-08-05:** FR-7.5 now states that the write happens once, on Continue, and the postconditions of UC-2, UC-3 and UC-5 have been reworded from "persisted" to "recorded, written when the user continues".
2. ~~**FR-2.3's justification is stale.**~~ **Corrected in feature.md on 2026-08-05** — and the requirement itself turned out to be inverted, not merely badly justified: as written it forbade flagging a record whose `publish_details` held only other-locale rows, which directly contradicted FR-2.2. It now reads "MUST **still** be flagged", and the stale 44-of-194 justification is withdrawn.
3. **§17's real-stack figures predate FR-1.7 and FR-2.12** — the bullet lists 366 / 55 / 77 / 134 / 132. Measured after those two requirements, the same export yields 241 / 8 / 70. §11's fixture note already tells readers §17 is context-only, so this misleads no test, but the numbers are wrong as stated.
4. **FR-2.9 has nothing to act on** — no export this repository produces contains `is_dir` assets, because asset folders are never fetched. The requirement is right; it is simply unexercised, and its test will need a hand-made fixture.

## 19. References

- [feature.md](./feature.md)
- [prd.md](./prd.md)
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Audit Report Step - Prototype copy copy"** — reference design for all three panel states. Reference only; not copied into the repository.
- `/Users/chirag.chavan/Documents/cs_chirag_demo` — Contentstack CLI export of stack `blt42a635a271789809`, the same stack this repository exported on 2026-08-05. **Ground truth** for the export shape and for the two defects TR-2 and TR-5 work around: 124 localized records vs our 249, and 9 variant files we do not fetch. Basis for TC-4.
- `/Users/chirag.chavan/Documents/cs_ui_published` — CLI export of stack `bltef5ad9f8875c3145`. Source of the branch-folder layout and `*-entries.json` filename form behind TR-1.
- `api/v3/cmsMigrationData/blt42a635a271789809` — this repository's export of the same stack; the input the audit must be correct against **today**, fallback records and all.
- [docs/features/cs-source-selection/trd.md](../cs-source-selection/trd.md) — the export services this feature reads (INT-1); prior art for the async-job pattern reused in TC-5.
- [docs/features/migration-wizard-chrome/feature.md](../migration-wizard-chrome/feature.md) — the chrome hosting this panel and the toast (INT-2).
- [docs/features/cs-destination-selection/trd.md](../cs-destination-selection/trd.md) — precedent for the no-flag rollout, the test-placement conventions in §10, and the project-record scoping reused in §12.
