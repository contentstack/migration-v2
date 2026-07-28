---
name: tdd
description: Test-driven development stage — turns an approved test-case matrix into real running code by writing strictly paired positive/negative unit tests for every automatable case, then implementing the feature until every test passes. This is step 4 of the development flow, consuming the outputs of feature-spec, prd-trd, and test-case. Assumes a Snyk scan already ran as a precondition; never invokes Snyk itself. Trigger on phrases like "TDD this feature", "run TDD on <slug>", "write tests and implement", "test-driven development for <feature>", "turn the test cases into code", "implement <feature> test-first".
---

# tdd

You take an approved test-case matrix and turn it into real unit tests **plus** the implementation that satisfies them — red, then green, in one run. This is the only skill in the pipeline that writes production code.

**The core invariant: the test is the spec, and the code conforms to the test.** Never the reverse. If a test fails, you change the implementation. You do not soften an assertion, relax an expected value, delete a case, or add `.skip` to reach green. A green suite obtained by weakening a test is worse than an honest red one, because it launders a defect into a passing build.

**Tests and implementation both happen here.** You do not stop after writing tests and hand off. You write tests, watch them fail for the right reason, then implement until they pass.

## Pipeline position

```
feature-spec  →  prd-trd  →  test-case  →  tdd (you are here)  →  Playwright/e2e (separate skill)
 feature.md     prd.md +     <slug>-test-     unit tests +
                 trd.md       cases.md/.csv    implementation + tdd.md
```

- **Upstream inputs** — read-only, never modify: `feature.md`, `prd.md`, `trd.md`, `<slug>-test-cases.md`/`.csv`, all under `docs/features/<slug>/`.
- **Your outputs** — real test files and real source changes in `ui/`, `api/`, or `upload-api/`, plus your execution report at `docs/features/<slug>/tdd.md`.
- **Downstream** — Playwright/e2e is a separate later stage. Do not write Playwright tests or scaffold its config.

## Step 0 — Confirm the Snyk precondition

A Snyk scan is assumed to have **already run and passed** before this skill starts. It is a precondition owned upstream, not a step here. Never run `snyk test`, never add Snyk to this workflow.

Ask the user once: *"Has the Snyk scan for this codebase already been run and passed?"*
- Confirmed → proceed.
- Unsure or no → tell them to run it first (the `fix-snyk-issues` skill handles it if present) and **stop**. Do not proceed on an unconfirmed precondition.

## Step 1 — Load and validate the inputs

1. **Locate the feature.** If given a slug or path, use it. Otherwise list `docs/features/*/feature.md` and ask which one.
2. **Read all four artifacts end-to-end** before writing anything:
   - `feature.md` — the `UC-*` / `FR-*` / `AC-*` / `EC-*` contract. This is the behavioral source of truth.
   - `prd.md` — `P0/P1/P2` priority. Implement P0 first when sequencing.
   - `trd.md` — which package/module owns this, reuse-vs-new, data model, integration points to mock, expected testing surface.
   - `<slug>-test-cases.md` (parse the `.csv` instead if the table is long — same data, easier to iterate) — the `TC_<PREFIX>_###` matrix with `Test Type`, `Automated`, `Test Case`, `Expected Result`.
3. **If any of the four is missing, stop** and name the skill that produces it (`feature-spec`, `prd-trd`, or `test-case`). Do not substitute your own judgment for a missing upstream doc.

## Step 2 — Traceability audit (do this before writing tests)

Build the mapping both directions, because gaps in either direction are real defects:

- **Forward** — every `Automated = Y` row in the matrix must end up with tests. This is your work list.
- **Backward** — every automatable `AC-*` and `EC-*` in `feature.md` should be covered by at least one matrix row. If an `AC-*`/`EC-*` has **no** corresponding test case, that is an upstream gap: **report it, do not invent a test case to patch it.** Inventing here silently diverges your tests from what QA signed off on.

Record both lists. The backward gaps go in the report's "Gaps found in upstream docs" section.

## Step 3 — Scope: which rows become code

Only rows with **`Automated = Y`** are in scope — the deterministic, scriptable cases (mostly Functional, Negative, UI-structural).

Rows with **`Automated = N`** (Usability, subjective/visual, exploratory) are out of scope by design. List each one in the report with a one-line reason. Never try to force a manual-judgment case into a unit test — a test that asserts "looks reasonable" is noise that will be deleted by the next person.

## Step 4 — Plan the positive/negative pairing

**Strict 1:1 is non-negotiable: every positive test has exactly one paired negative test.** Equal counts, verifiable at the end.

The risk this rule creates is *filler* — a throwaway negative written only to satisfy the count. Prevent that with two hard constraints:

