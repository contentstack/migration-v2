# PRD: Migration Wizard Chrome (shared header, step tracker & footer)

- **Slug:** `migration-wizard-chrome`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** `TBD — Open Question` (PQ-3)
- **Engineering lead:** Chirag Chavan
- **Design lead:** `TBD — Open Question` (PQ-3)
- **Created:** 2026-07-30
- **Last updated:** 2026-07-30

## 1. TL;DR

One shared frame — app bar, seven-step tracker, sticky footer — wraps every step of the v3 Contentstack-to-Contentstack migration wizard, so the wizard finally looks and behaves like a wizard. It owns step navigation (Back, the gated advance action, and jumping back to completed steps); the step panels own only their own content. Ships around the Destination panel first, with the already-shipped Source panel migrated in a follow-up.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product delta: this is infrastructure with a compounding return. Five of the seven steps are still unbuilt, and every one of them would otherwise re-invent its own navigation — the Destination panel already grew a bespoke full-width advance button precisely because there was no shared footer to put one in. Building the frame now means each subsequent step is a panel plus a small amount of configuration, rather than a panel plus a re-litigation of navigation. The cost of *not* doing it rises with every step shipped. No market-sizing data; this is not a differentiating feature, it is table stakes for a multi-step tool.

## 3. Target users

See [feature.md §3](./feature.md).

Primary persona for this release: **Migration operator**. The Partner/consultant persona benefits mainly from the tracker's completion marks when resuming across sessions (feature.md UC-5), which depends on step-completion being derivable — see PQ-1.

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for goal statements. Targets are unresolved for the same reason as both sibling features: no product-analytics pipeline is confirmed for this self-hosted tool (see §10, PQ-2).

- **G-1:** Users can always tell which step they are on and how many remain.
  - **Metric:** proportion of migration sessions reaching Content mapping without a support/clarification question about step order.
  - **Target:** `TBD — Open Question` (PQ-1).
  - **Type:** north-star.
- **G-2:** Every step presents the same navigation affordances in the same place.
  - **Metric:** count of migration steps shipping their own bespoke header, tracker or Back control after this lands.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.
- **G-3:** Backward navigation never loses saved work.
  - **Metric:** reported cases of navigating back discarding a step's persisted selection.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.
- **G-4:** The advance action is never enabled when its step's conditions are unmet.
  - **Metric:** cases of a user advancing past a step whose gate was unsatisfied.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.

## 5. Non-goals

See [feature.md §5](./feature.md).

Product-side additions: no product-analytics instrumentation is committed in this release (PQ-2), matching both sibling features; no i18n/localisation of the chrome's copy for first ship (English only, matching Source and Destination); no change to the v2 application's navigation.

## 6. Requirements (prioritized)

