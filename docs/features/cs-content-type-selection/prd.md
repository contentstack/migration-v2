# PRD: Content mapping — content type selection

- **Slug:** `cs-content-type-selection`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-10
- **Last updated:** 2026-08-10
- **Spec:** [feature.md](./feature.md)
- **Technical design:** [trd.md](./trd.md)

## 1. TL;DR

The first of three interfaces in the v3 Content mapping step. It turns "migrate everything or nothing" into an explicit, saved list of content types — and, for a content type that already exists in the destination stack, captures whether the source schema wins, the destination is left alone, or the two are merged.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product-side framing: the two problems have different shapes and only one of them is visible to the user today.

- **Scoping** is a *missing capability*. The operator knows they want twelve of a hundred content types and simply cannot say so. They feel this immediately.
- **Destination conflict** is a *silent hazard*. The operator does not know they have a problem until a destination schema has already been overwritten, and by then the damage is in someone else's stack. Nothing in the product currently asks the question.

The opportunity is that both are answered by the same screen and the same saved record, and that record is what interfaces 2 and 3 — and eventually the migration itself — consume.

## 3. Target users

See [feature.md §3](./feature.md).

Product-side delta: the two personas are the primary consumers of *different halves* of this screen, which affects how it should read. The migration engineer drives selection and will move fast through the list; the content operations owner is the one who should be pausing on the conflict control, and is the person the FR-5.9 explanations are written for. When those two are the same person in a hurry, R-1 is the outcome.

## 4. Product goals & success metrics

| ID | Goal | Metric | Target | Measurable today? |
|---|---|---|---|---|
| G-1 | Operators can scope a migration to a subset of source content types | A saved selection smaller than the export, replayable on revisit | Test-suite verified (AC-6.1, AC-8.1) | Yes — build time |
| G-2 | No destination content type is modified without a recorded intent | Saved records where a conflicting type carries no conflict mode | 0 | Yes — build time (AC-4.2, AC-4.3) |
| G-3 | Operators are warned before removing a depended-on content type | Confirmation fires on 100% of unticks that break a reference from a ticked type, and never otherwise | 100% / 0% false positives | Yes — build time (AC-5.1, AC-5.4, AC-5.6) |
| G-4 | Selections survive navigation and revisit | Selection loss on leaving and returning | 0 losses | Yes — build time (AC-8.1). Numeric field target `TBD` (PQ-3, mirrors feature.md Q-4) |
| G-5 | Operators actually use the conflict control rather than accepting the default | Share of conflicting types saved with a mode other than `source` | `TBD — Open Question` (PQ-2) | **No** — needs instrumentation that does not exist |
| G-6 | Scoping reduces failed or unwanted migrations | Migrations aborted or re-run after content-mapping ships | `TBD — Open Question` (PQ-2) | **No** — no migration telemetry, and Migrate is not built |

G-5 is the one worth naming explicitly: it is the only metric that would tell us whether R-1 is actually biting, and it is not measurable. See §10.

## 5. Non-goals

See [feature.md §5](./feature.md).

One product-side addition: **this feature is deliberately shipped before interfaces 2 and 3 exist.** The `map fields` and `entries` affordances render disabled (FR-7.2) rather than being omitted, so the operator can see where the flow continues. That is a decision to ship a visibly incomplete step rather than a step that looks complete and is not.

## 6. Requirements (prioritized)

Priorities inherit from the use case each requirement serves ([feature.md §6](./feature.md)) and are honest: **P0 means the screen does not work without it.**

### P0 — the screen does not function without these