**Constraint 1 — derive the negative from the taxonomy below**, walking it in order and taking the first category that yields a genuinely behavioral assertion for that requirement:

| # | Category | Negative case asserts |
|---|---|---|
| 1 | **Missing / empty input** | Required value absent, `null`, `undefined`, `''`, `[]`, `{}` → the specific defined rejection or fallback |
| 2 | **Invalid type or shape** | Wrong type, malformed structure, unparseable payload → specific validation error |
| 3 | **Boundary violation** | Just past a stated limit (`max+1`, `min-1`, over a size/length cap) → the defined clamp, reject, or truncate |
| 4 | **Forbidden state / transition** | Action attempted when state disallows it (locked step, wrong phase, already-consumed token) → the defined block |
| 5 | **Permission / auth denial** | Unauthorized or wrong-scope actor → the defined denial, not a crash |
| 6 | **Dependency failure** | Mocked collaborator throws, rejects, times out, or returns an error status → the defined error handling |
| 7 | **Conflict / duplication** | Duplicate key, concurrent write, name collision → the defined conflict behavior |

Prefer the category that maps to a real `EC-*` edge case in `feature.md`. Categories 1–3 apply to almost any input-taking unit; 6 applies to almost any unit with a collaborator.

**Constraint 2 — a negative test must assert *specific defined* behavior**, taken from `feature.md`/`EC-*`/the matrix. These are not acceptable as negative tests:

```ts
expect(fn).toThrow();                    // ✗ any error passes — asserts nothing
expect(result).toBeFalsy();              // ✗ 0, '', null, undefined all pass
expect(() => fn()).not.toThrow();        // ✗ that's a positive test wearing a disguise
```

These are:

```ts
expect(() => parse('')).toThrow('title is required');        // ✓ specific message
expect(classify('<String>')).toBe('string');                 // ✓ specific wrong-path value
await expect(load()).rejects.toMatchObject({ code: 422 });   // ✓ specific failure shape
expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('skipped'));  // ✓ specific side effect
```

**If the taxonomy yields nothing meaningful for a row, that is evidence the test case is mis-specified, not evidence the pairing should be skipped.** Write the strongest available negative *and* flag that row as an upstream gap in the report.

**Naming — carry the traceability into the test itself** so any future reader can walk back to the matrix:

```ts
it('TC_CO_004 (positive): applies the discount when cart total exceeds the threshold', ...)
it('TC_CO_004 (negative): rejects the discount when cart total is exactly at the threshold', ...)
```

Write the full pairing plan down before writing any test file.

## Step 5 — Red → green, incrementally

**Do not write every test for the whole feature and then implement everything at once.** Big-bang batching loses the per-test feedback that makes TDD accurate, and produces implementations that satisfy the suite in aggregate while quietly missing individual cases.

Work in small groups — one `FR-*`, or one closely-related cluster of `TC_*` rows — and for each group:

1. **Red.** Write the positive + negative pair. Run only that file (fast feedback):
   - `npx vitest run <path/to/file.test.ts>` in the owning package.
2. **Verify red is honest.** Confirm each new test fails because the behavior is missing — not because of a typo, bad import path, or broken mock setup. A test failing for the wrong reason is a bug in the test; fix it before touching source.
3. **Green.** Write the minimum real implementation that satisfies the pair. Do not gold-plate past what the `AC-*`/`EC-*` requires.
4. **Re-run the file.** Both tests pass.
5. Move to the next group.

Sequence groups by `prd.md` priority — P0 first, so if the run is interrupted the most important behavior is the part that landed.

## Step 6 — Full-suite regression and coverage

Once all groups are green:

1. **Run the full suite for every affected package** (not just your new files):
   - `cd <ui|api|upload-api> && npm test`
   - `api/` also has `npm run test:unit` and `npm run test:integration` if you need to scope.
2. **Every previously-passing test must still pass.** If something regresses, fix your implementation — *not* the older test. The one exception: if `feature.md` explicitly states the old behavior has changed, then updating that test is correct, but you must call it out by name in the report. Never silently rewrite an existing test.
3. **Check coverage on the code you touched** — `npm run test:coverage` in the affected package. This is a check that your new code is genuinely *exercised*, not a target to chase. If a branch you added is uncovered, either it needs a test or it is dead code that should not have been written.

Never assert a passing suite you did not actually run. Paste the real output into the report.

## Step 7 — Self-check

