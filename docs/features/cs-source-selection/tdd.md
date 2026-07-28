# TDD Execution Report — Contentstack Source Selection (Content Map & Audit — Source panel)

- **Slug:** `cs-source-selection`
- **Inputs read:** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [cs-source-selection-test-cases.md](./cs-source-selection-test-cases.md)
- **Snyk precondition:** **waived by the user** on 2026-07-28 (proceeded without confirmation of a passing scan, at the user's explicit direction). Snyk was neither run nor invoked by this skill.
- **Package(s) touched:** `api/` · `ui/`
- **Run date:** 2026-07-28
- **Outcome:** **partial** — this feature has 51 automatable rows (→ 102 paired tests). This run completed five groups (**13 of 51 rows**) genuinely red→green (one pre-existing module confirmed, noted); the remaining groups are planned below and continue in subsequent runs. A partial report is a valid deliverable per the skill; each future run appends progress.

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

**Totals so far: 13 positive, 13 negative** (equal). `api/tests/unit/v3/{services,models,middlewares}/` and `ui/tests/unit/v3/utils/`.

### Remaining planned groups (not yet written — next runs)

Sequenced P0-first. Each row still gets a strict 1:1 pair.

| Group | Target unit(s) | TC rows | Notes |
|---|---|---|---|
| Upload/validate handler | `api/v3` upload controller + multer 413 | TC_SRC_029, 040, 041, 042 | EC-4 size cap |
| Modules endpoint | `api/v3` modules (file + stack) | TC_SRC_013, 044 | |
| Export/job/graph | `api/v3` export.service + status + graph endpoints | TC_SRC_035, 038, 039, 045, 046, 055 | in-memory job; mock CS for stack |
| UI stack/file/graph components | `ui/v3/components/source/*` | TC_SRC_001–004, 009–012, 017, 020–022, 025–027, 031, 052 | **first `ui/` component tests — new pattern (see below)** |

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

## Full-suite regression

Commands:
```
cd api && npx vitest run
cd ui  && npx vitest run
```
Actual output:
```
api:  Test Files  84 passed (84)   Tests  720 passed (720)   (698 prior + 22 new)
ui:   Test Files  24 passed (24)   Tests  350 passed (350)   (346 prior + 4 new)
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
- **Pending (future run):** the UI component-test group will introduce the first `ui/` `.test.tsx` (the repo currently has none) — flagged for team ratification when that group lands.

## Next step

Continue the remaining planned groups (P0 first), then **Playwright/e2e verification** — the remaining pipeline stage, not covered by this skill.