| FR | Area | Why P0 |
|---|---|---|
| FR-1.1, FR-1.2 | Source data | Without the list there is no screen |
| FR-1.3, FR-1.4, FR-1.5, FR-1.6 | Reference graph | UC-5's warning is P0, and it cannot be asked without the graph |
| FR-2.1, FR-2.2, FR-2.3 | Destination match | Drives the whole conflict half of the feature (G-2) |
| FR-2.4 | Destination failure | Without it, a destination read failure blanks the screen |
| FR-3.1, FR-3.4, FR-3.5 | List, search | A hundred-type list is unusable without search that covers the whole set |
| FR-4.1, FR-4.2, FR-4.7 | Selection | The core interaction |
| FR-5.1 … FR-5.6, FR-5.9 | Conflict control | G-2 in full; FR-5.9 is P0 because R-1 rests on it |
| FR-6.1 … FR-6.6, FR-6.8 | Reference confirmation | G-3 |
| FR-8.1, FR-8.2, FR-8.4, FR-8.5, FR-8.6 | Footer & gate | FR-8.6 is the save-before-advance rule; shipping without it repeats the audit's data-loss bug |
| FR-9.1, FR-9.3, FR-9.4, FR-9.5, FR-9.7, FR-9.9 | Persistence | FR-9.4 protects the encrypted destination token on the same record |

### P1 — the screen works, but is worse without these

| FR | Area | Why not P0 |
|---|---|---|
| FR-3.2, FR-3.3, FR-3.6, FR-3.7, FR-3.9 | Paging | With client-side paging (trd.md TC-1) the whole list is already loaded; paging is presentation. FR-3.9 is P1 only because it cannot regress if paging is absent |
| FR-4.3, FR-4.4, FR-4.5, FR-4.6 | Select all | A convenience over FR-4.2, which already covers the need |
| FR-5.7, FR-5.8 | Conflict lifecycle | Correctness of edges around the control, not the control itself |
| FR-6.7 | Select-all suppression | Prevents a hundred dialogs, but only reachable via a P1 control |
| FR-7.1, FR-7.3 | Drill-in affordances | Signposting for features that do not exist yet |
| FR-8.7 | Double-submit guard | The shared gate's re-entrancy ref already covers this; the FR makes it explicit |
| FR-9.2, FR-9.6, FR-9.8 | Save polish | FR-9.6 becomes P0 the moment re-export is common; today it is a rare path |

### P2 — nice to have

| FR | Area | Why P2 |
|---|---|---|
| FR-3.8 | Empty search state | A blank list is understandable; the copy is polish |
| FR-7.4 | Disabled affordances out of tab order | An accessibility nicety on controls that do nothing |

No requirement is deferred without a priority.

## 7. User experience

See [feature.md §6, §7](./feature.md) and the design reference in §16.

Product-side notes on the two decisions most likely to be contested in review:

1. **`Use source` is pre-selected on the conflict control.** This was chosen over `Merge`. It means the default outcome for a conflicting content type is *replace the destination schema*. The mitigations are entirely informational — FR-5.9's per-option explanation, and FR-5.1 keeping the `already in destination` label visible whether or not the row is ticked. Recorded as R-1 in the spec and §13 here. If review disagrees, changing the default is a one-line change and one test.
2. **The footer count is deliberately naive.** It counts ticked content types only — not what the migration will actually pull in (FR-8.3, feature.md A-6). An operator ticking one content type that references four others sees `1 content type ships`, and four more will in fact be needed. That is a knowingly incomplete number, kept because dependency resolution is a non-goal for v1.

## 8. Non-functional requirements

See [feature.md §9](./feature.md). No product-side additions or relaxations.

Two are worth flagging as product-visible rather than purely technical: **NFR-2** (no network request per keystroke or per tick) is what makes the screen feel like a list rather than a form, and **NFR-5/NFR-7** (keyboard operation and focus handling on the confirmation dialog) matter because UC-5's dialog is the only modal in the v3 wizard so far.

## 9. Launch & rollout plan

- **Rollout mechanism:** same as Source, Destination, the project dashboard and Audit — gated purely by the `/v3` route existing. **There is no feature-flag system in this repository.** (Established convention, not a new decision.)
- **Feature flag name:** none. See [trd.md §14](./trd.md).
- **Cohort staging:**
  - **Stage 1 (internal):** the team reaches Content mapping through the existing wizard once the `api/v3` content-type endpoints deploy. The step is already in the tracker with a placeholder body, so exposing it is a body swap, not a routing change.
  - **Stage 2 (opt-in):** whoever is already using the v3 wizard. No separate cohort — the step sits inside a flow they are already in.
  - **GA:** part of v3 becoming the default migration entry point. Not owned by this feature alone, and realistically blocked on interfaces 2 and 3 plus Migrate.