Every `FR-*` from feature.md, with a launch priority. Full text lives in [feature.md §8](./feature.md). Priorities inherit from the parent use case's priority in feature.md §6 unless noted.

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | App bar shows product mark + "Migrate to Contentstack" | P0 | The frame's identity; nothing else anchors the page |
| FR-1.2 | App bar shows "Step {n} of 7 · {title}" | P0 | This is G-1's core promise |
| FR-1.3 | App bar shows the source indicator | P1 | Informational; UC-2 is P1 |
| FR-1.4 | Source name read from persisted source, not hard-coded | P1 | Confirmed decision; without it the indicator is a lie |
| FR-1.5 | "Source: Not selected" when none persisted | P1 | Prevents a blank/broken-looking indicator |
| FR-1.6 | Long source name truncates, no layout shift | P2 | Polish; only bites with long stack names |
| FR-2.1 | Tracker renders the seven steps in order | P0 | The tracker *is* the feature |
| FR-2.2 | Earlier steps marked complete with a check | P0 | Half of G-1; **depends on PQ-1** |
| FR-2.3 | Current step marked active | P0 | Half of G-1 |
| FR-2.4 | Later steps marked upcoming, de-emphasised | P0 | Distinguishes done from pending |
| FR-2.5 | Completed + current interactive; upcoming not | P1 | Confirmed decision (diverges from the design's free navigation); **depends on PQ-1** |
| FR-2.6 | Clicking a completed step navigates there | P1 | UC-5 is P1 |
| FR-2.7 | Clicking the current step changes nothing | P2 | Correctness detail, not a user need |
| FR-3.1 | Footer stays pinned while the panel scrolls | P1 | The advance action must stay reachable on long panels |
| FR-3.2 | Footer contains Back, status line, primary action | P0 | The footer's whole contract |
| FR-3.3 | Back disabled on the first step | P0 | Confirmed decision; prevents a dead control |
| FR-3.4 | Back navigates one step earlier | P0 | UC-4 is P0 |
| FR-3.5 | Status line determined by the current step | P1 | UC-6 is P1 |
| FR-3.6 | Status line reflects step state where it varies | P1 | Only the Audit step needs this today |
| FR-4.1 | Primary action disabled when the gate is unsatisfied | P0 | This is G-4 |
| FR-4.2 | Primary action label determined by the step | P0 | A mislabelled advance action is worse than none |
| FR-4.3 | Disabled action reveals what is missing on hover | P1 | Guidance, not a gate |
| FR-4.4 | Click asks the panel to advance; navigate only on success | P0 | Without this, Destination could advance without persisting |
| FR-4.5 | Footer action and any in-panel action share one gate + action | P0 | Forced by keeping both buttons (feature.md C-2); the two disagreeing is a real defect class |
| FR-4.6 | Action non-interactive while advance work is in flight | P0 | Prevents double-creating a stack or a management token |
| FR-5.1 | Primary-action labels per step | P0 | Two of seven still `TBD` (PQ-4) |
| FR-5.2 | Footer status line per step | P1 | Two of seven still `TBD` (PQ-4) |
| FR-5.3 | Audit status line varies with audit state | P1 | Copy is fully specified; the Audit step itself is not built |
| FR-5.4 | Disabled-action explanation copy | P1 | Only Source and Audit specified (PQ-4) |
| FR-5.5 | App-bar step titles | P1 | Four of seven still `TBD` (PQ-5) |
| FR-6.1 | Chrome owns navigation; panels do not navigate | P0 | Confirmed decision; the architectural core |
| FR-6.2 | Current step derived from the route | P0 | Reload/share must land on the same step |
| FR-6.3 | Panels render inside the chrome | P0 | Otherwise there is no frame |
| FR-6.4 | Panels can publish gate state, reason, advance work | P0 | The StepGate contract every future step depends on |
| FR-6.5 | A panel publishing nothing is treated as satisfied | P0 | Prevents a step with no conditions being permanently blocked |

**Priority definitions:** P0 — must ship for launch; P1 — should ship, missing degrades but doesn't block; P2 — nice to have, fast-follow OK.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flow).

Product-side UX decisions:
- **Copy:** load-bearing strings are fixed by the design and quoted verbatim in feature.md's ACs (the five known primary-action labels, four known status lines, the Audit step's three status variants, and two disabled-state explanations). English only for first ship. Gaps for Migrate and Verify (PQ-4) and four app-bar titles (PQ-5) must close before those steps ship — but they do **not** block this feature, since those steps do not exist yet.
- **Two advance buttons, deliberately.** Confirmed decision: the Destination panel keeps its own in-panel button alongside the footer gate. FR-4.5 makes them share one gate state and one action so they cannot disagree. This is a knowingly accepted redundancy, not an oversight — revisit if user testing shows it confuses (PR-2).
- **Navigation is deliberately stricter than the prototype.** The design lets a user click freely among the first five steps; we allow only completed steps and the current one. Skipping ahead past incomplete work is a worse failure than a slightly less flexible tracker.
- **First-run guidance:** none planned. The tracker is itself the orientation device.

## 8. Non-functional requirements

See [feature.md §9](./feature.md). No additional product-side NFRs beyond English-only first ship. Note that two NFRs carry unresolved numbers — NFR-4's performance budget (PQ-6) and NFR-6's narrow-viewport behaviour (PQ-7) — and NFR-6 is the one most likely to surface in review, since the design provides no mobile layout at all.

## 9. Launch & rollout plan

- **Rollout mechanism:** **Same as both sibling features** — gated purely by the `/v3` route existing. There is no feature-flag system in this repo. (Confirmed decision.)
- **Feature flag name:** none (see [trd.md §14](./trd.md)).
- **Cohort staging:**
  - **Stage 1 (internal):** the chrome wraps the Destination panel only; the Source panel continues to render as it does today. Team/dev exercise both.
  - **Stage 2 (internal):** the Source panel is migrated into the chrome, co-ordinated with `cs-source-selection`'s owner, and its own page-level navigation is removed.
  - **Stage 3 (opt-in):** v3 entry point linked for selected users/self-hosters — the same cohort as the sibling features, since they arrive at the same wizard.
  - **GA:** part of v3 becoming the default migration entry point. Not owned by this feature alone.
