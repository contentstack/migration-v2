---
name: tdd
description: Test-driven development stage — runs a feature through three hard-gated phases: (1) write strictly paired positive/negative tests from the approved test-case matrix, (2) implement the functionality until every test passes, (3) finish the UI to pixel-perfect fidelity against the reference design. Step 4 of the development flow, consuming feature-spec, prd-trd, and test-case outputs. Assumes a Snyk scan already ran as a precondition; never invokes Snyk. Trigger on phrases like "TDD this feature", "run TDD on <slug>", "write tests and implement", "test-driven development for <feature>", "build <page> test-first", "implement <feature> pixel perfect".
---

# tdd

Three phases, run in order, each gated on the previous one finishing:

| Phase | Produces | Gate to leave it |
|---|---|---|
| **1 — Test cases** | Paired positive/negative tests, all failing for the right reason | Every `Automated = Y` row has a 1:1 pair; all new tests red-for-the-right-reason |
| **2 — Functionality** | Real implementation | Every new test green + full existing suite green |
| **3 — Pixel-perfect UI** | UI matching the reference design exactly | Zero unexplained visual diffs across every state |

**Do not interleave the phases.** Do not start implementing while still writing tests. Do not start pixel-polishing while any test is red. Each gate is a real stop.

**The core rule: the test is the spec; code conforms to the test.** Never soften an assertion, relax an expected value, delete a case, or add `.skip` to reach green. A suite made green by weakening a test launders a defect into a passing build.

## Pipeline position

```
feature-spec → prd-trd → test-case → tdd (here: tests → functionality → pixel-perfect UI) → Playwright/e2e (separate)
```

- **Upstream inputs, read-only, never modify:** `feature.md`, `prd.md`, `trd.md`, `<slug>-test-cases.md`/`.csv` under `docs/features/<slug>/`.
- **Your outputs:** test files, real source code, and `docs/features/<slug>/tdd.md`.
- **Not yours:** authoring Playwright/e2e specs (separate stage). Phase 3 *does* use a browser to verify fidelity — that is visual verification, not e2e test authoring.

## Step 0 — Confirm the Snyk precondition

A Snyk scan is assumed to have **already run and passed** upstream. Never run `snyk test`; never add Snyk to this workflow.

Ask once: *"Has the Snyk scan for this codebase already been run and passed?"* Confirmed → proceed. Unsure/no → tell them to run it first (`fix-snyk-issues` skill if present) and **stop**.

## Step 0.5 — Load inputs and audit traceability

1. **Locate the feature.** Given a slug/path, use it. Otherwise list `docs/features/*/feature.md` and ask.
2. **Read all four artifacts end-to-end** before writing anything:
   - `feature.md` — the `UC-*`/`FR-*`/`AC-*`/`EC-*` behavioral contract.
   - `prd.md` — `P0/P1/P2` priority; sequence P0 first.
   - `trd.md` — owning package/module, data model, integration points to mock.
   - `<slug>-test-cases.md` (or the `.csv`) — the `TC_<PREFIX>_###` matrix.
   - **Also locate the reference design** named in `feature.md` §17 References — Phase 3 is impossible without it. If the feature has UI and no design reference exists, ask for it now, before Phase 1.
3. **Missing artifact → stop** and name the skill that produces it (`feature-spec`, `prd-trd`, `test-case`).
4. **Audit traceability both ways:**
   - Forward: every `Automated = Y` row → tests. This is the work list.
   - Backward: every automatable `AC-*`/`EC-*` should have a matrix row. One that doesn't is an **upstream gap — report it, never invent a test case to patch it**, or your tests silently diverge from what QA signed off.

**Scope:** only `Automated = Y` rows become code. `Automated = N` rows (usability, subjective, exploratory) are out of scope — list each in the report with a reason. Never force a judgment call into an assertion.

---

# Phase 1 — Write the test cases

## 1.1 Plan the pairing

**Strict 1:1: every positive test has exactly one paired negative test.** Equal counts, verified at the end.

The risk this creates is *filler* — throwaway negatives written only to satisfy the count. Two constraints prevent it.

**Constraint A — derive every negative from this taxonomy**, walking it in order and taking the first category that yields a genuinely behavioral assertion:

