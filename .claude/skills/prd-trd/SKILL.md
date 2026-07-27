---
name: prd-trd
description: Generate a Product Requirements Document (PRD) and a Technical Requirements Document (TRD) from an existing feature spec at `docs/features/<slug>/feature.md`. This is step 2 of the development flow — it consumes the feature-spec output and produces documents that engineering and product will act on. Trigger on phrases like "create PRD", "generate TRD", "PRD and TRD from spec", "turn this feature into a PRD", "prep the technical design", "PRD/TRD for <feature>".
---

# prd-trd

You elaborate an existing, approved feature spec into two documents:

- **PRD (`prd.md`)** — product decisions: prioritization, rollout, metrics, stakeholders.
- **TRD (`trd.md`)** — technical decisions: architecture, data model, APIs, tasks, rollback.

**The feature.md is the source of truth.** You do not re-define what the feature does — you elaborate the *decisions* around it. Never modify feature.md from this skill.

**ID contract.** The AC *statements* (Given/When/Then) live in feature.md and are not rewritten here — the downstream test-cases skill reads feature.md for the test contract AND reads prd.md + trd.md for surrounding context (priority ordering, test placement, fixtures, mocks). Preserve every ID from feature.md verbatim (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`). Never renumber, never invent parallel IDs for the same items. You introduce NEW IDs only for genuinely new content: `TR-*` (technical requirement), `T-*` (task), `API-*`, `EVT-*`, `DM-*` (data model), `TC-*` (tech choice), `INT-*` (integration), `TRR-*` (technical risk), `PQ-*` (product open question), `TQ-*` (technical open question).

## Workflow

### 1. Locate and load the spec

- Default input: `docs/features/<slug>/feature.md`.
- If the user gave a slug or path, use it. Otherwise, list `docs/features/*/feature.md` and ask which one.
- **Read the file end-to-end** before asking anything. Half the questions the user might expect you to ask are already answered in the spec.

### 2. Validate the spec

Do not proceed if any of these fail:

- All 17 sections (`## 1.` … `## 17.`) present.
- At least one `UC-*`, one `FR-*`, one `AC-*`.
- No unresolved `TBD — Open Question` in load-bearing places (§2 Problem, §3 Users, §6 Use cases, §11 AC).

If validation fails, STOP. List the specific gaps and tell the user to re-run the `feature-spec` skill to fix them. Do not attempt to fix feature.md yourself — that's outside this skill's scope.

### 3. Ask which docs to produce

If the user's request is ambiguous, ask once: PRD only, TRD only, or both. Default is both.

### 4. Gather PRD-specific info (only what's not in feature.md)

Use `AskUserQuestion` with grouped questions. Max 2 rounds. Skip anything already answered in the spec.

- **Priority per FR** (P0 / P1 / P2) if not already set.
- **Rollout mechanism** (feature flag / dark launch / staged / hard flip / beta cohort).
- **Post-launch success metrics** (measurable 30/60/90 days after ship, distinct from build-time acceptance criteria).
- **Analytics events** to instrument for those metrics.
- **Stakeholders** (PM, tech lead, design lead, QA, other teams).

Unknown answers → `TBD — Open Question` (record in §15 PQ-*).

### 5. Gather TRD-specific info (only what's not in feature.md)

Same pattern, max 2 rounds. Skip anything already answered.

- **Reuse vs new**: which existing services/modules extend, what's greenfield.
- **Data store**: existing DB/table/index vs new; migrations required.
- **API surface**: new endpoints, mutations, events; owned by which service.
- **Third-party integrations** (auth provider, payment, analytics, CDN, etc.).
- **Migration / backfill** requirements for existing data.
- **Feature-flag mechanism** (flag key, config surface, kill switch).
- **Rollback plan** — how to disable and reverse if things go wrong.
- **Testing surface** the team expects (unit / integration / e2e / manual).

Unknown answers → `TBD — Open Question` (record in §18 TQ-*). Never invent an architecture or an API contract the user didn't confirm.

### 6. Write both files

- PRD path: `docs/features/<slug>/prd.md`
- TRD path: `docs/features/<slug>/trd.md`

Use `PRD_TEMPLATE.md` and `TRD_TEMPLATE.md` verbatim (same section order, same section numbers). Downstream tools key off these headings.

Cross-link at the top of each: PRD → feature.md + trd.md; TRD → feature.md + prd.md.

### 7. Self-check before returning

**PRD:**
- [ ] Every `FR-*` from feature.md appears in §6 with a priority (or explicit "no priority — deferred").
- [ ] Every §4 metric has a target threshold or an explicit `TBD` linked to a PQ-*.
- [ ] §9 Rollout is concrete (not "we'll figure it out later"). If not decided, say so and record PQ-*.
- [ ] §10 Analytics events cover every §4 metric.
- [ ] §12 lists all cross-team dependencies from feature.md §13.

**TRD:**
- [ ] Every `FR-*` from feature.md maps to at least one `TR-*` in §3 (or explicit "no code change").
- [ ] Every `AC-*` from feature.md has an assigned test type in §10.
- [ ] Every entity in feature.md §10 has a `DM-*` entry (or an explicit "no schema change").
- [ ] Every `DEP-*` in feature.md §13 has a matching `INT-*` in §7.
- [ ] §15 Rollback is specific — not "revert the PR".
- [ ] Every `TR-*` is realized by at least one `T-*` in §17.

If any check fails, either fix it or record it in the appropriate Open Questions section. Never quietly skip.

### 8. Report back

End with:
- Path to prd.md and trd.md (as markdown links).
- Count of open questions in each: "PRD: 3 PQ, TRD: 5 TQ".
- Next step: "Run the test-cases creator skill on this feature — it reads all three docs together (feature.md for the AC contract, prd.md for priority + rollout context, trd.md for test placement + fixtures + integration points to mock)."

Do not summarize the contents. The user can open the files.

## Rules

- **feature.md is immutable.** If you find gaps in the spec while writing PRD/TRD, list them and tell the user to re-run `feature-spec`. Do not edit feature.md.
- **Preserve IDs verbatim.** `UC-1` in feature.md = `UC-1` in PRD/TRD. New IDs (TR-*, T-*, API-*, DM-*, etc.) belong only to new content introduced in this skill.
- **No invention.** Any unknown is `TBD — Open Question`. An invented API contract is worse than no contract.
- **PRD is a delta, not a re-copy.** If a section is fully covered by feature.md, write `See feature.md §X.` and add only the product-side delta (priority, metric threshold, rollout stage, stakeholder ownership). Do not duplicate spec text.
- **TRD is code-adjacent, not the design doc.** Include enough that an engineer could start a design doc from it — types/shapes, migration approach, integration contracts. Do not write actual code, class hierarchies, or file trees.
- **Priorities are honest.** P0 = the feature does not work without it. Don't rubber-stamp everything P0.
- **Rollback is honest.** Say what breaks if you rollback mid-migration. "Nothing breaks" is almost always wrong.

## Handling designs, mockups, and references

Same policy as [[feature-spec]]:

- **Do not download, mirror, or copy** design files (Figma, Claude Design, screenshots, `.fig`, `.html`, `.png`) into the repo.
- Record designs in the PRD's §16 References and the TRD's §19 References as: `<URL or filename> — <one-line: which screens/flows>`.
- Design-derived UX details belong in feature.md, not PRD/TRD. If the design surfaces a UX detail that's not in feature.md, note it as an open question so the spec gets updated first.
