# TRD: Contentstack Source Selection (Content Map & Audit — Source panel)

- **Slug:** `cs-source-selection`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** Ayush Sahu
- **Engineers:** TBD
- **Created:** 2026-07-28
- **Last updated:** 2026-07-28

## 1. Overview

The Source panel is built in the new **v3** stack: a self-contained `ui/v3` React surface and a **fully standalone** `api/v3` Express router. It provides cascading source selection (live Contentstack stack or uploaded export bundle), an **asynchronous** export/extract job, module scoping, and a persisted content-graph preview. Nothing is shared with v2 except the auth token contract (`app_token` JWT) and the underlying MongoDB.

See [prd.md §1](./prd.md) and [feature.md §1](./feature.md).

> **Note:** feature.md was updated (2026-07-28) to `/v3` + **fully standalone**, matching this TRD — `api/v3` imports nothing from `api/src`; it re-implements auth middleware, models, and Contentstack calls, and reuses only the shared `app_token` JWT secret and third-party Contentstack tooling. (The spec previously said `/v2` + "reuse services"; resolved.)

## 2. Scope

- **In scope:** `ui/v3` Source panel components + state; `api/v3` router, controllers, services, models, and auth middleware for source listing, upload/validate/extract, async export, graph, and source persistence; the persisted `source` document shape.
- **Out of scope:** Destination panel, field/content-type mapping, the step tracker, non-Contentstack connectors, running the actual migration (see [feature.md §5](./feature.md)). Also out of scope: the shared login flow (reused as-is) and the Phase 1–6 cookie migration ([../auth-httponly-cookie-migration/plan.md](../auth-httponly-cookie-migration/plan.md)).

## 3. Requirements traceability

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1 | TR-1 | Mode toggle |
| FR-1.2 | TR-1 | Retain per-mode state |
| FR-1.3 | TR-2 | Header + status badge |
| FR-2.1 / 2.2 / 2.3 | TR-3, TR-15 | Cascading dropdowns + list endpoints |
| FR-2.4 / 2.9 | TR-3, TR-6 | Ordered gating + submit gate |
| FR-2.5 | TR-4, TR-15 | Branch selector + branches endpoint |
| FR-2.6 / 2.7 | TR-5, TR-16 | Scope radio + module multi-select + counts endpoint |
| FR-2.8 | TR-6, TR-17 | Primary action → async export |
| FR-3.1 / 3.2 | TR-7 | Dropzone + file card |
| FR-3.3 / 3.8 / 3.9 | TR-8, TR-17 | Upload + validate + manifest; reject invalid; size cap |
| FR-3.4 / 3.5 / 3.6 | TR-9, TR-16 | File scope + module multi-select + forced dependency |
| FR-3.7 | TR-10 | Upload-another / extract actions + lock |
| FR-4.1 / 4.2 / 4.3 | TR-11, TR-18 | Empty state, stat tiles, node/edge graph + graph endpoint |
| FR-4.4 | TR-12 | Pan / zoom |
| FR-5.1 | TR-13 | `/v3` router, authed, standalone |
| FR-5.2 | TR-14 | Persist selection + graph summary |
| FR-5.3 | TR-15 | List regions/orgs/stacks/branches |
| FR-5.4 | TR-16 | Modules-with-counts |
| FR-5.5 | TR-17 | Async export job + upload/validate/extract |
| FR-5.6 | TR-18 | Graph data endpoint |

### Technical requirements

