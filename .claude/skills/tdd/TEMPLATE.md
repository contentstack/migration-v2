# TDD Execution Report — <Feature Name>

- **Slug:** `<slug>`
- **Inputs read:** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [<slug>-test-cases.md](./<slug>-test-cases.md)
- **Snyk precondition:** confirmed by user on <date> — scan already run and passed before this skill started.
- **Package(s) touched:** `ui/` | `api/` | `upload-api/` — list only those actually touched.
- **Run date:** <date>
- **Outcome:** complete / partial / blocked — one line on why if not complete.

## Positive / negative pairing

Strict 1:1. One row per pair. `Negative category` is the taxonomy category the negative was derived from (1 missing/empty · 2 invalid type · 3 boundary · 4 forbidden state · 5 permission · 6 dependency failure · 7 conflict).

| Test Case ID | Traces to | Positive test | Negative test | Negative category | Result |
|---|---|---|---|---|---|
| TC_XX_001 | AC-1.1 | `it('TC_XX_001 (positive): …')` — `path/to/x.test.ts` | `it('TC_XX_001 (negative): …')` — `path/to/x.test.ts` | 3 — boundary | ✅ / ❌ |

**Totals: N positive, N negative** (must be equal).

Pre-existing tests extended rather than duplicated:
- TC_XX_### — extended `path/to/existing.test.ts`
- (Omit if none.)

## Automated = N — out of scope by design

| Test Case ID | Type | Why it is not automatable |
|---|---|---|
| TC_XX_### | Usability | <one line> |

(Omit this section if there were none.)

## Implementation changes

| File | Change | Satisfies |
|---|---|---|
| `path/to/file.ts` | <one line: what changed> | AC-1.1, EC-2 |

## Full-suite regression

Command(s) run:

```
cd <package> && npm test
```

Actual output:

```
<paste the real pass/fail counts — never assert a result you did not run>
```

- [ ] All previously-passing tests still pass.
- [ ] No test was weakened, skipped, or deleted to force green.

Existing tests intentionally updated (only when `feature.md` states the behavior changed):
- `path/to/test.ts` — <what changed and the feature.md reference authorizing it>
- (Omit if none.)

## Coverage on touched code

```
<npm run test:coverage output for the touched files/branches>
```

Uncovered branches introduced, with justification or follow-up:
- (Omit if none.)

## Gaps found in upstream docs — reported, not fixed

**Backward traceability** — `AC-*`/`EC-*` in `feature.md` with no matching test case in the matrix:
- AC-X.Y — <what is uncovered>

**Other** — contradictions, ambiguities, or mis-specified rows found while implementing:
- TC_XX_### — <what was wrong>

(Omit this section if there were none.)

## New patterns established

- <e.g. "First `.test.tsx` component test in `ui/` — needs team ratification." Omit if none.>

## Next step

Playwright/e2e verification is the remaining stage in the pipeline — not covered by this skill.