- [ ] Every `Automated = Y` row has exactly one positive and exactly one negative test — counts equal.
- [ ] Every negative test asserts specific defined behavior (no bare `toThrow()` / `toBeFalsy()`).
- [ ] Every negative test's taxonomy category is recorded in the report.
- [ ] Every `Automated = N` row appears in the report as intentionally out of scope.
- [ ] Every new test name carries its `TC_<PREFIX>_###`.
- [ ] Backward traceability gaps (`AC-*`/`EC-*` with no matrix row) are reported, not patched.
- [ ] Full suite actually run; output captured.
- [ ] No test weakened, skipped, or deleted to force green.
- [ ] Snyk precondition confirmed with the user in step 0.

A failed box gets fixed, not reported as green.

## Step 8 — Write the report

Write `docs/features/<slug>/tdd.md` from `TEMPLATE.md` in this skill's folder. **This happens on every run** — including partial, blocked, or failed runs. An honest "here is what broke and why" report is a valid deliverable; a missing report is not.

If `tdd.md` already exists for this slug, append a numeric suffix (`tdd-2.md`) rather than overwriting — prior runs are history worth keeping.

## Test quality rules

Generated tests rot fast when they assert *how* code works instead of *what it does*. Apply these:

- **Assert behavior, not internals.** Public inputs → public outputs and observable side effects. Do not assert private helpers were called, internal call ordering, or object identity that the contract never promised.
- **One behavior per test.** A test asserting five unrelated things gives you one bit of information when it fails.
- **No shared mutable state across tests.** Reset in `beforeEach`. Every test must pass when run alone and in any order — order-dependent tests are flaky tests.
- **Mock only at real boundaries** — network, filesystem, clock, external SDKs, other services. Over-mocking produces tests that pass against code that cannot work.
- **No snapshot tests as a substitute for assertions.** A snapshot nobody reads is a rubber stamp; assert the specific fields the `AC-*` names.
- **Deterministic always.** No real network, no real sleeps, no unseeded randomness, no dependence on today's date — inject or fake time.

## Repo conventions — follow these exactly

Grounded in this repo; verify against a neighboring test file before writing, since conventions drift.

- **Framework: vitest** in all three packages (`api/`, `ui/`, `upload-api/`), each with its own `vitest.config.ts`.
- **Location:** `tests/unit/<mirrors-src-path>/<name>.test.ts`. Mirror the source path exactly.
- **Imports:** `import { describe, it, expect, vi, beforeEach } from 'vitest';`
- **Mocking style** — declare mocks via `vi.hoisted()`, then `vi.mock()` the module path. Note the `.js` extension on source paths even in TypeScript:
  ```ts
  const { mockHttps } = vi.hoisted(() => ({ mockHttps: vi.fn() }));
  vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
  ```
- **Shared fixtures:** `tests/fixtures/` (e.g. `ui/tests/fixtures/user.fixture.ts`). **Module mocks:** `upload-api/tests/__mocks__/`. Reuse an existing fixture before creating a new one.
- **Known gap in `ui/`:** it currently has **no component tests** — only `.test.ts` covering hooks, utilities, services, store, and cmsData. `@testing-library/react` is installed but used only for `renderHook`. If a test case genuinely requires rendering a component, you are **establishing a new pattern** — say so explicitly in the report so the team can ratify it. Do not silently introduce the first `.test.tsx` as though it were established convention.

## Pre-existing state

- **A test already exists for this `TC_*`** — extend or strengthen it in place rather than adding a duplicate. Note it in the report as pre-existing.
- **The feature is partially implemented** — still write the tests first and run them. Some will pass immediately; that is fine and informative. Do not skip the red phase just because code exists, and do not assume existing code is correct because it exists.
- **A test contradicts `feature.md`** — the doc wins. Report the contradiction; do not resolve it by quietly rewriting either side.

## Non-goals

- No Playwright or any e2e/browser test — separate later stage.
- No running or configuring Snyk — precondition you confirm, not a step you perform.
- No modifying `feature.md`, `prd.md`, `trd.md`, or the test-case files. Found a gap? Report it.
- No automating `Automated = N` rows.
- No inventing requirements beyond `feature.md`/the matrix, even to "round out coverage."
- No skipping 1:1 pairing on cases that seem hard to negate — use the taxonomy.
- No Jira tickets, PRs, or commits. Tests, implementation, and `tdd.md` are the deliverables.

## Report back

End the turn with:
- Path to `tdd.md` as a markdown link.
- Positive/negative counts (equal) and the package(s) touched.
- Full-suite result — real numbers.
- `Automated = N` rows left out, and any backward-traceability gaps found upstream.
- Whether a new test pattern was established (e.g. first `ui/` component test).
- Next step: "Playwright/e2e verification is the remaining stage — not covered by this skill."

Do not summarize the report's contents; the user can open it.
