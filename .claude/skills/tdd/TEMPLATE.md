# TDD Execution Report — <Feature Name>

- **Slug:** `<slug>`
- **Inputs read:** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [<slug>-test-cases.md](./<slug>-test-cases.md)
- **Reference design:** <URL or filename, and which page/step>
- **Snyk precondition:** confirmed by user on <date> — already run and passed before this skill started.
- **Package(s) touched:** `ui/` | `api/` | `upload-api/`
- **Run date:** <date>
- **Outcome:** complete / partial / blocked — one line on why if not complete.
- **Phases finished:** 1 ✅ · 2 ✅ · 3 ✅ (mark honestly; a partial run says so)

---

## Phase 1 — Test cases

Strict 1:1. `Neg. category`: 1 missing/empty · 2 invalid type · 3 boundary · 4 forbidden state · 5 permission · 6 dependency failure · 7 conflict.

| Test Case ID | Traces to | Positive test | Negative test | Neg. category | Result |
|---|---|---|---|---|---|
| TC_XX_001 | AC-1.1 | `it('TC_XX_001 (positive): …')` — `path/x.test.ts` | `it('TC_XX_001 (negative): …')` — `path/x.test.ts` | 3 — boundary | ✅ / ❌ |

**Totals: N positive, N negative** (must be equal).

Pre-existing tests strengthened rather than duplicated:
- TC_XX_### — extended `path/to/existing.test.ts`
- (Omit if none.)

### Automated = N — out of scope by design

| Test Case ID | Type | Why not automatable |
|---|---|---|
| TC_XX_### | Usability | <one line> |

(Omit if none.)

---

## Phase 2 — Functionality

### Implementation changes

| File | Change | Satisfies |
|---|---|---|
| `path/to/file.tsx` | <one line> | AC-1.1, EC-2 |

### Full-suite regression

```
<real npm test output — pass/fail counts per package. Never assert a result you did not run.>
```

- [ ] All previously-passing tests still pass.
- [ ] No test weakened, skipped, or deleted to force green.

Existing tests intentionally updated (only where `feature.md` states the behavior changed):
- `path/to/test.ts` — <what changed + the feature.md reference authorizing it>
- (Omit if none.)

### Coverage

```
<npm run test:coverage output for touched files>
```

Uncovered branches introduced, with justification or follow-up:
- (Omit if none.)

---

## Phase 3 — Pixel-perfect UI

### Token comparison

| Token | Reference | Implemented | Match |
|---|---|---|---|
| Card background | `#FFFFFF` | `var(--surface-card)` → `#FFFFFF` | ✅ |
| Summary panel padding | `24px` | `24px` | ✅ |
| Primary button radius | `10px` | `8px` | ❌ → fixed |

Design values with no equivalent in our design system (flagged, not silently hardcoded):
- <token + where it appears>
- (Omit if none.)

### States verified

| State | Verified | Notes |
|---|---|---|
| Default / empty | ✅ / N/A | |
| Filled | | |
| Hover | | |
| Focus (keyboard) | | |
| Active / pressed | | |
| Selected | | |
| Disabled (+ reason copy) | | |
| Loading | | |
| Error / validation | | |
| Responsive — <breakpoints> | | |
| Theme — light / dark | | |

- [ ] All copy matches the design verbatim (labels, helper text, button text, error strings, empty states).
- [ ] Suite re-run after markup/CSS changes — no Phase 2 regression.

### Unresolved visual differences

| Region | Difference | Why unresolved |
|---|---|---|
| | | |

(Omit if none — but do not omit by pretending. "Close enough" is not an outcome.)

---

## Gaps found in upstream docs — reported, not fixed

**Backward traceability** — `AC-*`/`EC-*` in `feature.md` with no matching test case:
- AC-X.Y — <what is uncovered>

**Other** — contradictions, ambiguities, mis-specified rows, or design/spec conflicts found while building:
- <one line each>

(Omit if none.)

## Config or convention notes for the team

- <e.g. "`ui/vitest.config.ts` excludes `src/components/**` from coverage, so this feature's component code isn't reflected in coverage numbers — team should decide whether to change it." Omit if none.>

## Next step

Playwright/e2e verification is the remaining stage in the pipeline — not covered by this skill.
