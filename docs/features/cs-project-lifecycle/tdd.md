# TDD report — Project deletion and unique project names

- **Slug:** `cs-project-lifecycle`
- **Inputs (read-only):** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [project-lifecycle-test-cases.md](./project-lifecycle-test-cases.md)
- **Run date:** 2026-08-12
- **Snyk precondition:** confirmed by the operator as already run and passed. Snyk was
  neither run nor configured here.
- **Outcome:** all three gates met. `api` 1471 passed / 118 files · `ui` 1262 passed /
  65 files.

## Phase 1 — Test cases

**114 positive + 114 negative = 228 tests.** Exactly one pair per `Automated = Y` row;
all 114 rows covered, no extras, verified programmatically.

| File | Rows | Tests | New/extended |
|---|---|---|---|
| `api/tests/unit/v3/models/project.store.delete.test.ts` | 29 | 58 | new |
| `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | 25 | 50 | new |
| `api/tests/unit/v3/routes/project.routes.lifecycle.test.ts` | 31 | 62 | new |
| `api/tests/unit/v3/services/export.service.test.ts` | 4 | 8 | extended |
| `ui/tests/unit/v3/components/projects/DeleteProjectDialog.test.tsx` | 11 | 22 | new |
| `ui/tests/unit/v3/components/projects/CreateProjectModal.test.tsx` | 8 | 16 | extended |
| `ui/tests/unit/v3/pages/Projects.test.tsx` | 5 | 10 | extended |
| `ui/tests/unit/v3/components/projects/ProjectCard.test.tsx` | 1 | 2 | extended |

Every negative names its taxonomy category in-file. Measured citations across the new
tests (counting mentions, not tests — a shared comment block can cover a pair):
#1 missing/empty ×36, #2 invalid shape ×28, #3 boundary ×24, #4 forbidden state ×60,
#5 permission ×16, #6 dependency failure ×22, #7 conflict ×13 — 199 in total.

#4 dominates because deletion is mostly about states that must be unreachable: a deleted
project that can still be written to, a second delete that reports success, a bar that
fills on failure.

**Honest red confirmed.** Store and route failures were all "function does not exist";
`DeleteProjectDialog.test.tsx` failed to load at all, because its component did not exist.

### Test defects I fixed before implementing

The skill's rule is that a test failing for the wrong reason is a bug in the test. Five,
all mine:

1. **Leaked `fs` spies.** Tests that mock `fs.rmSync` to simulate a removal failure left
   the mock installed when the awaited call threw before their own restore — so the file's
   own cleanup then failed with the error the test had injected. Fixed with a `withSpies`
   helper and a `vi.restoreAllMocks()` at the top of `afterEach`.
2. **`setV3Graph` fixture.** It requires an existing `source`; my fixture created a bare
   project, so the test failed on a precondition rather than on the behaviour.
3. **ID drift from the matrix.** `TC_PL_027` is *Ordering*, not bytes-reclaimed; `029` was
   missing; Reliability is `116`/`117`, not `115`/`116`. Realigned so forward
   traceability is exact.
4. **Spying on a function lowdb never calls.** lowdb writes through `steno` →
   `node:fs/promises`, so a `fs.writeFileSync` spy never intercepted and proved nothing.
   The ordering test now asserts by *observable state* — reading the record from disk at
   the moment removal happens — and the write-failure tests make the data directory
   read-only, asserting explicitly that the write did fail so the scenario cannot pass
   vacuously.
5. **A scenario that could not produce its own expectation.** `TC_PL_054 (negative)`
   rendered the dialog with nothing focused and then required focus not to return to the
   body — but with no trigger, the body *is* correct. It now focuses a stand-in trigger
   first and asserts focus returns to it, which is the stronger statement.

### Two assertions changed, with reasons

- **`TC_PL_009 (negative)`** originally demanded 401 for a well-signed token carrying no
  claims. No document specifies that: the guard verifies the signature and the scope is
  built from the decoded payload, so a claim-less token yields an empty scope — which is
  already safe, because `inScope` compares region and owner by exact equality. Asserting
  401 would have demanded a new auth rule this feature never agreed. It now asserts the
  property that *is* specified: a claim-less token can reach no project.
- **`TC_PL_101 (positive)`** used a leading-space name, which trips the modal's
  pre-existing leading-whitespace rule — correctly, and more actionably than a clash hint,
  since such a name can never be created. Changed to trailing whitespace, which is the
  case where trimming actually decides the comparison.

Neither is a relaxation: both replace an assertion I invented with the one the
specification supports.

## Phase 2 — Functionality

Sequenced P0-first per [prd.md §6](./prd.md): store → routes/controller → export guard →
UI.

**Full suites, real output:**

```
api   Test Files  118 passed (118)      Tests  1471 passed (1471)
ui    Test Files   65 passed (65)       Tests  1262 passed (1262)
```

Baselines before this work were `api` 1293/115 and `ui` 1212/64 — so +178 api and +50 ui,
with every previously-passing test still green.

### What was built

| Area | Change |
|---|---|
`migrationData.util.ts` | `projectDataDir(projectId)` — resolves TQ-1 by sharing `safeSegment` rather than deriving the parent by string manipulation |
`project.store.ts` | `deleteV3Project` (flag → then remove, returning `{folderRemoved, bytesReclaimed}`), `isV3ProjectLive`, the uniqueness scan inside `createV3Project`, `normaliseName`, `directorySize`, and a shared `requireLiveProject` guard |
`project.controller.ts` | `deleteProject` handler, the 409 branch on create, the three `project.create.rejected` / `project.delete.*` events |
`project.routes.ts` | `DELETE /:projectId`, registered after the collection routes so the segment cannot shadow them |
`export.service.ts` | Liveness re-check before finalising, with temp-folder cleanup on the abandon path |
`ui` | `DeleteProjectDialog`, a delete control on `ProjectCard`, the clash hint in `CreateProjectModal`, `deleteProject` thunk + slice lifecycle, page wiring |

### One regression I caused and fixed

`TC_SRC_047` (pre-existing) pins `setV3Graph`'s message for a *missing* project. Routing
it through `requireLiveProject` was tidier and silently changed that contract — and
nothing in `feature.md` says it changed. The original error is preserved and the
deleted-project guard added alongside it. Fixed in the implementation, not the test.

### Defects the tests caught in code I wrote

- **The 500 body leaked the raw error.** `v3ErrorMiddleware` echoes `err.message`, so
  rethrowing a store error would have published a filesystem path to the client. The
  handler now raises a sanitised error. Caught by `TC_PL_006 (negative)`.
- **`HTTP_CODES.INTERNAL_SERVER_ERROR` does not exist** — the constant is `SERVER_ERROR`.
  The test passed anyway via the middleware's 500 fallback, so this was found by reading
  rather than by a failure. Corrected.
- **`ProjectCard` is a single `<button>`.** A delete control inside it would be nested
  interactive content, and the click would bubble and open the project. The card is now a
  wrapper with two sibling controls, rather than patched with `stopPropagation`.

## Phase 3 — Consistency review (no design exists)

Q-1 resolved to *no design; follow existing conventions*, so this phase is a consistency
review against the four named precedents rather than a pixel diff. **Defect signature: a
one-off value where a precedent or token exists.** Four found and fixed — every one of
them a near-value I had invented.

| Token class | Precedent (`ContentMappingPanel`) | Mine, before | After |
|---|---|---|---|
| Radius (dialog card) | `--radius-xl` | `--radius-lg` | `--radius-xl` |
| Padding | `22px 24px` | `20px 22px` | `22px 24px` |
| Width | `min(460px, calc(100vw - 32px))` | `100%` + `maxWidth: 420` | clamped, as precedent |
| Border | none | `1px solid --border-subtle` | none |
| Shadow | `--shadow-lg` | `--shadow-lg` with a fallback | `--shadow-lg` |
| Backdrop | `rgba(22,19,32,.45)` | `var(--overlay, …)` | same literal — see below |
| Danger button | `--danger` on `--danger-surface`, `--danger` border | solid `--danger` fill, `#fff` text | outlined, per convention |
| Focus ring | no `outline` property | `outline: 'none'` | removed |

