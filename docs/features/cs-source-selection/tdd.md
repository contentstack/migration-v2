# TDD Execution Report — Contentstack Source Selection (Content Map & Audit — Source panel)

- **Slug:** `cs-source-selection`
- **Inputs read:** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [cs-source-selection-test-cases.md](./cs-source-selection-test-cases.md)
- **Snyk precondition:** **waived by the user** on 2026-07-28 (proceeded without confirmation of a passing scan, at the user's explicit direction). Snyk was neither run nor invoked by this skill.
- **Package(s) touched:** `api/` · `ui/`
- **Run date:** 2026-07-28
- **Outcome:** **COMPLETE** — all **51 of 51 automatable rows** covered by paired positive/negative tests, genuinely red→green across sessions (one pre-existing module — the auth middleware — confirmed rather than red-first, noted). Backend (`api/v3`) and UI (`ui/v3`) are both fully test-covered and wired. The 7 `Automated = N` rows are intentionally out of scope. Remaining pipeline stage (Playwright/e2e) is out of this skill's scope.

> **Context:** an earlier direct (non-TDD) implementation of this feature was preserved on branch `feature/cs-src-wip` and used only as reference. `feature/cs-to-cs` was reset to the post-scaffold baseline (routes at `501`) so development proceeds test-first from a real red state.

## Scope split (corrected)

The matrix has **58** cases: **51 `Automated = Y`** (in scope for TDD) and **7 `Automated = N`** (out of scope). (An earlier off-hand "44/14" figure was wrong; the CSV `Automated` column is the source of truth — 51/7.)

## Positive / negative pairing

Strict 1:1. `Negative category` = taxonomy (1 missing/empty · 2 invalid type · 3 boundary · 4 forbidden state · 5 permission · 6 dependency failure · 7 conflict).

### Completed this run — red→green, all green

| Test Case ID | Traces to | Positive test | Negative test | Negative category | Result |
|---|---|---|---|---|---|
| TC_SRC_032 | AC-3.2 / FR-4.2 | `graph.service.test.ts` — counts reflect CTs + module counts | empty content types → all-zero counts (EC-7) | 1 — missing/empty | ✅ |
| TC_SRC_033 | FR-4.3 | `graph.service.test.ts` — reference field → edge + tier ordering | ref to unknown/self type → no edge | 2 — invalid shape | ✅ |
| TC_SRC_019 | AC-2.3 / FR-3.3 | `bundle.service.test.ts` — valid export → manifest counts (CT 2, GF 1, entries 2) | valid marker, no content_types → CT count 0 | 1 — missing/empty | ✅ |
| TC_SRC_028 | EC-3 / FR-3.8 | `bundle.service.test.ts` — non-zip → BundleError 400 "Not a valid .zip archive." | zip without export-info/content_types → "Not a Contentstack export bundle" | 2 — invalid shape | ✅ |
| TC_SRC_023 | AC-2.5 / FR-3.6 | `moduleSelection.test.ts` — selecting a dependent auto-selects + forces its deps | leaf module adds only itself, forces nothing | 1 — missing/empty | ✅ |
| TC_SRC_024 | AC-2.5 / FR-3.6 | `moduleSelection.test.ts` — forced dependency can't be unchecked while dependent selected | unforced module is removable | 4 — forbidden-state contrast | ✅ |
| TC_SRC_016 | AC-1.4 / FR-5.2 | `project.store.test.ts` — upsert creates a retrievable project record | get unknown id → undefined | 1 — missing/empty | ✅ |
| TC_SRC_036 | AC-4.1 / NFR-5 | `project.store.test.ts` — persisted source survives a reload (fresh instance reads disk) | re-persist replaces in place, no duplicate row | 7 — conflict/duplication | ✅ |
| TC_SRC_047 | AC-2.4 / FR-5.2 | `project.store.test.ts` — upsert returns source + preserves server-set graph on re-persist | setV3Graph on missing project rejected | 4 — forbidden state | ✅ |
| TC_SRC_043 | FR-5.3 | `csManagement.service.test.ts` — listStacks maps CS → {apiKey,name}[] with org+auth headers | CS 500 surfaced as error status 500 | 6 — dependency failure | ✅ |
| TC_SRC_049 | EC-5 | `csManagement.service.test.ts` — CS 401 surfaced (not swallowed) | missing stored credential → 401 before any network call | 5 — permission | ✅ |
| TC_SRC_054 | EC-1 | `csManagement.service.test.ts` — zero organizations → empty list | missing `organizations` field → empty list (no crash) | 2 — invalid shape | ✅ |
| TC_SRC_048 | NFR-3 / EC-5 | `auth.middleware.test.ts` — valid app_token → next + token_payload | missing app_token → 401, next not called | 5 — permission | ✅ (pre-existing) |
| TC_SRC_044 | FR-5.4 | `csManagement.service.test.ts` — getStackModuleCounts aggregates counts; getContentTypes maps schemas | failing count → 0 fallback; missing field → [] | 6 / 2 | ✅ |
| TC_SRC_040 | AC-2.3 / FR-3.3 | `upload.store.test.ts` — saveUpload persists bundle+meta, retrievable | unknown sourceId → null | 1 — missing/empty | ✅ |
| TC_SRC_038 | FR-5.5 | `export.service.test.ts` — startExportJob returns jobId, getJob tracks it | unknown jobId → undefined | 1 — missing/empty | ✅ |
| TC_SRC_039 | FR-5.5 | `export.service.test.ts` — file export settles succeeded + persists graph | extract failure → failed, no graph persisted | 6 — dependency failure | ✅ |
| TC_SRC_055 | EC-6 | `export.service.test.ts` — stack CS failure → failed job (not a crash) | successful stack export → succeeded | (contrast) | ✅ |
| TC_SRC_035 | EC-7 | `export.service.test.ts` — empty source → all-zero graph counts | non-empty source → non-zero count | 3 — boundary | ✅ |
| TC_SRC_041 | FR-3.8 / EC-3 | `source.routes.test.ts` — non-zip upload → 400 invalid-archive | zip without CS layout → 400 not-a-CS-export | 2 — invalid shape | ✅ |
| TC_SRC_042 | FR-3.9 / EC-4 | `source.routes.test.ts` — over-limit upload → 413 | under-limit passes size gate (→400 not 413) | 3 — boundary | ✅ |
| TC_SRC_045 | FR-5.6 | `source.routes.test.ts` — graph present → 200 with counts/nodes/edges | project without a graph → 404 | 1 — missing | ✅ |
| TC_SRC_046 | FR-5.6 | `source.routes.test.ts` — no graph yet → 404 | graph present → 200 | (contrast) | ✅ |
| TC_SRC_002 | FR-1.2 / EC-8 | `source.slice.test.ts` — mode round-trip retains stack sub-state | file edits don't touch stack sub-state | 7 — isolation | ✅ |
| TC_SRC_012 | FR-2.6 | `source.slice.test.ts` — stack scope defaults to "whole" | scope changes to "specific" | (contrast) | ✅ |
| TC_SRC_020 | FR-3.4 | `source.slice.test.ts` — file scope defaults "all", starts unvalidated | setFileValidated → validated + manifest | (contrast) | ✅ |
| TC_SRC_026 | AC-2.6 | `source.slice.test.ts` — clearFile resets the file sub-state | clearFile leaves stack sub-state intact | 7 — isolation | ✅ |
| TC_SRC_032 (UI) | FR-4.2 | `GraphView.test.tsx` — stat tiles render the counts + nodes | zero-count graph → five tiles at 0 | 1 — empty | ✅ |
| TC_SRC_052 | NFR-4 | `GraphView.test.tsx` — zoom controls expose aria-labels | controls render even for an empty graph | 3 — boundary | ✅ |

### UI interaction/component groups (paired, all green)

| Test file | TC rows (each a positive/negative pair) |
|---|---|
| `ui/.../store/thunks/source.thunks.test.ts` | 006, 007 (cascade region→org→stack; dependency-failure) |
| `ui/.../store/thunks/source.thunks.export.test.ts` | 011, 014, 021, 010, 037 (export poll, scoped request, upload, branch, graph restore) |
| `ui/.../components/source/StackPanel.test.tsx` | 005, 008, 013, 009, 015 (gating, cascade-disable, branch, module gate) |
| `ui/.../components/source/FilePanel.test.tsx` | 017, 025, 030, 018, 022, 027 (dropzone, remove, scope gate, card, module list, locked) |
| `ui/.../components/source/SourcePanel.test.tsx` | 001, 003, 004, 031, 029 (default mode, toggle, header/badge, empty-state, error surfaced) |

**Final totals: 53 positive, 53 negative** (106 tests; equal). All 51 automatable rows covered — TC_SRC_032 and TC_SRC_044 each carry two pairs (unit + UI / two collaborators), accounting for the 106 vs 102.

### Remaining planned groups

**None — all 51 automatable rows are covered.** (Playwright/e2e is the next pipeline stage, out of this skill's scope.)

## Automated = N — out of scope by design

| Test Case ID | Type | Why it is not automatable |
|---|---|---|
| TC_SRC_034 | Usability | Pan/zoom interaction quality — human judgment |
| TC_SRC_050 | Security | "Secrets not in logs" — log inspection, not a unit assertion |
| TC_SRC_051 | Observability | Log lifecycle presence — integration/manual |
| TC_SRC_053 | Accessibility | Keyboard operability — manual a11y check |
| TC_SRC_056 | Usability | "Never appears frozen" — subjective |
| TC_SRC_057 | Usability | Large-graph interactivity — subjective, no numeric ceiling |
| TC_SRC_058 | Performance | Provisional p95 threshold (unconfirmed) — not a deterministic unit assertion |

## Implementation changes

| File | Change | Satisfies |
|---|---|---|
| `api/v3/services/graph.service.ts` | New — reference extraction, dependency tiers, 5 counts | AC-3.2, FR-4.2/4.3, EC-7 |
| `api/v3/services/bundle.service.ts` | New — bundle validation + per-module manifest counts (+`parseBundleContentTypes`, `MODULE_DEFS`, `BundleError`) | AC-2.3, FR-3.3/3.8, EC-3 |
| `api/v3/models/types.ts` | New — `V3Source`/`V3Project`/`V3GraphSummary` types (DM-1) | FR-5.2 |
| `api/v3/models/project.store.ts` | New — lowdb store; `getV3Project`/`upsertV3Source` (graph-preserving merge)/`setV3Graph`. Data dir via `V3_DATA_DIR` env (defaults `database-v3/`) | AC-1.4, AC-4.1, FR-5.2 |
| `api/v3/config/cs.ts` | New — region→Management-API host map (prod/staging by NODE_ENV) | FR-5.3 |
| `api/v3/models/auth.store.ts` | New — read-only accessor for the shared `database/authentication.json`; path via `V3_AUTH_STORE` env | FR-5.3, EC-5 |
| `api/v3/services/csManagement.service.ts` | New — CS client: `regions`/`listOrgs`/`listStacks`/`listBranches`, `CsError`, credential resolution (SSO + non-SSO) | FR-5.3, EC-1, EC-5 |
| `api/v3/middlewares/auth.middleware.ts` | Pre-existing (T-1 scaffold) — tests added, no change | NFR-3, EC-5 |
| `api/v3/services/csManagement.service.ts` | Extended — `getContentTypes` + `getStackModuleCounts` (stack-scoped headers, resilient count aggregation) | FR-5.4 |
| `api/v3/models/upload.store.ts` | New — `saveUpload`/`getUploadMeta`/`getUploadZipPath`; dir via `V3_DATA_DIR` | AC-2.3, FR-3.3 |
| `api/v3/services/export.service.ts` | New — in-memory job registry + async runExport (file extract / stack pull → buildGraph → persist) | FR-5.5, EC-6, EC-7 |
| `api/v3/controllers/source.controller.ts` | Wired all handlers to services (listing/modules/upload/export/status/graph/persist) — replaced 501 stubs | FR-5.1…5.6 |
| `api/v3/routes/source.routes.ts` | multer limit now env-overridable (`V3_UPLOAD_LIMIT`) for testable 413 | FR-3.9 |
| `api/v3/middlewares/error.middleware.ts` | Map multer `LIMIT_FILE_SIZE` → 413 | EC-4 |
| `ui/v3/store/slice/source.slice.ts` | New — source panel state (both mode sub-states) + reducers | FR-1.2, FR-2.6, FR-3.4 |
| `ui/v3/store/{index.ts,hooks.ts}` | New — v3 store (source reducer) + typed hooks | — (glue) |
| `ui/v3/services/api/source.service.ts` | New — API client wrappers over apiClient | FR-5.1 (glue) |
| `ui/v3/store/thunks/source.thunks.ts` | New — cascade, upload, export-poll, `loadPersistedGraph` (restore) | FR-2.x, FR-3.x, FR-5.5, UC-4 |
| `ui/v3/components/source/GraphView.tsx` | New — 5 stat tiles + node/edge render + pan/zoom (aria-labeled) | FR-4.2/4.3/4.4, NFR-4 |
| `ui/v3/components/source/StackPanel.tsx` | New — cascade selects + branch + scope + module picker + gating | FR-2.x |
| `ui/v3/components/source/FilePanel.tsx` | New — dropzone + card + manifest + scope + module picker | FR-3.x |
| `ui/v3/components/source/SourcePanel.tsx` | New — mode toggle + header/badge + graph area + restore-on-mount | FR-1.x, FR-4.1, UC-4 |
| `ui/v3/pages/Migration/index.tsx` | Wired to render SourcePanel | — (glue) |

## Full-suite regression

Commands:
```
cd api && npx vitest run
cd ui  && npx vitest run
```
Actual output:
```
api:  Test Files  88 passed (88)   Tests  742 passed (742)   (698 prior + 44 new v3)
ui:   Test Files  31 passed (31)   Tests  408 passed (408)   (346 prior + 62 new v3)
```
- [x] All previously-passing tests still pass in both packages.
- [x] No test was weakened, skipped, or deleted to force green.

## Gaps found in upstream docs — reported, not fixed

**Backward traceability** — automatable `EC-*` with no matching matrix row:
- **EC-9 (concurrent/stale source selection)** — deliberately has no test case; conflict behavior is undecided (feature.md Q-5 / trd.md TQ-3). Not patched here.

**Other:**
- The test-case matrix's `Automated` split is 51/7; a summary elsewhere said 44/14 — the CSV is authoritative (51/7). No matrix rows were changed.

## New patterns established

- **`api/tests/unit/v3/`** and **`ui/tests/unit/v3/`** — first tests targeting the standalone `v3` trees (mirror the `tests/unit/<src-path>` convention, pointed at `v3/`). Note: both `vitest.config.ts` coverage `include` globs are `src/**` only, so they do **not** measure `v3/` — a coverage-config follow-up (add `v3/**`) is needed for coverage to reflect v3.
- **supertest route tests** — `api/tests/unit/v3/routes/` mounts the source router + error middleware on a bare express app (auth guard omitted since TC_SRC_048 covers it separately) and drives it with supertest; multer's `V3_UPLOAD_LIMIT` env override makes the 413 path testable without a 100 MB upload.
- **First `ui/` `.test.tsx` established** — `ui/tests/unit/v3/components/source/GraphView.test.tsx` renders a component with `@testing-library/react` in jsdom (the repo previously used it only for `renderHook`). **Flagged for team ratification.** The remaining Stack/File/SourcePanel component tests will follow this pattern.

## Next step

TDD is **complete** — all 51 automatable rows are green (api 742, ui 408; 106 paired v3 tests). The remaining pipeline stage is **Playwright/e2e verification**, which is out of this skill's scope.