- **Kill switch:** stop exposing/linking the v3 wizard route. No runtime toggle. Note the asymmetry: because Stage 2 removes Source's own navigation, rolling the chrome back *after* Stage 2 leaves Source with no navigation at all — see [trd.md §15](./trd.md).
- **Comms plan:** changelog + internal note when the chrome ships, and a second note when Source migrates. Owner `TBD` (PQ-3).

## 10. Analytics & instrumentation

No product-analytics pipeline is confirmed for this self-hosted tool, matching both sibling features. The §4 metrics therefore cannot be measured from client events today.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `TBD — Open Question (PQ-2)` | — | — | G-1 |
| `wizard_step_changed` (proposed) | Any navigation between steps | `projectId`, `fromStep`, `toStep`, `via` (back / gate / tracker) | G-2, G-3 |
| `wizard_gate_blocked` (proposed) | Primary action rendered disabled | `projectId`, `step`, `reason` | G-4 |
| `wizard_advance_failed` (proposed) | Panel advance work reports failure | `projectId`, `step` | G-4 |

The three proposed events map to feature.md NFR-7, which already requires step transitions to be logged server-side or client-side with the project identifier and from/to step. Interim measurement relies on those logs rather than a telemetry product. Whether to add real telemetry is PQ-2.

## 11. Post-launch success criteria

Gated on PQ-1/PQ-2 (targets + telemetry). Until those resolve, success is assessed qualitatively.

- **7 days:** the chrome renders on every wizard step it wraps, with Back, the gate and tracker navigation working, and no P0 defects.
- **30 days:** the Source panel is migrated into the chrome (Stage 2) with its bespoke navigation removed, and at least one new step (Audit or Content mapping) is built as a panel-plus-config with no new navigation code.
- **60 days:** `TBD` — G-1 threshold (PQ-1).
- **90 days:** `TBD`.
- **Regression guardrails:** G-2 (0 steps with bespoke chrome), G-3 (0 lost selections on backward navigation) and G-4 (0 advances past an unsatisfied gate) must hold.

## 12. Dependencies & stakeholders

Technical dependencies: [feature.md §13](./feature.md) and [trd.md §7](./trd.md).

- **Product stakeholders:** Eng lead — Chirag Chavan. PM / Design lead / QA lead / comms owner — `TBD` (PQ-3).
- **Cross-team dependencies:**
  - **`cs-source-selection` owner (Ayush Sahu)** — two distinct asks. (a) This feature reads their persisted `source` for the app bar's stack name (feature.md DEP-1). (b) Stage 2 removes their panel's own page-level navigation (feature.md DEP-3, R-4) — that is a change to shipped code and needs their sign-off before it starts, not after.
  - **`cs-destination-selection`** — the first `StepGate` consumer (feature.md DEP-2). Its FR-6.1 gating and FR-6.3 advance work become this chrome's first integration, and its in-panel button is the reason FR-4.5 exists. Same eng owner, so no cross-team blocker.
  - **Owners of the five unbuilt steps** (Audit, Content mapping, Preview, Migrate, Verify — feature.md DEP-6) — each will need to publish a `StepGate` and supply its copy strings. Not blocking this feature; blocking *their* specs.
  - **Shared `/v3` design-system tokens** (feature.md DEP-4) — not a team dependency, but a shared asset: the chrome must consume the existing tokens in `ui/v3/styles/theme.css` rather than introduce values. Note that three of those primitives are already recorded as drifting from the design system in `cs-destination-selection`'s TDD report, so the footer's buttons will inherit that drift; fixing it is a single repo-wide change needing both features' owners, not a per-feature override ([trd.md](./trd.md) TRR-5).
  - **Whoever owns step-completion** (feature.md DEP-5 / PQ-1) — resolved in direction by the confirmed decision to derive completion from each step's own persisted document, so no new owner is required. Confirm with the Source owner that a "succeeded export" is the right completeness test for their step.

## 13. Risks & mitigations (product-side)