- **TR-1:** `ui/v3` Source component maintains two independent sub-states (stack, file) in the v3 store; the segmented control switches the rendered mode without discarding the other mode's in-memory state (FR-1.1, 1.2).
- **TR-2:** Render the Source header (name, meta line) and a status badge driven by source state (idle / running / ready / error) (FR-1.3).
- **TR-3:** Cascading Region→Org→Stack selects; each downstream select is disabled until its upstream value is set; values fetched from the list endpoints (FR-2.1–2.4).
- **TR-4:** Branch selector defaulting to `main`, changeable via a picker populated by the branches endpoint (FR-2.5).
- **TR-5:** Scope radio (whole/specific) and, for specific, a module multi-select with counts (FR-2.6, 2.7).
- **TR-6:** Primary action button with loading state, disabled until FR-2.9 gating passes; on click, starts the async export job (FR-2.8, 2.9).
- **TR-7:** Dropzone (drag/browse) + selected-file card with remove; client-side `.zip` + size pre-check (FR-3.1, 3.2).
- **TR-8:** Upload endpoint validates the bundle server-side, parses its manifest into module+count rows, rejects invalid/oversize with typed errors (FR-3.3, 3.8, 3.9).
- **TR-9:** File scope radio + module multi-select; dependency resolver auto-checks required modules, marks them `forced`, and blocks unchecking while a dependent is checked (FR-3.4–3.6).
- **TR-10:** File action row ("Upload another file" / extract) with a shared locked state during extract (FR-3.7).
- **TR-11:** Graph view: empty-state text pre-read; after read, stat tiles (5 counts) + dependency-ordered nodes with reference edges (FR-4.1–4.3).
- **TR-12:** Pan (drag) + zoom in/out/reset on the graph canvas (FR-4.4).
- **TR-13:** New `api/v3` router mounted at `/v3`, fully standalone (own middleware/models/services), every route behind v3 auth middleware (FR-5.1).
- **TR-14:** Persist the source selection and graph summary onto the v3 project document (FR-5.2).
- **TR-15:** Endpoints listing regions, orgs (per region), stacks (per org), branches (per stack) via the Contentstack Management API (FR-5.3).
- **TR-16:** Endpoint returning a source's modules with per-module counts (stack: from CS; file: from manifest) incl. dependency flags (FR-5.4).
- **TR-17:** Async export/extract: a start endpoint returns a `jobId`; a status endpoint reports progress; file upload uses multer (100 MB) → validate → extract (FR-5.5).
- **TR-18:** Endpoint returning the persisted/derived content graph (nodes, edges, 5 counts) for the project's source (FR-5.6).

## 4. Architecture

- **Components touched:** none in `api/src` or `ui/src` beyond the single router mount already added (`ui/src/.../router.tsx` → `/v3/*`). v2 is untouched.
- **New components:**
  - `ui/v3/pages/Migration` (Source step) + `ui/v3/components/source/*` — the panel UI (owner: FE).
  - `ui/v3/store/slice/source.slice.ts` — v3 source state (owner: FE).
  - `ui/v3/services/api/source.service.ts` — calls via `ui/v3/auth/apiClient` (owner: FE).
  - `api/v3/routes/source.routes.ts`, `controllers/source.controller.ts`, `services/source.service.ts`, `services/csManagement.service.ts` (CS Management API client), `services/export.service.ts` (async job), `models/*` (owner: BE).
  - `api/v3/middlewares/auth.middleware.ts` — standalone JWT check of the `app_token` header (own copy; validates the same secret).
- **Data flow (happy path — stack):**
  1. UI loads → `GET /v3/source/regions`; user picks region → `GET /v3/source/orgs` → org → `GET /v3/source/stacks` → stack → `GET /v3/source/branches`.
  2. (Optional) specific scope → `GET /v3/source/modules?...` for counts.
  3. User clicks start → `POST /v3/source/export` → `{ jobId }`.
  4. UI polls `GET /v3/source/export/:jobId` until `status=succeeded`.
  5. UI fetches `GET /v3/source/:projectId/graph`; selection + graph summary are persisted (TR-14).
- **Data flow (happy path — file):**
  1. User selects `.zip` → `POST /v3/source/upload` (multipart) → validate + parse manifest → `{ sourceId, manifest }`.
  2. (Optional) specific scope + dependency resolution (server-assisted or client from manifest).
  3. Extract → same async job/status/graph path as stack (steps 3–5 above).
- **Data flow (error path):** any list/export/upload failure returns a typed error (§6); UI clears loading/locked state, shows the mapped message (EC-1/3/4/5/6), and preserves the user's selection for retry (EC-6).
- **Concurrency / ordering constraints:** region→org→stack→branch strictly ordered (TR-3). Graph fetch only after job `succeeded`. Persistence write is last-write-wins for a single project (see TQ-3 for concurrent-edit handling, feature.md EC-9/Q-5).

## 5. Data model

- **DM-1:** **v3 Project `source` sub-document** (own v3 model; storage location — same `projects` collection vs. a v3-specific collection — is TQ-2). Shape (proposal, pending Destination sign-off, feature.md Q-6/DEP-7):
  ```
  source: {
    mode: 'stack' | 'file',
    stack?: { region, orgId, stackApiKey, branch, scope: 'whole'|'specific', selectedModules: string[] },
    file?:  { sourceId, fileName, sizeBytes, manifestSummary, scope: 'all'|'specific', selectedModules: string[] },
    graph?: { counts: { contentTypes, assets, entries, globalFields, references }, nodes: [...], edges: [...] },
    lastExport?: { jobId, status, startedAt, finishedAt, error? }
  }
  ```
  Migration: additive optional field on the v3 project document — no backfill (v3 projects are new).