Two of these were more than cosmetic:

- **The filled red button invented a visual weight the product does not have.** Every
  existing danger surface in v3 — `SourcePanel`, `ContentMappingPanel`,
  `CreateProjectModal` — uses the outlined form, and nothing uses a filled red button. It
  also duplicated the `--text-on-brand` token as a literal `#fff`.
- **`outline: 'none'` was an accessibility regression.** The dialog card is focused
  programmatically on open (`tabIndex={-1}`), so suppressing the outline removes the only
  indication a keyboard user has that focus moved into the dialog (NFR-3).

Zero raw hex values remain in the new components.

### State matrix

| State | Verified | Notes |
|---|---|---|
| Default / empty | ✅ | Dialog default; no-error create modal |
| Filled | ✅ | Create modal retains name + description through a refusal |
| Hover | ⚠️ N/A | No design and no hover rule in the precedent; controls inherit token styling |
| Focus | ✅ | Focus moves into the dialog on open and returns to the trigger on close; no outline suppression |
| Active / pressed | ⚠️ N/A | No design; no precedent defines a pressed state |
| Selected | ⚠️ N/A | Nothing selectable in either surface |
| Disabled | ✅ | Confirm disabled in flight, with `--surface-sunken` / `--text-subtle` and the label "Deleting…" |
| Loading | ✅ | Same in-flight state; no layout shift (the button keeps its box) |
| Error / validation | ✅ | Dialog error region and the create modal's `role="alert"`, both asserted |
| Responsive | ✅ | `min(460px, calc(100vw - 32px))` — clamped by construction, matching the precedent |
| Theme | ⚠️ N/A | The app has no dark theme: `theme.css` contains no `prefers-color-scheme` or `[data-theme]` rule |