| # | Category | The negative asserts |
|---|---|---|
| 1 | Missing / empty input | Required value absent, `null`, `undefined`, `''`, `[]`, `{}` → the defined rejection or fallback |
| 2 | Invalid type or shape | Wrong type, malformed structure, unparseable payload → the specific validation error |
| 3 | Boundary violation | Just past a stated limit (`max+1`, `min-1`, over a length/size cap) → the defined clamp/reject/truncate |
| 4 | Forbidden state | Action attempted when state disallows it (gated step, wrong phase, consumed token) → the defined block |
| 5 | Permission denial | Unauthorized or wrong-scope actor → the defined denial, not a crash |
| 6 | Dependency failure | Mocked collaborator throws / rejects / times out / returns an error status → the defined handling |
| 7 | Conflict | Duplicate key, name collision, concurrent write → the defined conflict behavior |

Prefer whichever maps to a real `EC-*` in `feature.md`. Categories 1–3 fit almost any input-taking unit; 6 fits almost any unit with a collaborator.

**Constraint B — a negative must assert *specific defined* behavior.** Not acceptable:

```ts
expect(fn).toThrow();               // ✗ any error passes — asserts nothing
expect(result).toBeFalsy();         // ✗ 0, '', null, undefined all pass
expect(() => fn()).not.toThrow();   // ✗ a positive test in disguise
```

Acceptable:

```ts
expect(() => createStack({ name: '' })).toThrow('Stack name is required');
await expect(createStack(dupe)).rejects.toMatchObject({ status: 409 });
expect(screen.getByRole('alert')).toHaveTextContent('Select an import authentication method');
expect(onProceed).not.toHaveBeenCalled();
```

If the taxonomy yields nothing meaningful for a row, the test case itself is mis-specified: write the strongest available negative **and** flag that row as an upstream gap.

**Naming — carry traceability into the test:**

```ts
it('TC_DEST_004 (positive): enables Proceed once region, org, stack name and auth are set', …)
it('TC_DEST_004 (negative): keeps Proceed disabled when no auth method is selected', …)
```

## 1.2 Write the tests, confirm honest red

Write every pair, then run **only** the new file for fast feedback:

```bash
cd <ui|api|upload-api> && npx vitest run tests/unit/<path>/<name>.test.ts
```

Confirm each new test fails **because the behavior is missing** — not from a typo, wrong import path, or broken mock. A test failing for the wrong reason is a bug in the test: fix it before touching source.

## 1.3 Repo conventions — follow exactly

Verify against a neighboring test file before writing; conventions drift.

- **vitest** in all three packages (`api/`, `ui/`, `upload-api/`), each with its own `vitest.config.ts`.
- **Location:** `tests/unit/<mirrors-src-path>/<name>.test.ts`. Mirror the source path.
- **Imports:** `import { describe, it, expect, vi, beforeEach } from 'vitest';`
- **Mock style** — `vi.hoisted()` for declarations, then `vi.mock()`. Note the `.js` extension on source paths even in TypeScript:
  ```ts
  const { mockHttps } = vi.hoisted(() => ({ mockHttps: vi.fn() }));
  vi.mock('../../../src/utils/https.utils.js', () => ({ default: mockHttps }));
  ```
- **Fixtures:** `tests/fixtures/`. **Module mocks:** `upload-api/tests/__mocks__/`. Reuse before creating.

### Component tests in `ui/` — fully supported, use them

`ui/` has no component tests *yet*, but the infrastructure is already configured — **write them normally, this needs no special permission:**

- `vitest.config.ts` sets `environment: 'jsdom'`, `globals: true`, react SWC plugin.
- `tests/setup.ts` already registers `@testing-library/jest-dom/vitest` matchers and does `vi.restoreAllMocks()` + clears `localStorage`/`sessionStorage` in `afterEach`.
- Installed: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@testing-library/dom`.

Pattern:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('TC_DEST_002 (positive): shows the selected org in the summary panel', async () => {
  render(<DestinationStep {...props} />);
  await userEvent.selectOptions(screen.getByLabelText('Organization *'), 'TSO Migrations');
  expect(screen.getByTestId('summary-org')).toHaveTextContent('TSO Migrations');
});
```

Query by **role, label, or text** — what a user perceives — not by CSS class or internal structure. Use `userEvent` (not `fireEvent`) so interactions include the real focus/pointer sequence.