- **Kill switch:** restore the placeholder branch for the `content-mapping` step in `ui/v3/pages/Migration/index.tsx` and stop mounting the new routes. No runtime toggle. As with Audit, this returns the wizard to a state it has already shipped in.
- **Ship order caveat:** this feature changes the shared step definition's `actionLabel` for `content-mapping` from `Continue to preview` to `Move to review` (FR-8.4). That string lives in `migration-wizard-chrome`, so the label change ships with this feature but lands in their file — see §12.
- **Comms plan:** changelog entry plus an internal note. Owner `TBD` (PQ-1).

## 10. Analytics & instrumentation

No product-analytics pipeline exists for this self-hosted tool — matching Source, Destination, the project dashboard and Audit. The §4 metrics split accordingly: **G-1 through G-4 are verified by the test suite at build time**, and **G-5 and G-6 are not measurable at all today**.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `TBD — Open Question` (PQ-2) | Selection persisted | Would need: count of selected types, count of conflicting types, distribution of chosen conflict modes | G-5 |
| `TBD — Open Question` (PQ-2) | Untick confirmation shown / confirmed / cancelled | Would need: referencing-type count, outcome | G-3 beyond build time |
| `TBD — Open Question` (PQ-2) | Migration run outcome | Not available — Migrate is not built | G-6 |

Interim measurement relies on the structured server logs required by NFR-9 and elaborated in [trd.md §11](./trd.md). Those can answer "are selections being saved, how large are they, and did the destination read fail". They deliberately **cannot** answer G-5 — "did the operator change the conflict default" — because that requires logging the chosen modes, which is a product decision about recording user choices rather than an incidental one. Folded into PQ-2.

This gap is load-bearing for R-1: the risk that operators blow through `Use source` without reading is exactly the thing we cannot currently observe.

## 11. Post-launch success criteria

- **30 days:** every internal migration run that uses v3 has a saved `ContentTypeSelection` on its project record — i.e. nobody is routing around the step. Verified by inspecting `database-v3/projects.json` on the internal instance, not by telemetry.
- **60 days:** at least one migration into a **non-empty** destination has been completed using a conflict mode other than `Use source`, confirming the control is understood and reachable. If this has not happened, treat it as evidence for R-1 rather than as evidence the control is unneeded.
- **90 days:** zero reported incidents of a destination schema being overwritten unintentionally. A single such incident should reopen the §7.1 default decision immediately.
- **Ongoing:** no reported case of a selection being lost between visits (G-4).

All four are qualitative or manual. That is a consequence of §10, not an oversight.

## 12. Dependencies & stakeholders

Technical dependencies: [feature.md §13](./feature.md) and [trd.md §7](./trd.md).

- **Product stakeholders:** Eng lead — Chirag Chavan. PM / Design lead / QA lead / comms owner — `TBD` (PQ-1).
- **Cross-team dependencies:**
  - **`migration-wizard-chrome` owners** (feature.md DEP-1) — this feature changes their `content-mapping` step's `actionLabel` to `Move to review` and supplies the step's status line and gate through the existing step-gate contract. The label change lands in their file and needs their sign-off. Note the gate contract was extended during the audit work (a `statusLine` channel on `StepGate`); this feature is its second consumer, which is the point at which the abstraction should be reviewed rather than assumed.
  - **`cs-source-selection` owners** (feature.md DEP-2) — this feature reads `content_types/schema.json` from the folder their export writes, and derives the reference graph from it. It needs that file's shape to be stable. Unlike Audit, this feature does **not** work around any known exporter defect.
  - **`cs-destination-selection` owners** (feature.md DEP-3) — this feature is the second consumer of the stored, encrypted destination management token. It reads destination content types with it. Any change to token scope must keep `content_types` readable.
  - **Interfaces 2 and 3 owners — the same team, later** (feature.md DEP-6) — they consume `ContentTypeSelection`. The record's shape, and specifically the conflict-mode vocabulary (`source` / `dest` / `merge`), is the contract between this feature and theirs. Worth agreeing **before** ship: changing it after selections exist in the wild means a data migration. This is the same class of coupling that INT-4 flagged for Audit.
  - **`cs-audit-report` owners — same team** (feature.md DEP-7) — no runtime dependency. Recorded because feature.md A-4 asserts audit exclusions do not filter this list, and that assertion should be confirmed by whoever owns the audit rather than assumed.