- **DM-2:** **ContentGraph** — persisted inline at `source.graph` per the "persist graph summary" decision (prd §9 / feature.md Q-4). No separate table/collection. UC-4 restore reads this directly.
- **DM-3:** **SourceModule** — read model only (module `name`/`label`, `count`, `forced`/`requiredBy`). Not persisted; derived per request from CS or the file manifest.
- **Extracted file storage:** uploaded bundles are received in memory (multer) and extracted to a working dir under `api/v3` (mirrors v2's `migration-data`/`cmsMigrationData` convention). Retention/cleanup policy is TQ-4.

## 6. API contracts

All under `/v3`, all require the `app_token` header (TR-13). Paths are proposals resolving feature.md Q-7.

### API-1: `POST /v3/source/export`
- **Purpose:** start an async stack export (or file extract if `sourceId` given).
- **Auth:** valid `app_token`.
- **Request:** `{ projectId, mode:'stack'|'file', stack?:{region,orgId,stackApiKey,branch,scope,selectedModules[]}, file?:{sourceId,scope,selectedModules[]} }`
- **Response (202):** `{ jobId }`
- **Error cases:** 400 invalid selection · 401 unauthorized · 422 nothing-to-export.
- **Idempotency:** no (each call starts a job); a running job per project may be reused — TQ-3.
- **Realizes:** FR-5.5, TR-17.

### API-2: `GET /v3/source/export/:jobId`
- **Purpose:** poll job status/progress.
- **Response (200):** `{ jobId, status:'queued'|'running'|'succeeded'|'failed', progress?:number, error?:{code,message} }`
- **Realizes:** FR-5.5, TR-17.

### API-3: `POST /v3/source/upload`
- **Purpose:** upload + validate a `.zip` export bundle; parse manifest.
- **Auth:** valid `app_token`. **Body:** `multipart/form-data` (`file`), multer memory, 100 MB cap.
- **Response (200):** `{ sourceId, fileName, sizeBytes, manifest:[{name,count}] }`
- **Error cases:** 400 not-a-valid-bundle (EC-3) · 413 too-large (EC-4) · 401.
- **Realizes:** FR-3.3, FR-3.8, FR-3.9, FR-5.5, TR-8.

### API-4: source listing (feeds cascading dropdowns)
- `GET /v3/source/regions` → `{ regions:[{uid,name}] }`
- `GET /v3/source/orgs?region=` → `{ orgs:[{uid,name}] }`
- `GET /v3/source/stacks?orgId=` → `{ stacks:[{apiKey,name}] }`
- `GET /v3/source/branches?stackApiKey=` → `{ branches:[{uid,name}] }` (default `main`)
- **Realizes:** FR-5.3, TR-15.

### API-5: `GET /v3/source/modules`
- **Purpose:** modules + counts for scope selection. **Query:** stack (`orgId,stackApiKey,branch`) or file (`sourceId`).
- **Response (200):** `{ modules:[{name,count,forced?,requiredBy?}] }`
- **Realizes:** FR-5.4, TR-16.

### API-6: `GET /v3/source/:projectId/graph`
- **Purpose:** persisted/derived content graph.
- **Response (200):** `{ counts:{contentTypes,assets,entries,globalFields,references}, nodes:[...], edges:[...] }`
- **Error cases:** 404 no-graph-yet · 401.
- **Realizes:** FR-5.6, TR-18.

### API-7: `PUT /v3/org/:orgId/project/:projectId/source`
- **Purpose:** persist the source selection (mode/stack/file/scope/modules).
- **Request:** the `source` selection sub-object (DM-1, minus server-owned `graph`/`lastExport`).
- **Response (200):** `{ source }`
- **Realizes:** FR-5.2, TR-14; supports UC-4 (read via the project GET).

### Events
- **EVT-1:** export/extract progress MAY be streamed over v3's OWN Socket.IO channel (same pattern as `server.ts`, not the v2 channel) — decision TQ-5. If used: `source.export.progress` — payload `{ jobId, status, progress }` — emitted during the job — consumed by the UI poller/socket — at-most-once. Default (this TRD): HTTP polling via API-2, no new event.

## 7. Integration points

- **INT-1 (DEP-1):** v3 Express app + **own** v3 auth middleware + async-router util — we own it — realizes DEP-1. (Standalone: not the `api/src` versions.)
- **INT-2 (DEP-2):** **Contentstack Management API** (regions/orgs/stacks/branches/modules) — we call — contract owner: Contentstack — fallback: surface 502/timeout as EC-5/EC-6 — realizes DEP-2. (Re-implemented in `api/v3`, not via `org.service.ts`.)
- **INT-3 (DEP-3):** **Contentstack export tooling / CLI or SDK** (stack export, file extract) — we call — contract owner: Contentstack — fallback: job → `failed` with error — realizes DEP-3. (Own v3 wrapper, not `runCli.service.ts`.)
- **INT-4 (DEP-4):** **MongoDB** (v3 project persistence) — we call — own v3 model layer — realizes DEP-4.
- **INT-5 (DEP-5):** **multer** (memory storage, 100 MB) for API-3 — we own — realizes DEP-5.
- **INT-6 (DEP-6):** **design-system components** (`Select`, `Input`, `Button`, `Badge`) consumed by `ui/v3` — we call — realizes DEP-6.
- **INT-7 (DEP-7):** **v3 Destination panel** — reads the persisted `source` (DM-1) — bidirectional schema contract — owner: v3 wizard — realizes DEP-7; schema sign-off is TQ-1.

## 8. Technology choices

- **TC-1:** **Async job + polling** for export/extract — chosen because large stacks/files risk request timeouts (feature.md R-1). Alternatives: synchronous request (rejected — timeout risk), Socket.IO streaming (deferred to TQ-5 — added complexity, polling is sufficient for v1).
- **TC-2:** **Persist graph summary** on the project — chosen for instant UC-4 restore and offline-safety. Alternatives: re-fetch/re-derive (rejected — slow, needs the source live again), counts-only (rejected — loses node/edge restore).
- **TC-3:** **Fully standalone `api/v3`** — chosen per current direction (greenfield, no coupling to v2). Alternatives: reuse `api/src` services (rejected — v3 shares no v2 code); shared-infra-only (rejected in favor of full independence).
- **TC-4:** **Gated by `/v3` route, no feature flag** — chosen: self-hosted tool with no flag system. Alternatives: env flag (deferred, prd §9), runtime flag system (rejected — none exists).

## 9. Sequencing & phases

- **Phase 1 (backend spine):** TR-13, TR-15, TR-17, TR-8, TR-14 — unlocks source listing, upload/validate, async export, and persistence (API reachable, testable without UI).
- **Phase 2 (UI stack path):** TR-1, TR-3, TR-4, TR-6 — unlocks UC-1 end-to-end.
- **Phase 3 (UI file path):** TR-7, TR-9, TR-10, TR-16 — unlocks UC-2 + scoping (TR-5).
- **Phase 4 (graph + resume):** TR-11, TR-12, TR-18, TR-2 — unlocks UC-3, UC-4.

## 10. Testing strategy

Test-cases skill generates detailed cases from feature.md ACs; this is the placement plan.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit (component) | `ui/v3` source component tests | Initial disabled/gating state |
| AC-1.2 | integration | `api/v3` + component | Org list on region select |
| AC-1.3 | e2e | v3 migration suite | Stack export → graph render (mock CS + job) |
| AC-1.4 | integration | `api/v3` source persistence | Persist + reload (with AC-4.1) |
| AC-1.5 | unit (component) | source component | Branch change reflected in request |
| AC-1.6 | unit (component) | source component | Specific-module gate |
| AC-1.7 | integration | `api/v3` export | Scoped-to-selected-modules payload |
| AC-2.1 | unit (component) | file-mode component | Dropzone + disabled extract |
| AC-2.2 | unit (component) | file-mode component | File card fields + remove |
| AC-2.3 | integration | `api/v3` upload/validate | Manifest render on valid bundle (fixture zip) |
| AC-2.4 | e2e | v3 migration suite | File extract → graph + persist |
| AC-2.5 | unit + integration | dependency resolver (`api/v3` + component) | Forced "required by entries" |
| AC-2.6 | unit (component) | file-mode component | Remove pre-validate |
| AC-2.7 | unit (component) | file-mode component | Upload-another resets |
| AC-3.1 | unit (component) | graph component | Empty-state text |
| AC-3.2 | integration | graph endpoint + component | 5 counts equal extract result (G-4) |
| AC-3.3 | unit (component) | graph component | Pan/zoom/reset |
| AC-4.1 | integration | `api/v3` persistence + component | Full restore after reload |

- **Fixtures / test data:** small synthetic Contentstack export `.zip` fixtures (valid, invalid, oversized, empty) — no PII, no real tokens. Mock the CS Management API and export tooling (INT-2/INT-3).
- **Test-only hook:** a seed to pre-persist a `source` for UC-4/AC-4.1 without running a full export.
- **CI signal:** `api/v3` vitest unit+integration green; `ui/v3` component tests green (extends existing `ui` vitest config `include` to cover `v3`).

## 11. Observability

- **Logs (feature.md NFR-7):** export/extract start, success, failure with `projectId`, `stackApiKey` (or `sourceId`), `jobId` — **never** log `app_token`, stack management tokens, or file contents. Level: info (start/success), error (failure). Via the existing structured logger pattern (own v3 instance).
- **Metrics:** counters — `v3_source_export_started`, `_succeeded`, `_failed`; histogram — export/extract duration (labels: `mode`, `scope`). (Wiring TQ — no metrics backend confirmed.)
- **Alerts:** none for v1 (self-hosted). Elevated export-failure rate → future.
- **Dashboards:** none for v1.
- **Traces:** none.

## 12. Security

- **Auth / authz:** every `/v3` route behind the standalone v3 auth middleware verifying the `app_token` JWT (same `APP_TOKEN_KEY` secret as v2). No new scopes.
- **PII / secrets:** stack management tokens / API keys entered for the source are secrets — never logged (NFR-3), not returned in list responses, transmitted only over the authed channel. Uploaded bundle contents stay server-side.
- **Threat model deltas:** file upload (API-3) is new attack surface — enforce `.zip` type + 100 MB cap server-side (not just client), validate manifest before extraction, guard against zip-slip/path traversal during extract, and cap decompressed size (zip-bomb) — TRR-4.
- **Secret handling:** `APP_TOKEN_KEY` via env (unchanged). Any source credentials are request-scoped, not persisted in plaintext beyond what's needed (persisting a stack API key in `source.stack.stackApiKey` needs a decision — TQ-6).
- **Compliance:** none new (self-hosted).

## 13. Performance

References feature.md NFR-1/NFR-2 and EC-10.

- **Expected load:** low concurrency (self-hosted, few operators). Dataset size varies wildly by stack/bundle.
- **Hot paths:** export/extract (offloaded to async job — TC-1); graph rendering for large graphs (EC-10) — virtualize/limit initial nodes if needed.
- **Caching:** region/org/stack/branch lists MAY be cached briefly per session (feature.md R-2) — keys by `orgId`/`stackApiKey`, short TTL; invalidate on explicit refresh. v1 default: no cache.
- **Load-test plan:** exercise export with a large synthetic stack/bundle to confirm the job model avoids timeouts before GA. Concrete budgets: TQ-7 (feature.md Q-2/NFR-1/NFR-2).

## 14. Rollout / feature flag

- **Flag name:** none (prd §9). Feature is gated by the existence of the `/v3` UI routes + `api/v3` endpoints.
- **Default state at merge:** `api/v3` mounted but only reachable at `/v3/*`; v2 flow unchanged and default.
- **Gated code paths:** everything under `ui/v3/**` and `api/v3/**` plus the single `/v3/*` route in `ui/src/.../router.tsx`.
- **Config surface:** optional future `VITE_ENABLE_V3` env to hide the entry point (prd §9 alt) — not in v1.
- **Per-stage flip:** manual — link/expose the `/v3` entry to progressively more users.

## 15. Rollback plan

- **How to disable:** remove/stop exposing the `/v3` UI entry point and/or don't deploy the `api/v3` mount. Full revert = delete `ui/v3` + `api/v3` and revert the one-line `/v3/*` route + the tsconfig alias/include.
- **Data cleanup on rollback:** the `source` sub-document (DM-1) is additive and optional on v3 project records; leaving it is harmless. Extracted-file working dirs should be cleaned (TQ-4). No v2 data is touched.
- **What breaks if we rollback mid-flow:** a user mid-export in v3 loses the in-flight job (jobs are not durable across a v3 teardown) and any un-persisted selection; because v3 is isolated, **nothing in v2 breaks**. Persisted v3 `source` docs become dormant until v3 returns.
- **Rollback SLA:** minutes — it's an isolated surface behind one route; no migration to reverse.

## 16. Risks & mitigations (technical)

- **TRR-1:** Large export/extract exceeds wait/timeouts — med/high — async job + polling (TC-1), progress in UI, cancel/retry (EC-6).
- **TRR-2:** Cascading dropdown round-trips feel slow — med/med — optional short-TTL caching (§13), disable-until-ready UX.
- **TRR-3:** Forced-dependency logic (AC-2.5) subtly wrong → invalid scoped subset — med/med — resolver unit + integration tests, validate against real bundles.
- **TRR-4:** Malicious/oversized zip (zip-slip, zip-bomb) on upload — med/high — server-side type+size checks, safe extraction, decompressed-size cap (§12).
- **TRR-5:** Persisted `source` schema drifts from Destination consumer — med/high — freeze DM-1 with Destination owners before build (TQ-1).
- **TRR-6:** Fully-standalone `api/v3` duplicates model/CS logic → divergence/maintenance cost — med/med — accepted per TC-3; keep v3 surface minimal and well-tested.

## 17. Task breakdown

- **T-1:** Scaffold `api/v3` router + standalone auth middleware + mount at `/v3` — realizes TR-13 — S. *(next task after this TRD)*
- **T-2:** v3 project model + `source` sub-document (DM-1) + persistence endpoint (API-7) — realizes TR-14 — M — depends on T-1.
- **T-3:** CS Management client + list endpoints (API-4) — realizes TR-15 — M — depends on T-1.
- **T-4:** Upload + validate + manifest (API-3) + modules endpoint (API-5) — realizes TR-8, TR-16 — M — depends on T-1.
- **T-5:** Async export/extract job + status (API-1/API-2) + graph build + graph endpoint (API-6) — realizes TR-17, TR-18 — L — depends on T-2, T-3, T-4.
- **T-6:** `ui/v3` source slice + service + mode toggle + header/badge — realizes TR-1, TR-2 — M — depends on T-1.
- **T-7:** Stack path UI (cascading selects, branch, scope, action) — realizes TR-3, TR-4, TR-5, TR-6 — L — depends on T-3, T-6.
- **T-8:** File path UI (dropzone, card, scope, forced deps, actions) — realizes TR-7, TR-9, TR-10 — L — depends on T-4, T-6.
- **T-9:** Graph view (empty state, stat tiles, node/edge render, pan/zoom) — realizes TR-11, TR-12 — L — depends on T-5, T-6.
- **T-10:** Test suites (fixtures, mocks for INT-2/INT-3, AC placement per §10) — realizes all TRs — M — parallel with T-5..T-9.

## 18. Open questions

- **TQ-1:** Freeze the persisted `source` schema (DM-1) with the v3 Destination-panel owners. — owner: Ayush + Destination owner — needed by: T-2. (feature.md Q-6, DEP-7)
- **TQ-2:** Does `api/v3` use the same `projects` collection or a v3-specific one? — owner: Eng — needed by: T-2.
- **TQ-3:** Concurrent-edit / running-job handling per project (reuse in-flight job? last-write-wins on persist?). — owner: Eng — needed by: T-5. (feature.md Q-5, EC-9)
- **TQ-4:** Extracted-file working-dir retention + cleanup policy (incl. on rollback). — owner: Eng — needed by: T-4.
- **TQ-5:** Progress via HTTP polling (default) vs. a v3-owned Socket.IO channel (EVT-1). — owner: Eng — needed by: T-5.
- **TQ-6:** Is the stack management token/API key persisted (and if so, encrypted) or request-scoped only? — owner: Eng/Security — needed by: T-2.
- **TQ-7:** Concrete perf budgets: dropdown p95, export/extract duration, max graph size. — owner: Eng — needed by: GA. (feature.md Q-2, NFR-1/2, EC-10)
- **TQ-8 (CLOSED):** feature.md updated to `/v3` + fully-standalone (2026-07-28); all three docs now agree.

## 19. References

- [feature.md](./feature.md) · [prd.md](./prd.md)
- [../auth-httponly-cookie-migration/plan.md](../auth-httponly-cookie-migration/plan.md) — shared auth token contract this feature depends on.
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — design, page "Content Map and Audit", Source panel (reference only, not mirrored locally).
- Existing patterns referenced (NOT reused by standalone v3, but informative): `api/src/server.ts`, `api/src/routes/{org,projects,migration}.routes.ts`, `api/src/middlewares/auth.middleware.ts`.