**Coverage gotcha:** `ui/vitest.config.ts` currently **excludes `src/components/**` and `src/pages/**`** from coverage (thresholds: lines/functions/statements 80, branches 60). Your new component code will not appear in coverage numbers. Do not "fix" this exclusion unilaterally — note it in the report so the team decides.

## 1.4 Test quality rules

- **Assert behavior, not internals.** Public inputs → public outputs and observable effects. Never assert private helpers were called or internal call ordering the contract never promised.
- **One behavior per test.** Five unrelated assertions give one bit of information on failure.
- **No shared mutable state.** Every test must pass alone and in any order.
- **Mock only real boundaries** — network, filesystem, clock, external SDKs. Over-mocking passes against code that cannot work.
- **No snapshots as a substitute for assertions.** Assert the specific fields the `AC-*` names.
- **Deterministic always.** No real network, no sleeps, no unseeded randomness, no dependence on today's date.

### ✅ Gate 1 → Phase 2

Every `Automated = Y` row has exactly one positive and one negative test; counts equal; all new tests red for the right reason. Do not implement before this holds.

---

# Phase 2 — Develop the functionality

Make it **work**. Visual exactness is Phase 3's job — do not chase pixels here.

Work in small groups — one `FR-*`, or a tight cluster of `TC_*` rows — sequenced P0-first from `prd.md`, so an interrupted run leaves the important part landed. Per group:

1. Write the minimum real implementation satisfying that group's pair. Don't gold-plate past what the `AC-*`/`EC-*` requires.
2. Re-run that test file. Both tests pass.
3. Next group.

Rules:

- **Never edit a test to make it pass.** If a test looks wrong on closer reading, reconcile against `feature.md` and the matrix — don't quietly loosen it.
- **Never delete or `.skip` a failing test.**
- **A test contradicting `feature.md`** → the doc wins; report the contradiction, don't rewrite either side silently.
- **Feature partially implemented already** → still write tests first and run them; some pass immediately, which is informative. Never assume existing code is correct because it exists.
- **A test already exists for a `TC_*`** → strengthen it in place, don't duplicate. Note as pre-existing.

## Full-suite regression

```bash
cd <package> && npm test          # api/ also has test:unit and test:integration
cd <package> && npm run test:coverage
```

Every previously-passing test must still pass. A regression means fixing **your implementation**, not the older test — the sole exception being when `feature.md` explicitly states that behavior changed, which you must name in the report. Never silently rewrite an existing test.

Coverage is evidence your new code is *exercised*, not a number to game. An uncovered branch you added either needs a test or is dead code.

Never assert a suite result you did not actually run. Capture real output.

### ✅ Gate 2 → Phase 3

All new tests green, full suite green, real output captured. Do not pixel-polish over a red suite.

---

# Phase 3 — Pixel-perfect UI

The functionality works; now make it **visually identical to the reference design**. Skipping or eyeballing this phase is the main reason UI work gets rejected in review.

## 3.1 Render the reference design side by side

You cannot match a design you have not looked at. Get it on screen:

- **Claude Design / self-extracting `.html` export** — these are self-extracting bundles; the markup only assembles when a browser executes them, and `file://` won't load in the preview pane. Serve it and open it:
  ```bash
  cd <dir-with-the-export> && nohup python3 -m http.server 8934 --bind 127.0.0.1 > /tmp/ref.log 2>&1 & disown
  ```
  Then `preview_start` at `http://127.0.0.1:8934/<file>.html`, navigate to the relevant step/page, and screenshot. Stop the server when done (`pkill -f "http.server 8934"`).
- **Figma / screenshots / images** — read them directly.
- **Run the real implementation** in the preview pane at the **same viewport** as the reference (`resize_window`) so comparisons are apples-to-apples.

## 3.2 Extract exact tokens, don't approximate

Build a comparison table — reference value vs implemented value — for every one of these. "Looks about right" is how pixel drift enters:

| Token class | What to pin down exactly |
|---|---|
| Color | Every hex: text, background, border, icon, badge/pill fills, hover/active states |
| Spacing | Padding and margin per region, gaps in flex/grid, in px |
| Typography | font-family, size, weight, line-height, letter-spacing per text role |
| Radius | Per element class — cards, inputs, buttons, pills, icon tiles |
| Border | Width and color, and which sides |
| Shadow | Full box-shadow values, including layered shadows |
| Size | Control heights (input/button), icon sizes, avatar/tile dimensions, panel widths |
| Layout | Column widths/ratios, max-widths, alignment, sticky/fixed regions |