## 13. Risks & mitigations (product-side)

See [feature.md §15](./feature.md) for R-1 … R-5. Product-side framing of the two that are decisions rather than hazards:

- **R-1 (`Use source` default is destructive)** — this is an accepted product decision, not an unmitigated risk. It was chosen over `Merge` with the trade-off stated. The mitigation is informational only, and §10 means we **cannot measure whether it works**. Recommended review trigger: the 60-day criterion in §11. If no operator has ever chosen a non-default mode, the default should be revisited.
- **R-2 (a selection with unsatisfiable references can be saved)** — accepted for v1, because dependency resolution is a non-goal. The product consequence is that this screen can produce a selection that is guaranteed to fail later. Feature.md Q-6 (mirrored as PQ-4) asks whether a warning belongs at save time or at Review scope; leaving it unanswered means it lands nowhere.
- **R-3 (uid matching under-reports conflicts)** — product impact is that a real conflict is invisible and the operator is never offered the choice, which silently defeats G-2 for hand-built destination stacks. PQ-5 mirrors feature.md Q-2.

## 14. Timeline & milestones (high level)

Follows the TDD pipeline used by every prior v3 feature; phases are gated, not dated.

| Milestone | Contents | Gate |
|---|---|---|
| M-1 — Test matrix | test-cases skill over feature.md + this PRD + the TRD | Matrix reviewed; automatable rows identified |
| M-2 — Tests written (TDD Phase 1) | Paired positive/negative tests for every automatable row | All red for the right reason; 1:1 pairing exact |
| M-3 — Functionality (TDD Phase 2) | Server inventory + graph + persistence; client panel, conflict control, confirmation dialog | Every new test green; `ui` and `api` suites green |
| M-4 — Pixel pass (TDD Phase 3) | Match the design reference across every state | Zero unexplained visual diffs |
| M-5 — Report | `tdd.md` | Written regardless of outcome |

No calendar dates — this repository has not used them for prior features.

## 15. Open questions

- **PQ-1:** Who owns PM, design, QA and comms for this feature? — owner: Chirag Chavan — needed by: M-1.
- **PQ-2:** Should the persistence endpoint record the chosen conflict modes and the untick-confirmation outcomes for measurement (G-5, G-3 post-launch)? This is a decision about logging user choices, not an incidental log line. — owner: Chirag Chavan — needed by: M-3.
- **PQ-3:** Numeric target for G-4, if any — mirrors [feature.md Q-4](./feature.md) — owner: Chirag Chavan — needed by: M-1.
- **PQ-4:** Should an unsatisfiable-reference warning fire at save / `Move to review`, or is that entirely Review scope's job? — mirrors [feature.md Q-6](./feature.md) — owner: Chirag Chavan — needed by: M-3.
- **PQ-5:** Should `already in destination` fall back to title matching when no uid matches (R-3)? — mirrors [feature.md Q-2](./feature.md) — owner: Chirag Chavan — needed by: M-3.
- **PQ-6:** What happens to *entries* of a content type saved with `Merge`? Deferred during specification and still open; it does not block this feature but blocks interface 3 and Migrate. — mirrors [feature.md Q-1](./feature.md) — owner: Chirag Chavan — needed by: before interface 3 is specced.

## 16. References

- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Migration Tool Prototype"** — the reference for all three Content mapping interfaces; this feature covers only its first screen (content type list, search, load-more, `already in destination`, conflict control, panel save control).
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Content Map and Audit"** — earlier combined exploration, superseded for this feature.
- [feature.md](./feature.md) — the behavioural contract.
- [trd.md](./trd.md) — the technical design.
- `docs/features/cs-audit-report/prd.md` — the precedent this PRD follows for rollout, analytics and post-launch measurement.