### Copy

All copy is this feature's own, since no design exists — `feature.md` §11 quotes it and
those strings are asserted verbatim. The dialog reads *"Delete this project?"*, names the
project, and states *"and its exported content will be removed. This cannot be undone."*

## Gaps found in upstream docs — reported, not fixed

1. **`trd.md` API-2 records the create success status as 200.** It has always been **201**
   — the intent ("Unchanged") is right, the value is wrong. Tests follow the real
   behaviour; the TRD needs a correction pass.
2. **No `--overlay` token exists.** `theme.css` defines none, so the dialog backdrop is a
   literal rgba matching the precedent, which hardcodes the same value. A token would be
   the better fix, in a change of its own.
3. **`TC_PL_071`'s fixture is unspecified** (already flagged in the matrix). The test
   reproduces NFR-1's *file-count* dimension (10,000 files) but not the 160 MB byte
   volume: recursive removal is bound by directory entries far more than by size, and
   writing 160 MB per run would add minutes for no extra signal. Recorded as a deviation
   in-file.
4. **`FR-2.6`'s "without a full page reload"** has no observable definition in any
   document. `TC_PL_055` asserts the project leaves the list; the no-reload half is not
   independently verifiable as written.
5. **TQ-2 remains open** — a folder-removal failure currently returns 200 and logs. Built
   as documented; if the answer changes, `TC_PL_007` changes with it.

## Config or convention notes for the team

- **`ui/vitest.config.ts` still excludes `src/components/**` and `src/pages/**` from
  coverage.** The new UI code will not appear in coverage numbers. Not changed
  unilaterally.
- **Absence-asserting negatives pass before implementation.** Around 38 of the route/UI
  negatives assert that something does *not* happen, which is trivially true when the
  route or component does not exist. They became meaningful once Phase 2 landed; the
  positives are the Phase 1 signal.
- **`api` has no `typecheck` script** and carries pre-existing `tsc` errors in `v3` from
  missing `@types/express`, so type errors in new code are not caught by CI. Unchanged.

## `Automated = N` rows — intentionally out of scope

| Row | Why |
|---|---|
| `TC_PL_060` Perceived responsiveness | Requires human judgement of whether the interface "feels" responsive |
| `TC_PL_061` Copy clarity (delete dialog) | Requires an unfamiliar operator to read it |
| `TC_PL_103` Message clarity (refusal) | Same |
| `TC_PL_118` Concurrent create | The documents explicitly accept the check-then-write race; forcing the interleaving would assert implementation internals rather than the contract |
| `TC_PL_119` Deployment / server restart | An operational step, not a code behaviour |

## Next step

Playwright/e2e verification is the remaining stage — not covered by this skill.

Worth doing before that: **delete a real project through the running app.** Everything
here is unit-level, and the one thing no unit test can confirm is that a real 160 MB
export folder is genuinely reclaimed from disk (prd.md G-2). The api server must be
restarted first — `npm run dev` has no watch, so a running server will 404 the new route.