Prefer the project's existing design tokens/SCSS variables over raw hex where an equivalent exists — matching the design *and* staying on the system. Where the design uses a value the system lacks, say so in the report rather than silently hardcoding a one-off.

Use `javascript_tool` to read computed styles from the rendered implementation instead of guessing what your CSS resolved to:

```js
getComputedStyle(document.querySelector('.summary-panel')).padding
```

## 3.3 Diff region by region

Compare in a fixed order so nothing gets skipped — header, then each form field group, then side panels, then the action bar. For each region: overall placement, internal spacing, typography, color, then the small stuff (icon alignment, optical centering, text truncation/ellipsis, wrapping behavior).

## 3.4 Cover every state, not just the default

The default view is a fraction of the work. Verify each state that applies:

| State | Check |
|---|---|
| Default / empty | Placeholder copy, empty panels, initial disabled controls |
| Filled | Real values, live-updating summaries, long-value truncation |
| Hover | Every interactive element |
| Focus | Visible focus ring on keyboard nav — required, never remove outlines without a replacement |
| Active / pressed | Buttons, selectable cards |
| Selected | Toggles, radio-style cards, chosen dropdown values |
| Disabled | Correct styling **and** the disabled reason/helper copy |
| Loading | Spinners/skeletons, and that layout doesn't shift when they resolve |
| Error / validation | Message copy verbatim from the design, field-level styling, `role="alert"` |
| Responsive | Each breakpoint the design specifies (`resize_window` mobile/tablet/desktop) |
| Theme | Light and dark, if the app supports both |

Copy must match the design **verbatim** — labels, helper text, button text, error strings, empty-state text. A paraphrased label is a real defect; if a string seems wrong, report it, don't improvise.

## 3.5 Iterate to zero

Screenshot → diff → fix CSS → re-screenshot. Repeat until no unexplained differences remain. Every remaining difference must be either fixed or recorded in the report with a justification (e.g. "design shows a token our system doesn't define — flagged for design review"). "Close enough" is not an outcome.

Do not regress Phase 2 while doing this: re-run the suite after CSS/markup changes, since restructuring markup breaks queries.

### ✅ Gate 3 → report

Zero unexplained visual diffs across all applicable states; suite still green.

---

## Self-check before the report

- [ ] Snyk precondition confirmed with the user (not assumed).
- [ ] 1:1 pairing exact — positive count == negative count.
- [ ] Every negative asserts specific defined behavior; taxonomy category recorded.
- [ ] Every new test name carries its `TC_<PREFIX>_###`.
- [ ] `Automated = N` rows listed as intentionally out of scope.
- [ ] Backward-traceability gaps reported, not patched.
- [ ] Full suite actually run; real output captured.
- [ ] No test weakened, skipped, or deleted.
- [ ] Phase 3 token table filled in; every state in 3.4 checked or marked N/A with a reason.
- [ ] All copy verbatim from the design.

A failed box gets fixed, not reported as green.

## Report

Write `docs/features/<slug>/tdd.md` from `TEMPLATE.md` in this skill's folder, **on every run** — including partial, blocked, or failed ones. If it exists for this slug, append a numeric suffix (`tdd-2.md`); prior runs are history.

## Non-goals

- No authoring Playwright/e2e specs (separate stage). Browser use in Phase 3 is visual verification only.
- No running or configuring Snyk.
- No modifying `feature.md`, `prd.md`, `trd.md`, or the test-case files. Found a gap? Report it.
- No automating `Automated = N` rows.
- No inventing requirements beyond `feature.md`/the matrix, even to "round out coverage."
- No skipping 1:1 pairing on cases that seem hard to negate — use the taxonomy.
- No unilaterally changing shared config (e.g. the `ui/` coverage exclusions) — report instead.
- No Jira tickets, PRs, or commits.

## Report back

- Path to `tdd.md` as a markdown link.
- Phase 1: positive/negative counts (equal), package(s).
- Phase 2: full-suite result, real numbers.
- Phase 3: states verified, and any visual diff left unresolved with its justification.
- `Automated = N` rows omitted; upstream gaps found.
- Next: "Playwright/e2e verification is the remaining stage — not covered by this skill."

Do not summarize the report's contents; the user can open it.
