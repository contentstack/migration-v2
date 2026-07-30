# Contentstack Source Selection — Implementation & QA Report

**Feature:** Content Map & Audit — Source panel (Contentstack-to-Contentstack migration, Step 3 of 7)
**Feature slug:** `cs-source-selection`
**Branch:** `feature/cs-to-cs`
**Author:** Ayush Sahu
**Report period:** 2026-07-28 – 2026-07-30
**Status:** Feature-complete and test-covered; pending Playwright/e2e sign-off (see [Next Steps](#12-next-steps))

---

## 1. Executive Summary

The Source panel is the first step of the Contentstack-to-Contentstack migration wizard where a user picks what they are migrating *from* — either a **live Contentstack stack** (Region → Organization → Stack → Branch) or an **uploaded export bundle** (`.zip`). The feature was built end-to-end through a formal spec → PRD/TRD → test-case → TDD pipeline, resulting in:

- A standalone `api/v3` backend (new router, own services/models, mounted under `/v3`) and a standalone `ui/v3` frontend tree.
- A 58-row test-case matrix, of which **51 rows were automated** as **106 strictly paired positive/negative unit tests** (53 positive, 53 negative), taken genuinely red → green.
- Full regression suites currently passing: **API 788/788 tests (90 files)**, **UI 455/455 tests (33 files)**.
- Two live UX/functional defects found and fixed after the initial TDD pass (region/login handling, layout clipping, graph controls), plus one theming defect found and fixed in this reporting period (native dropdown chrome).

This document consolidates the specification, the test-case matrix, the implementation, and — per request — a full account of the errors and obstacles hit along the way and how each was resolved.

---

## 2. Background & Problem Statement

Contentstack-to-Contentstack migration previously had no first-class "pick your source" experience. Users could not, in one place: choose between a live stack and an export bundle, scope the migration to specific modules, or preview the shape of the content before committing. This forced guesswork, over-migration of entire stacks, and late discovery of missing/mismatched content types.

The Source panel closes this gap by making the source explicit, scoped, and previewable — via a rendered content graph — before any downstream field mapping begins.

**Primary persona:** Migration operator (a Contentstack developer/solutions engineer running the migration).
**Secondary persona:** Partner/implementation consultant, typically working from a handed-off export file rather than direct org access.

---

## 3. Scope

### In scope
- **From a stack:** Region → Organization → Stack → Branch cascade, whole-stack or specific-module scoping, live export.
- **From a file:** `.zip` export bundle upload, manifest validation, whole-file or specific-module scoping.
- Content graph preview (node/edge rendering in dependency order, five entity-count stat tiles).
- Persistence of the source selection to the project record, restored on reload.
- New `api/v3` endpoints for regions/orgs/stacks/branches, modules, upload, export/job polling, graph retrieval, and source persistence.

### Out of scope
- The Destination panel (target region/org/stack, import auth, language mapping).
- Field/content-type mapping (the next wizard step).
- The shared step-tracker chrome.
- Non-Contentstack source connectors (Contentful, Drupal, AEM, Sitecore, WordPress).
- Actually running the migration/import.
- Creating/editing source stacks.

---

## 4. Development Approach

Work followed a four-stage pipeline, each stage gated on the previous one's output:

| Stage | Artifact | Outcome |
|---|---|---|
| 1. Feature spec | `feature.md` | Use cases, ACs, edge cases, open questions locked with stakeholder (2026-07-28) |
| 2. PRD/TRD | `prd.md`, `trd.md` | Product requirements + technical design (data model, API contract, NFRs) |
| 3. Test-case matrix | `cs-source-selection-test-cases.{md,csv,html}` | 58 rows derived from PRD/TRD + spec ACs only — **no implementation was referenced while writing test cases**, to keep them an independent oracle |
| 4. TDD | `tdd.md` | Paired positive/negative unit tests written first (red), then implementation until green |

**Key process decision:** an earlier, non-TDD draft implementation existed on a scratch branch (`feature/cs-src-wip`) from exploratory work. Before starting formal TDD, `feature/cs-to-cs` was **deliberately reset to the post-scaffold baseline** (routes returning `501`) so that development proceeded from a genuine red state rather than retrofitting tests onto code that already worked. The scratch branch was kept only as a reference, never merged.

---

## 5. Architecture & Implementation

### Backend — `api/v3` (fully standalone, shares no code with the v2 API)

| File | Responsibility |
|---|---|
| `services/graph.service.ts` | Reference extraction, dependency-tier ordering, the five entity counts |
| `services/bundle.service.ts` | Export-bundle validation + per-module manifest counts (`BundleError`, `MODULE_DEFS`) |
| `models/types.ts` | `V3Source` / `V3Project` / `V3GraphSummary` types |
| `models/project.store.ts` | lowdb-backed project store; graph-preserving upsert of the source selection |
| `config/cs.ts` | Region → Contentstack Management-API host map |
| `models/auth.store.ts` | Read-only accessor over the shared `database/authentication.json` |
| `services/csManagement.service.ts` | Contentstack client — regions/orgs/stacks/branches/content types/module counts, credential resolution (SSO + non-SSO) |
| `middlewares/auth.middleware.ts` | `app_token` guard (pre-existing scaffold; test coverage added) |
| `models/upload.store.ts` | Persists uploaded bundles + metadata |
| `services/export.service.ts` | In-memory job registry; async export/extract → `buildGraph` → persist |
| `controllers/source.controller.ts` | Wires all of the above to HTTP handlers (replaced the original `501` stubs) |
| `routes/source.routes.ts` | Route table; multer upload limit made env-overridable for deterministic 413 testing |
| `middlewares/error.middleware.ts` | Maps multer's `LIMIT_FILE_SIZE` to a 413 response |

### Frontend — `ui/v3`

| File | Responsibility |
|---|---|
| `store/slice/source.slice.ts` | Source panel state — separate sub-states for stack mode and file mode |
| `store/thunks/source.thunks.ts` | Cascade loading, upload, export polling, persisted-graph restore |
| `services/api/source.service.ts` | Typed API client wrappers |
| `components/source/SourcePanel.tsx` | Mode toggle, header/status badge, graph area, restore-on-mount |
| `components/source/StackPanel.tsx` | Region/Org/Stack/Branch cascade, scope toggle, module picker |
| `components/source/FilePanel.tsx` | Dropzone, file card, manifest, scope toggle, module picker |
| `components/source/GraphView.tsx` | Five stat tiles, node/edge rendering, pan/zoom controls |
| `components/source/RegionLoginModal.tsx` | Cross-region re-authentication modal |
| `components/source/V3Select.tsx` | Themed dropdown replacing native `<select>` (added this period — see [§9.9](#99-native-select-rendering-the-macos-dark-dropdown-chrome)) |

---

## 6. Test Strategy & Coverage

- **Pairing rule:** every automated test case has a strict 1:1 positive/negative pair. Negative cases are classified against a fixed taxonomy: (1) missing/empty, (2) invalid type/shape, (3) boundary, (4) forbidden state, (5) permission, (6) dependency failure, (7) conflict/isolation.
- **Automated split:** 51 of 58 rows automated as unit/integration tests; 7 rows are intentionally manual/qualitative (usability, security log-inspection, accessibility, performance thresholds not yet finalized) — see [§7](#7-automated--n--intentionally-out-of-scope-for-unit-tests) for the full list and rationale.
- **New testing patterns established this feature:**
  - `api/tests/unit/v3/` and `ui/tests/unit/v3/` — first test trees targeting the standalone `v3` code, mirroring the existing `tests/unit/<src-path>` convention.
  - supertest-driven route tests mounting the v3 router + error middleware on a bare Express app.
  - The **first `ui/` component render tests** (`@testing-library/react` in jsdom) — previously the repo only used React Testing Library for `renderHook`. Flagged for team ratification in `tdd.md`.

---

## 7. Full Test-Case Matrix

Source of truth: `cs-source-selection-test-cases.md` (also exported as `.csv` and `.html` in the same folder). 51 of the 58 rows below are automated; results reflect current suite state.

| ID | Module / Scenario | Type | Test Case | Expected Result | Automated | Result |
|---|---|---|---|---|:---:|:---:|
| TC_SRC_001 | Mode & Layout — default mode | UI | Load Source panel fresh | "From a stack" active by default; file controls hidden | Y | ✅ |
| TC_SRC_002 | Mode & Layout — toggle | Functional | Switch stack→file→stack | Retains stack data within session | Y | ✅ |
| TC_SRC_003 | Mode & Layout — hidden mode not submitted | Negative | Enter stack data, switch to file, trigger file action | Hidden stack data not submitted | Y | ✅ |
| TC_SRC_004 | Mode & Layout — header/badge | UI | Observe header idle/running/ready | Status badge reflects state | Y | ✅ |
| TC_SRC_005 | From a Stack — initial gating | UI | Open tab, no selections | Org/Stack disabled; action disabled | Y | ✅ |
| TC_SRC_006 | From a Stack — cascade region→org | Functional | Select Region, open Org dropdown | Org lists options for that region | Y | ✅ |
| TC_SRC_007 | From a Stack — cascade org→stack | Functional | Select Organization | Stack dropdown enables + lists stacks | Y | ✅ |
| TC_SRC_008 | From a Stack — ordered gating | Functional | Use Stack before Org chosen | Stack stays disabled | Y | ✅ |
| TC_SRC_009 | From a Stack — branch default | UI | Select Stack, observe Branch | Defaults to `main` | Y | ✅ |
| TC_SRC_010 | From a Stack — branch change | Functional | Pick a non-default branch | Export request uses that branch | Y | ✅ |
| TC_SRC_011 | From a Stack — whole-stack export | Functional | Region+Org+Stack + Whole stack, click action | Loading state; scoped export request; graph renders | Y | ✅ |
| TC_SRC_012 | From a Stack — scope default | UI | Observe scope radio | "Whole stack" selected by default | Y | ✅ |
| TC_SRC_013 | From a Stack — specific-module gate | Functional | Switch to Specific module | Modules listed with counts; action disabled until one checked | Y | ✅ |
| TC_SRC_014 | From a Stack — specific-module scoping | Functional | Check two modules, export | Request scoped to exactly those two | Y | ✅ |
| TC_SRC_015 | From a Stack — action gating | Negative | Leave Region/Org/Stack unset | Action stays disabled; no request sent | Y | ✅ |
| TC_SRC_016 | From a Stack — persistence | Functional | Complete whole-stack export | Selection persisted to project | Y | ✅ |
| TC_SRC_017 | From a File — initial state | UI | Switch to file tab, no file | Dropzone shown; extract disabled | Y | ✅ |
| TC_SRC_018 | From a File — select valid zip | Functional | Choose valid `.zip` | File card shows name/size/"selected just now" | Y | ✅ |
| TC_SRC_019 | From a File — extract & validate | Functional | Trigger extract on valid bundle | Manifest lists modules + counts | Y | ✅ |
| TC_SRC_020 | From a File — scope default | UI | Observe scope radio post-validate | "Everything in this file" default | Y | ✅ |
| TC_SRC_021 | From a File — everything → graph + persist | Functional | Proceed with "Everything" | Graph renders; selection persisted | Y | ✅ |
| TC_SRC_022 | From a File — specific-modules list | Functional | Switch to Specific modules | Modules listed with counts | Y | ✅ |
| TC_SRC_023 | From a File — forced dependency | Functional | Check a module depending on another | Dependency auto-checked, "required by entries" | Y | ✅ |
| TC_SRC_024 | From a File — forced-dependency uncheck block | Negative | Uncheck required module while dependent checked | Uncheck prevented | Y | ✅ |
| TC_SRC_025 | From a File — remove file pre-validate | Functional | Remove (×) before validating | File cleared; dropzone returns | Y | ✅ |
| TC_SRC_026 | From a File — upload another | Functional | Click "Upload another file" | Bundle/manifest discarded | Y | ✅ |
| TC_SRC_027 | From a File — actions locked during extract | Functional | Observe actions mid-extract | Both actions disabled | Y | ✅ |
| TC_SRC_028 | From a File — invalid bundle | Negative | Upload non-CS/corrupt zip | Validation fails with visible error | Y | ✅ |
| TC_SRC_029 | From a File — oversized file | Negative | Upload > 100 MB | Rejected with size-limit message | Y | ✅ |
| TC_SRC_030 | From a File — extract gating | Negative | Specific modules, none checked | Extract stays disabled | Y | ✅ |
| TC_SRC_031 | Content Graph — empty state | UI | Open panel before any read | Placeholder text shown | Y | ✅ |
| TC_SRC_032 | Content Graph — stat tiles | Functional | Successful export with known counts | Five tiles match extract result | Y | ✅ |
| TC_SRC_033 | Content Graph — node/edge render | UI | After successful read | Nodes in dependency order + reference edges | Y | ✅ |
| TC_SRC_034 | Content Graph — pan/zoom | Usability | Zoom in/out/reset, drag | Scales/pans; reset returns to default | **N** | Manual |
| TC_SRC_035 | Content Graph — zero content | Functional | Export empty stack/file | Valid zero-state, no error | Y | ✅ |
| TC_SRC_036 | Persistence — restore after reload | Functional | Reload with persisted source | Tab/region/org/stack/branch/scope/modules restored | Y | ✅ |
| TC_SRC_037 | Persistence — graph restore | Functional | Return after completed export | Persisted graph summary restored | Y | ✅ |
| TC_SRC_038 | API — start export | Functional | `POST /v3/source/export` | 202 `{ jobId }` | Y | ✅ |
| TC_SRC_039 | API — poll export status | Functional | `GET /v3/source/export/:jobId` | `{ status }` incl. progress | Y | ✅ |
| TC_SRC_040 | API — upload/validate | Functional | `POST /v3/source/upload` valid `.zip` | 200 `{ sourceId, fileName, sizeBytes, manifest[] }` | Y | ✅ |
| TC_SRC_041 | API — upload invalid bundle | Negative | Invalid/corrupt bundle | 400 not-a-valid-bundle | Y | ✅ |
| TC_SRC_042 | API — upload oversize | Negative | File > 100 MB | 413 too-large | Y | ✅ |
| TC_SRC_043 | API — listing endpoints | Functional | regions/orgs/stacks/branches | Expected list shape per param | Y | ✅ |
| TC_SRC_044 | API — modules endpoint | Functional | `GET /v3/source/modules` | `{ modules: [...] }` | Y | ✅ |
| TC_SRC_045 | API — graph endpoint | Functional | `GET /v3/source/:projectId/graph` (ready) | `{ counts, nodes, edges }` | Y | ✅ |
| TC_SRC_046 | API — graph before ready | Negative | Same, before export completes | 404 no-graph-yet | Y | ✅ |
| TC_SRC_047 | API — persist source | Functional | `PUT .../source` | 200 `{ source }`, retrievable | Y | ✅ |
| TC_SRC_048 | Security — auth required | Security | Call any endpoint without `app_token` | 401 | Y | ✅ |
| TC_SRC_049 | Security — permission denied surfaced | Security | Expired session / insufficient scope | 401/403 surfaced in UI | Y | ✅ |
| TC_SRC_050 | Security — secrets not logged | Security | Export with a management token | Tokens absent from logs | **N** | Manual |
| TC_SRC_051 | Observability — export lifecycle logged | Functional | Start/succeed/fail an export | Logged with identifiers, no secrets | **N** | Manual |
| TC_SRC_052 | Accessibility — zoom aria-labels | Accessibility | Inspect zoom controls | aria-labels present | Y | ✅ |
| TC_SRC_053 | Accessibility — keyboard operable | Accessibility | Operate via keyboard only | All controls reachable | **N** | Manual |
| TC_SRC_054 | Error Handling — zero orgs/stacks | Negative | Account with none accessible | Empty state; action disabled | Y | ✅ |
| TC_SRC_055 | Error Handling — network/timeout mid-export | Negative | Simulate failure mid-export | Error shown; selection preserved | Y | ✅ |
| TC_SRC_056 | Error Handling — progress feedback | Usability | Observe during long export | Never appears frozen | **N** | Manual |
| TC_SRC_057 | Performance — large-graph interactivity | Usability | Large content-type/reference set | Remains pannable/zoomable | **N** | Manual |
| TC_SRC_058 | Performance — dropdown latency | Performance | p95 of listing endpoints | < 800 ms (provisional) | **N** | Manual |

### 7.1 `Automated = N` — intentionally out of scope for unit tests

| ID | Type | Why not automated |
|---|---|---|
| TC_SRC_034 | Usability | Pan/zoom feel is a human-judgment call |
| TC_SRC_050 | Security | Requires log inspection, not a unit assertion |
| TC_SRC_051 | Observability | Log lifecycle presence is integration/manual |
| TC_SRC_053 | Accessibility | Keyboard operability needs a manual a11y pass |
| TC_SRC_056 | Usability | "Never appears frozen" is subjective |
| TC_SRC_057 | Usability | No numeric ceiling defined for "large" |
| TC_SRC_058 | Performance | Threshold is provisional/unconfirmed |

---

## 8. Test Execution Results

**TDD-run snapshot (2026-07-29, end of formal TDD pass):**

| Package | Test files | Tests | Composition |
|---|---:|---:|---|
| `api` | 88 | 742 | 698 pre-existing + 44 new v3 |
| `ui` | 31 | 408 | 346 pre-existing + 62 new v3 |

**Current snapshot (as of this report, 2026-07-30, after the fixes in §9.8–9.9):**

| Package | Test files | Tests |
|---|---:|---:|
| `api` | 90 | 788 |
| `ui` | 33 | 455 |

All suites green; no pre-existing test was weakened, skipped, or deleted to force a pass.

**Progression across the effort:**

| Milestone | Commit | Note |
|---|---|---|
| Spec/PRD/TRD/test-cases + API scaffolding (`501` stubs) | `f30d7d93` | Establishes the genuine red baseline |
| TDD in progress | `7b73658d` | 13/51 cases, 26 paired tests — services/store layer |
| TDD complete | `2e13a8c7` | 51/51 cases, 106 paired tests — full stack |
| Live regions + cross-region login + export logs + UX fixes | `dbf0430a` | Post-TDD defect fixes (see §9.4–9.6) |
| Full-data export to Downloads + scope-gated modules + graph UX | `6c1d1b35` | Feature rounding-out |
| Dropdown theming fix (this report) | uncommitted | See §9.9 |

---

## 9. Obstacles Encountered & Resolutions

This section covers every non-trivial obstacle hit while building this feature, in chronological order, with root cause and resolution for each.

### 9.1 Risk of retrofitted tests giving false confidence

**Problem:** An earlier exploratory implementation already existed on a scratch branch, built without tests. Writing tests against already-working code risks tests that merely describe existing behavior (including its bugs) rather than independently verifying requirements.

**Resolution:** `feature/cs-to-cs` was reset to the post-scaffold baseline (all `api/v3` routes returning `501`), and the scratch branch (`feature/cs-src-wip`) was kept only as an off-to-the-side reference. Every one of the 51 automated cases was then taken through a genuine red → green cycle.

### 9.2 Automated-case count was mis-stated mid-effort

**Problem:** An early status update quoted a 44 automated / 14 manual split for the 58-row matrix. This was wrong.

**Resolution:** The CSV export's `Automated` column was established as the single source of truth; recounting gave the correct **51 automated / 7 manual** split, which is what `tdd.md` and this report both use. No matrix rows were changed — only the earlier verbal summary was corrected.

### 9.3 Coverage config silently excludes the new `v3` trees

**Problem:** Both `api` and `ui` `vitest.config.ts` files scope coverage collection to `src/**` only. Since `v3` code lives outside `src/`, none of it is measured by the coverage report even though it is fully tested — a green test suite could misleadingly look uncovered in coverage tooling/dashboards.

**Resolution:** Logged as a known follow-up (not fixed in this pass, to avoid scope creep into unrelated build config): add `v3/**` to both coverage `include` globs.

### 9.4 v3 pages were clipped and non-scrollable

**Problem:** `ui/v3` pages are rendered inside the existing v2 `AppLayout` page wrapper, which applies `height: 100vh; overflow: hidden`. This is correct for v2's own layout assumptions but clipped v3 content that exceeds the viewport (e.g. a long module list or an expanded graph), with no way to scroll to see it.

**Resolution:** v3 pages now bypass the v2 `AppLayout` wrapper entirely rather than patching the shared wrapper's CSS, which would have risked regressing v2 pages that depend on the fixed-height/no-scroll behavior. (Commit `dbf0430a`.)

### 9.5 Graph zoom/reset buttons were unclickable

**Problem:** The content-graph's pan handler was capturing the pointer (`setPointerCapture`) for drag-to-pan, but pointer capture was retargeting subsequent pointer events away from the zoom-in/zoom-out/reset buttons layered on top of the canvas, making them unresponsive to clicks.

**Resolution:** Pan-handler pointer capture was scoped so it no longer intercepts pointer events destined for the overlay controls. (Commit `dbf0430a`.)

### 9.6 Region dropdown could silently show an incomplete list

**Problem:** The Region dropdown is meant to always offer all 5 Contentstack regions (NA, EU, Azure NA, Azure EU, GCP NA). If the backend response was ever incomplete, the dropdown would silently under-populate with no fallback.

**Resolution:** The client now falls back to the full 5-region list (defaulting to the session's home region) if the backend response is ever incomplete, so the control never silently degrades. Selecting a non-home region also now triggers a real Contentstack login modal for that region (cancel reverts the selection). (Commit `dbf0430a`.)

### 9.7 New React component-render testing pattern needed team sign-off

**Problem:** The repository's existing test conventions used React Testing Library only for `renderHook` — there was no precedent for rendering a full `.tsx` component tree in jsdom. Introducing this pattern for `StackPanel`/`FilePanel`/`SourcePanel`/`GraphView` tests without visibility could conflict with an unstated team convention.

**Resolution:** The pattern was adopted (it is the standard RTL approach) but explicitly flagged in `tdd.md` for team ratification rather than assumed to be uncontroversial.

### 9.8 Local dev server failed to start — `EADDRINUSE :5001`

**Problem (this reporting session):** Running `npm run dev` inside `api/` failed immediately with `Error: listen EADDRINUSE: address already in use :::5001`, thrown from `api/src/server.ts:107`.

**Root cause:** A prior `npm run dev` process (PID 60936) from an earlier session had never been terminated and was still holding port 5001.

**Resolution:** Identified the offending process with `lsof -i :5001 -sTCP:LISTEN`, confirmed it with the user, and terminated it (`kill 60936`). Port 5001 was verified free immediately after. This was an operational/environment issue, not a code defect — no source change was needed.

### 9.9 Native `<select>` rendering the macOS dark dropdown chrome

**Problem (this reporting session):** On the "Choose your source → From a stack" screen, opening the Region dropdown rendered a **dark, OS-native popup** (macOS/Chrome system chrome) instead of the app's light theme — visually jarring and inconsistent with the rest of the product.

**Root cause:** A browser's native `<select>` element delegates rendering of its *open* option list to the operating system, not to the page. This is standard HTML/CSS behavior — no amount of page-level CSS can restyle a native `<select>` popup's open state on macOS Chrome, so it always shows the OS's own (in this case dark) background regardless of the app's light theme.

**Investigation finding:** A themed replacement component, `V3Select`, already existed in the codebase (`ui/v3/components/source/V3Select.tsx`) along with a complete, passing unit-test suite (`V3Select.test.tsx`, 6/6 green) — built specifically to solve this class of problem by rendering the option list in-DOM instead of via the OS. However, it had only been **imported** into `StackPanel.tsx` and never actually wired into the JSX — the native `<select>` elements for Region, Organization, Stack, and Branch were all still live, so the fix was incomplete and the bug still reproduced.

**Resolution:**
1. Replaced the native `<select>` for **Region**, **Organization**, and **Stack** in `StackPanel.tsx` with `V3Select`.
2. Replaced the native `<select>` for **Branch** as well, adding a new optional `buttonStyle` prop to `V3Select` so the compact branch control could retain its original sizing (height, padding, font weight) without affecting the other three full-width fields.
3. Updated `StackPanel.test.tsx`: two assertions had assumed native-`<select>` DOM semantics —
   - `(screen.getByLabelText('Branch') as HTMLSelectElement).value` → changed to `toHaveTextContent('main')`, since the replacement is a `<button>`, not a `<select>`.
   - `getByRole('option', { name: 'develop' })` was asserted without opening the control first — native `<option>`s exist in the DOM even when closed, but `V3Select`'s options only render while open. Added a `fireEvent.click(...)` on the Branch control immediately before the assertion.
4. Verified: `V3Select.test.tsx` (6/6), `StackPanel.test.tsx` (12/12), full `ui/tests/unit/v3` suite (109/109), and the full `ui` suite (455/455) all green; `tsc --noEmit` clean.

**Why this one was easy to miss:** the import statement made `V3Select` *look* wired in at a glance (`git diff` showed only a one-line addition), but the actual JSX still referenced the native elements — a partial migration left in a working-but-wrong state rather than a compile error, so it required actually reading the render output (the screenshot) to catch.

---

## 10. Known Gaps / Open Questions

Carried forward from `cs-source-selection-test-cases.md`, still unresolved as of this report:

- **NFR-1 dropdown-latency threshold is provisional** — TC_SRC_058 uses 800 ms p95 as a placeholder; no confirmed SLA exists yet.
- **Export/extract duration budget and max-graph-size ceiling are undefined** — TC_SRC_057 can only assert qualitative "remains interactive," not a numeric ceiling.
- **Product success-metric thresholds (G-1, G-2) are TBD**, pending telemetry that is not yet confirmed to exist.
- **Concurrent/stale-selection handling (EC-9) is undecided** — last-write-wins vs. conflict detection has not been finalized; no test exists for this scenario.
- **Exact copy for empty-state/error messaging is TBD** outside of the two verbatim strings specified in the ACs (dropzone text, graph empty-state text).
- **Supported browser matrix (NFR-6) is TBD** — no compatibility test cases exist.
- **At-rest handling of source credentials is unresolved** — TC_SRC_050 only asserts credentials aren't logged, not how (or whether) they're encrypted at rest.
- **Persisted `source` schema is a proposal**, not yet signed off jointly with the (out-of-scope) Destination panel.

---

## 11. Current Status

- Feature-complete for both source modes (stack and file), content graph preview, and persistence/restore.
- All 51 automated test-case rows green; the 7 manual rows are tracked but not yet formally executed as a manual pass.
- Full regression clean: **API 788/788**, **UI 455/455**.
- Today's dropdown-theming defect (§9.9) is fixed, tested, and type-checked, but **not yet committed** — currently sitting as local working-tree changes on `feature/cs-to-cs`.

---

## 12. Next Steps

1. Commit the `V3Select` wiring fix (§9.9) with its updated tests.
2. Add `v3/**` to the `api` and `ui` `vitest.config.ts` coverage `include` globs (§9.3) so coverage reporting reflects reality.
3. Run the Playwright/e2e verification pass — the one pipeline stage explicitly out of the TDD skill's scope.
4. Execute the 7 manual test-case rows (usability, security log-inspection, accessibility, performance) and record results.
5. Resolve the open questions in §10 with product/design before final sign-off, particularly EC-9 (concurrent selection) and the persisted `source` schema's contract with the Destination panel.
6. Get the new component-render testing pattern (§9.7) formally ratified by the team.

---

## Appendix: Reference Documents

- `docs/features/cs-source-selection/feature.md` — feature spec
- `docs/features/cs-source-selection/prd.md` — product requirements
- `docs/features/cs-source-selection/trd.md` — technical requirements
- `docs/features/cs-source-selection/cs-source-selection-test-cases.{md,csv,html}` — full test-case matrix
- `docs/features/cs-source-selection/tdd.md` — TDD execution report