- **PR-1:** Step completion is derived from each step's persisted document (confirmed decision), but five of the seven steps have no persisted document yet — so until they exist, the tracker can only ever mark Source and Destination complete, and every later step reads as incomplete regardless of what the user has done — medium/high — acceptable while those steps don't exist, but it means the tracker's completion marks are only as truthful as the steps behind them; do not present the tracker as a progress guarantee until more steps persist state.
- **PR-2:** Two advance buttons on the Destination step (footer gate + in-panel) is a knowingly accepted redundancy — users may hesitate over which is "the real one" — medium/low — FR-4.5 guarantees identical behaviour, so the worst case is mild confusion, not a wrong outcome; revisit if user testing objects.
- **PR-3:** The chrome is navigation infrastructure for five steps that don't exist, so its contract is being designed against one real consumer (Destination) and one legacy one (Source) — medium/medium — keep the step list and copy data-driven so adding a step is configuration; expect one contract revision when the second real gate lands.
- **PR-4:** The design provides no narrow-viewport layout for a seven-step tracker (PQ-7) — medium/medium — decide the treatment before implementation; shipping a horizontally-scrolling page would be a visible regression against the current single-panel pages.
- **PR-5:** Stage 2 edits a shipped feature's navigation. If it slips, the product sits indefinitely in Stage 1 with Source and Destination looking inconsistent — medium/medium — get the Source owner's agreement to the Stage 2 change before Stage 1 ships, so the inconsistency window is bounded.

## 14. Timeline & milestones (high level)

- **Spec approved:** 2026-07-30 (feature.md Draft).
- **Design approved:** external design exists (shared Claude Design page, same as both sibling features); sign-off `TBD`. Four copy gaps (PQ-4, PQ-5) and the narrow-viewport question (PQ-7) are open against it.
- **Engineering start:** `TBD` — not blocked on any sibling feature, since Stage 1 wraps only the Destination panel, which is already built.
- **Feature-complete (Stage 1):** `TBD`.
- **Source migrated (Stage 2):** `TBD` — needs `cs-source-selection` owner sign-off.
- **GA:** `TBD` (shared with the sibling features' GA decision).

Task breakdown: [trd.md §17](./trd.md).

## 15. Open questions

- **PQ-1:** G-1 success threshold, and confirmation that "a step's persisted document exists and is valid" is the right completeness test for each step (feature.md Q-2, resolved in direction, not in detail). — owner: Product/Eng — needed by: implementation start.
- **PQ-2:** Is any product-analytics/telemetry added, or is measurement logs-only/qualitative? — owner: Product/Eng — needed by: GA.
- **PQ-3:** Named stakeholders (PM, Design lead, QA lead, comms owner). — owner: Chirag Chavan — needed by: engineering start. (feature.md Q-1's owner set)
- **PQ-4:** Primary-action labels, footer status lines and disabled-state explanations for Migrate and Verify. — owner: Design — needed by: those steps' specs. (feature.md Q-3)
- **PQ-5:** App-bar step titles for Source, Destination, Migrate and Verify — the design shows only three, and they are not simply the tracker labels. — owner: Design — needed by: implementation start. (feature.md Q-4)
- **PQ-6:** Performance budget for the source-indicator read (NFR-4). — owner: Eng — needed by: TRD sign-off. (feature.md Q-5)
- **PQ-7:** Narrow-viewport treatment for the seven-step tracker. — owner: Design — needed by: implementation start. (feature.md Q-7)
- **PQ-8:** The design constrains the app bar and footer to a 1100px centred column while the shipped Destination panel uses 1180px — which is correct, and should both match? — owner: Design — needed by: implementation start. (feature.md Q-10)
- **PQ-9:** Does `cs-destination-selection`'s "After you proceed" copy need updating now that the seven-step list is confirmed canonical? — owner: Product/Design — needed by: next revision of that spec. (feature.md Q-11)

## 16. References

- [feature.md](./feature.md)
- [trd.md](./trd.md)
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**; this feature cites the app bar, step tracker and sticky footer regions of that page. The step panels on the same page are out of scope.
- [`../cs-source-selection/feature.md`](../cs-source-selection/feature.md), [`../cs-source-selection/prd.md`](../cs-source-selection/prd.md) — sibling feature whose persisted source this reads, and whose panel Stage 2 migrates.
- [`../cs-destination-selection/feature.md`](../cs-destination-selection/feature.md), [`../cs-destination-selection/prd.md`](../cs-destination-selection/prd.md) — sibling feature; the chrome's first `StepGate` consumer.
