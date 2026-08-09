# PRD: Audit Report (source stack health check)

- **Slug:** `cs-audit-report`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** `TBD — Open Question` (PQ-1)
- **Engineering lead:** Chirag Chavan
- **Design lead:** `TBD — Open Question` (PQ-1)
- **Created:** 2026-08-05
- **Last updated:** 2026-08-05

## 1. TL;DR

Step 2 of the v3 migration wizard currently renders the words *"The Audit step is not built yet."* This feature fills it: after a source export finishes, the page scans the exported files and reports what is unused or left behind — unpublished entries, unreferenced assets, empty content types, unreferenced global fields — and lets a migration engineer switch off whole categories or individual items before anything reaches the destination stack. Everything is included by default, and every exclusion is reversible up to the moment they continue.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product-side context to add:

- **The cost is paid in the wrong place.** Junk that migrates has to be cleaned up in the destination — a stack the customer has just started using, where they have the least context and the least tooling. Cleaning it in the source, before the migration, costs a fraction as much.
- **This is also the step that makes the migration defensible.** A migration engineer working on someone else's stack currently has no artefact showing what was and wasn't brought over. The audit is the first point in the flow that produces one.
- **No research or market data backs this.** The problem is observed directly from the tool's own behaviour and from the exported data of real stacks; no user study exists. Recorded as a known gap rather than dressed up.

## 3. Target users

See [feature.md §3](./feature.md).

- **Primary persona for this release: the migration engineer.** Every P0 requirement is scoped to what they need — see the flagged inventory, act on it in bulk or per item, continue with the decision recorded.
- **The content operations owner is served incidentally, not designed for.** They benefit from UC-3 (per-item exclusion) but this release adds nothing to help them find *their* content specifically — no ownership filter, no "changed since" filter. Deliberate scope cut, not an oversight.
- **Adoption assumption:** users reach this page because the wizard routes them through it, not because they seek it out. So the page must be useful without training and must not require a decision — continuing with everything included is a valid outcome (FR-7.1).

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for the goal statements.

- **G-1:** Every flagged item is reachable without leaving the page.
  - **Metric:** proportion of flagged items reachable via filter + search + pagination — verified by test, not telemetry.
  - **Target:** 100%, at build time (AC-4.1 through AC-4.4).
  - **Type:** guardrail-not-to-regress.
- **G-2:** Excluding content is reversible at every point before Continue.
  - **Metric:** every exclusion action has an inverse in ≤ 2 clicks; "Include everything" restores the pre-audit state exactly.
  - **Target:** 100%, at build time (AC-2.3, AC-5.3).
  - **Type:** guardrail-not-to-regress.
- **G-3:** The page never reports a clean result for a check it could not run.
  - **Metric:** count of cases where a `Not present` or `Unavailable` check renders as `0` or "All clean".
  - **Target:** 0, at build time (AC-9.1, AC-9.3) and 0 in any bug report after ship.
  - **Type:** north-star for this feature — it is the difference between a health check and a false clean bill of health.
- **G-4:** Decisions survive leaving the step and survive a re-export.
  - **Metric:** persisted decisions reapplied on revisit and after re-export.
  - **Target:** 100%, at build time (AC-7.1, AC-8.3).
  - **Type:** guardrail-not-to-regress.
- **G-5:** Reduce post-migration cleanup in the destination stack.
  - **Metric:** `TBD — Open Question` (PQ-2, feature.md Q-1).
  - **Target:** `TBD`.
  - **Type:** north-star, unmeasurable today.
- **G-6:** Users act on the audit rather than skipping it.
  - **Metric:** `TBD — Open Question` (PQ-2, feature.md Q-1).
  - **Target:** `TBD`.
  - **Type:** leading indicator, unmeasurable today.

**Note on G-1 through G-4:** these are verified by the test suite rather than by telemetry, because no analytics pipeline exists (§10). That is a real limitation — it means we can prove the feature *works* but not that it *helps*. G-5 and G-6, the two goals that would prove it helps, are the two we cannot measure.

## 5. Non-goals

See [feature.md §5](./feature.md).

Product-side scope cuts that surfaced during prioritization:

- **No per-item audit trail.** The page records what was excluded, not who excluded it or when. Sufficient for a single-operator tool; would need revisiting if migrations become collaborative.
- **No export of the audit report.** A user cannot download or share the findings as a document. Asked for by nobody yet, and the page itself is the artefact for now.
- **No "why is this flagged?" drill-down.** A row states its status (`Never published`, `Unused`) but does not explain the evidence — e.g. which entries do reference an asset. Deferred; the guidance text on each card carries the explanation at category level instead.
- **No environment-level publish reporting.** Deferred pending feature.md Q-4; requires the export to capture `environments/`.

## 6. Requirements (prioritized)

Every `FR-*` from [feature.md §8](./feature.md), with a priority. Not renumbered. Grouped as the spec groups them.

**Reading the export**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | Findings computed server-side | P0 | The browser cannot read the filesystem. Nothing works without this. |
| FR-1.2 | Accept modules at root or in a branch sub-folder | P0 | Our exporter writes one shape, the CLI another. Both must load. |
| FR-1.3 | Accept both entry-file naming forms | P0 | Same reason as FR-1.2. |
| FR-1.4 | Treat each record as (uid, locale) | P0 | The denominator and the unpublished check both depend on it. |
| FR-1.5 | One unreadable file degrades one check, not the audit | P0 | Otherwise a single bad file makes the page unusable. |
| FR-1.6 | Module presence read from the folder, not the stored selection | P0 | The stored selection can disagree with what was written. |
| FR-1.7 | Ignore fallback records | **P0** | Without it the page reports 55 unpublished where the truth is 8 on the reference export. A wrong headline number, not a cosmetic issue. |

**The four checks**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-2.1 | Exactly four checks, with the given labels | P0 | |
| FR-2.2 | Unpublished = no publish row for the folder locale | P0 | The check's definition. |
| FR-2.3 | Still flagged when other locales are published but this one is not | P0 | Reinforces FR-2.2. Corrected 2026-08-05 — previously worded as its own inverse. |
| FR-2.4 | Never substitute `_in_progress` for publish state | P0 | A tempting shortcut that would silently misreport. |
| FR-2.5 | Unused assets — scan every reference location | P0 | |
| FR-2.6 | Uncertain ⇒ treat as used | **P0** | The safety rule. Over-reporting causes users to delete live assets. |
| FR-2.7 | Empty content types | P0 | |
| FR-2.8 | Unused global fields | P0 | |
| FR-2.9 | Exclude `is_dir` assets from counts | P1 | No export we currently produce contains folder assets, so nothing works differently today. Correctness kept, urgency low. |
| FR-2.10 | Each check resolves Done / Not present / Unavailable | P0 | |
| FR-2.11 | Never render `0` or "All clean" for an unrun check | **P0** | This is G-3. |
| FR-2.12 | Variants: scan them; caveat when absent | **Split — caveat P0, scan P1** | The caveat text is what stops a user deleting the 7 variant-only assets, and costs a sentence. Reading variant directories has nothing to read until the exporter fetches them. |

**Impact panel**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-3.1 | Show migrating / total / bar / impact line | P0 | |
| FR-3.2 | Total = content types + global fields + assets + entry records | P0 | |
| FR-3.3 | Migrating = total − excluded | P0 | |
| FR-3.4 | Excluded derived from resolved per-item decisions only | P0 | The reference prototype's double-count bug. |
| FR-3.5 | Nothing-excluded impact line, verbatim | P0 | |
| FR-3.6 | Excluded impact line, pluralised | P0 | |
| FR-3.7 | All four values update in the same render | P0 | |

**Category cards**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-4.1 | One card per excludable flagged category | P0 | |
| FR-4.2 | Card contents | P0 | |
| FR-4.3 | Switch reads Included/Excluded, keyboard-operable | P0 | NFR-8. |
| FR-4.4 | Excluded card: danger border + strip | P0 | |
| FR-4.5 | "Review items ↓" opens, filters and scrolls | P1 | The table is open by default and has its own filter pills, so this is a shortcut, not the only route. |
| FR-4.6 | No card for a zero-count category | P0 | |

**Informational cards**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-5.1 | One card per non-excludable category | P0 | |
| FR-5.2 | No means of exclusion on these cards | P0 | Enforces the A-4 product rule. |
| FR-5.3 | "Keeping" vs "All clean" pill | P0 | Copy pending PQ-3 / feature.md Q-8. |
| FR-5.4 | `Not present` / `Unavailable` replaces the pill | P0 | Part of G-3. |

**Flagged items table**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-6.1 | Expanded by default, collapsible | P0 | |
| FR-6.2 | Six named columns | P0 | |
| FR-6.3 | Paginated at 50 rows | P0 | Without it a large stack renders tens of thousands of rows. Size pending PQ-4 / feature.md Q-7. |
| FR-6.4 | Filter / search / page applied server-side | P0 | Forced by FR-6.3 — the client holds one page. |
| FR-6.5 | Five filter pills with counts | P0 | Part of G-1. |
| FR-6.6 | Case-insensitive search over four fields | P0 | Part of G-1. |
| FR-6.7 | Per-row checkbox for excludable rows | P0 | UC-3. |
| FR-6.8 | Disabled checkbox + explanation for locked rows | P0 | |
| FR-6.9 | Excluded rows visually distinguished | P0 | With NFR-9, not by colour alone. |
| FR-6.10 | "No items match your filters." | P0 | |
| FR-6.11 | Bulk button label flips | P1 | UC-5 is P1. |
| FR-6.12 | Bulk button acts on the whole set | P1 | UC-5 is P1 — but if FR-6.11 ships, this MUST ship with it, or the button lies about its scope. |
| FR-6.13 | "Include everything" clears categories and overrides | P1 | Same coupling as FR-6.12. |

**Decisions and persistence**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-7.1 | Everything included by default | P0 | |
| FR-7.2 | Category state + per-item overrides | P0 | |
| FR-7.2a | A category toggle clears that category's overrides | P0 | Resolved 2026-08-05 (was PQ-5). Without it a toggle round-trip silently resurrects earlier exceptions. |
| FR-7.3 | Collision-proof item keys | P0 | Also the contract Content mapping will read (DEP-4). |
| FR-7.4 | Category state is a standing policy | P0 | |
| FR-7.5 | Persisted against the project, scoped; written once on Continue | P0 | Write moment resolved 2026-08-05 (was PQ-6). |
| FR-7.6 | Survive navigation and re-export | P0 | This is G-4. |
| FR-7.7 | Stale overrides ignored, not deleted | P0 | Prevents a crash on re-export. |
| FR-7.8 | Findings cached, invalidated on re-export | P0 | Without it every visit re-scans. |
| FR-7.9 | Findings never in the project record | P0 | The project list returns whole records to the browser. |

**Footer gate and chrome**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-8.1 | Primary action disabled while analyzing | P0 | |
| FR-8.2 | Three footer status lines, verbatim | P0 | Already declared in the chrome's step definition. |
| FR-8.3 | Labels come from the shared step definition | P0 | A-6 — the design's own copy contradicts its tracker. |
| FR-8.4 | Persist before advancing; don't advance on failure | P0 | |

**Toast**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-9.1 | Shared toast added to the chrome, not this page | P1 | |
| FR-9.2 | Toast on five actions | P1 | The page is fully usable without toasts: FR-9.4 already requires the impact panel and the control itself to reflect every change, so the toast is confirmation of something already visible. |
| FR-9.3 | Self-dismiss after 2600ms | P1 | |
| FR-9.4 | Toast is never the only indication | **P0** | This one stays P0 *because* the toast is P1 — it is what makes deferring the toast safe. |

**States and errors**

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-10.1 | Analyzing state: spinner, four rows, counter | P0 | |
| FR-10.2 | Analyzing state explains auto-run and caching | P0 | |
| FR-10.3 | "Re-run audit" in the ready state only | P1 | UC-8 is P1. |
| FR-10.4 | Error state + route back to Source + gate closed | P0 | Without it a broken export strands the user. |
| FR-10.5 | Error state is not dressed as a completed audit | P0 | Part of G-3. |
| FR-10.6 | No customer content beyond the FR-6.2 columns | P0 | NFR-7. |

**Priority definitions:**
- **P0** — must ship for launch; the feature does not work without it.
- **P1** — should ship for launch; missing degrades but doesn't block.
- **P2** — nice to have; fast-follow acceptable. *(None assigned. Everything in this spec is either required for the page to be correct or a deliberate fast-follow; nothing is decorative.)*

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Product-side UX decisions the spec doesn't cover:

- **Copy tone: plain and non-alarming.** The page reports on a customer's content hygiene, which is easy to make sound accusatory. "Worth a look" and "Just so you know" set the register deliberately — findings are offered, not judgements. Error and empty-state copy must match that register.
- **The default must be safe, not clever.** Everything included, nothing pre-selected for exclusion (FR-7.1). We do not pre-tick "obviously dead" content, because our confidence in what is dead is exactly the thing the user is here to check.
- **Uncertainty is stated, not hidden.** Where a check could not run, the page says so in the same visual slot where a count would go (FR-2.11, FR-5.4). No silent zeros, no optimistic defaults. This is the single most important UX rule in the feature.
- **Empty-state approach:** a clean stack is a success state, not an empty state — "All clean" pills, no cards under "Worth a look", and an enabled Continue. It must not look like a page that failed to load (EC-6).
- **First-run guidance:** the helper strip under the impact panel is the whole of it. No tour, no modal, no dismissible tip.
- **i18n:** none. The tool's UI is English-only, consistent with v2 and the rest of v3. Note that the *content* being audited is multilingual — locale codes appear in the table — but the chrome around it is not translated.
- **Error copy standard:** every error state says what happened, and offers the next action. FR-10.4's route back to the Source step is the pattern; a dead-end error with no action is a defect.

## 8. Non-functional requirements

See [feature.md §9](./feature.md).

Product-side additions:

- **No brand or marketing constraints** — internal tool, no external-facing surface.
- **No licensing or compliance sign-off required.** The feature reads files already on the operator's own disk, makes no network calls (DEP-5), and introduces no new data collection.
- **Accessibility is a launch requirement, not a follow-up.** NFR-8 and NFR-9 are P0 in practice: the entire page is a grid of toggles whose meaning is carried by colour in the reference design, and the design as drawn would not pass without the text labels NFR-9 mandates.

## 9. Launch & rollout plan

- **Rollout mechanism:** **same as Source, Destination and the project dashboard** — gated purely by the `/v3` route existing. There is no feature-flag system in this repository. (Established convention, not a new decision.)
- **Feature flag name:** none (see [trd.md §14](./trd.md)).
- **Cohort staging:**
  - **Stage 1 (internal):** the team reaches the Audit step through the existing wizard once the `api/v3` audit endpoints deploy. The step is already in the tracker, so no routing change is needed to expose it — the placeholder body is simply replaced.
  - **Stage 2 (opt-in):** available to whoever is already using the v3 wizard; no separate cohort, because the step is part of a flow they are already in.
  - **GA:** part of v3 becoming the default migration entry point. Not owned by this feature alone.
- **Kill switch:** revert the panel body to the existing placeholder — a one-line change in `ui/v3/pages/Migration/index.tsx` — and/or stop deploying the audit endpoints. No runtime toggle. Note this is *softer* than the equivalent for Source or Destination: because the Audit step already exists in the tracker and the placeholder is already the fallback, disabling this feature returns the wizard to a state it shipped in.
- **Comms plan:** changelog entry plus an internal note. Owner `TBD` (PQ-1).

## 10. Analytics & instrumentation

No product-analytics pipeline exists for this self-hosted tool, matching the precedent set by Source, Destination and the project dashboard. The §4 metrics therefore split into two groups: G-1 through G-4 are verified by the **test suite** at build time, and G-5/G-6 are **not measurable at all** today.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `TBD — Open Question` (PQ-2) | — | — | G-5, G-6 |

Interim measurement relies on the structured server logs NFR-13 already requires — per audit run: project id, each check's resolved state, each check's flagged count, total duration. Those lines can answer "are audits running, how long do they take, and what do they find", which approximates G-6 in aggregate. They deliberately cannot answer "did the user act on it", because the decisions endpoint would have to log exclusion counts to do so, and that is a product decision rather than an incidental one — folded into PQ-2.

## 11. Post-launch success criteria

Given §10, these are qualitative or log-derived rather than dashboarded.

- **7 days:** no bug report of the G-3 class — a check reporting `0` or "All clean" when it did not actually run. This is the one that must be zero, because it is the failure that misleads silently.
- **30 days:** no report of an asset flagged unused that turned out to be referenced (R-1 / FR-2.6 holding in practice). Server logs show audits completing within NFR-1 on real stacks.
- **60 days:** at least one migration where the operator can point at the audit as the record of what was left behind — the qualitative version of G-5, pending PQ-2.
- **90 days:** decide whether telemetry is worth adding, using 60 days of log evidence about scan durations and finding counts (PQ-2).
- **Regression guardrails:**
  - Source export and the project dashboard must not regress — this feature only *reads* the export and adds one optional field to the project record.
  - Existing api and ui suites stay green; the audit adds tests, it does not change existing behaviour.
  - Wizard navigation between the other steps is unaffected — the Audit step already existed in the tracker.

## 12. Dependencies & stakeholders

Technical dependencies: [feature.md §13](./feature.md) and [trd.md §7](./trd.md).

- **Product stakeholders:** Eng lead — Chirag Chavan. PM / Design lead / QA lead / comms owner — `TBD` (PQ-1).
- **Cross-team dependencies:**
  - **`cs-source-selection` owners** — this feature reads the folder their export writes (feature.md DEP-1). Two known defects in that export are **deliberately deferred** and this feature is specified to work around both: fallback records (FR-1.7) and un-fetched entry variants (FR-2.12). Needs their acknowledgement that FR-1.7's workaround is temporary and should be removed once the exporter is corrected — otherwise it becomes permanent dead code nobody dares delete. Owner: export services.
  - **`migration-wizard-chrome` owners** — this feature supplies the `auditReady` / `excludedCount` / `migratingCount` context values their step definition already declares, and adds the shared toast to their chrome (feature.md DEP-2, FR-9.1). The toast lands in their component, so its placement needs their sign-off.
  - **Content mapping owners (feature not yet specified)** — will consume the persisted `AuditDecisions` and hide excluded items (feature.md DEP-4). The item-key format (FR-7.3) is the contract between the two features and needs joint sign-off **before** this feature ships, because changing a key format after decisions exist in the wild means a migration. Owner `TBD` (PQ-1).

## 13. Risks & mitigations (product-side)

Technical risks live in [trd.md §16](./trd.md).

- **PR-1:** **A wrong "unused" verdict destroys customer content.** This is the only place in the wizard where the tool advises a destructive choice. If the asset scan over-reports, a user deletes assets live content depends on — and they have no reason to doubt us. Likelihood: medium (R-1). Impact: high, and discovered only after migration. Mitigation: FR-2.6 makes the count conservative by rule; FR-2.12's caveat is P0 specifically so the known variant blind spot is disclosed rather than hidden.
- **PR-2:** **A health check that did not run, read as a clean bill of health.** Worse than not shipping the check at all, because the user acts on it. Likelihood: medium — the failure mode is a missing branch, easy to introduce. Impact: high. Mitigation: G-3 is the feature's north-star metric; FR-2.11 and FR-5.4 are written as prohibitions with paired negative ACs.
- **PR-3:** **Without telemetry we cannot prove the feature helps.** G-5 and G-6 are exactly the two goals that justify the work, and both are unmeasurable. Likelihood: certain. Impact: medium — we ship on conviction, not evidence. Mitigation: decide telemetry (PQ-2) or accept qualitative assessment only; same position Source and Destination already accepted.
- **PR-4:** **The feature is specified around two known defects in someone else's code.** FR-1.7 and FR-2.12 exist because the exporter is wrong. That is the correct engineering call — it makes the audit right today — but it also means the audit carries a workaround whose reason will not be obvious in six months. Likelihood: certain. Impact: low now, medium later. Mitigation: both FRs state the reason inline in the spec; the cross-team dependency above asks for explicit acknowledgement that they are temporary.
- **PR-5:** **Users may read "excluded" as "deleted".** Nothing in the source stack is touched (feature.md §5), but a page full of red exclusion strips reading "will not be migrated" could reasonably be misread as destructive. Likelihood: medium. Impact: medium — an alarmed user abandons the step. Mitigation: copy tone per §7; the helper strip's "you can turn anything back on any time" is load-bearing, not decorative.
- **PR-6:** **The audit's promise about Content mapping is not this feature's to keep.** The reference design tells the user that continuing pre-fills step 4. This feature only records decisions; whether step 4 honours them depends on a feature that does not exist. If Content mapping ships without reading `AuditDecisions`, the user's exclusions silently do nothing. Likelihood: medium. Impact: high — the entire point of the page evaporates. Mitigation: the cross-team sign-off on FR-7.3 above, before this feature ships.

## 14. Timeline & milestones (high level)

- **Spec approved:** 2026-08-05
- **Design approved:** already exists — see §16. No new design work required, though three copy questions are open (PQ-3, feature.md Q-7, Q-8).
- **Engineering start:** `TBD` — gated on the five open questions PQ-2…PQ-6 below, of which only PQ-5 (override resolution) and PQ-6 (persistence timing) block code.
- **Feature-complete (code merged):** `TBD`
- **Beta / staged rollout start:** n/a — no flag; ships with the `/v3` surface.
- **GA:** tied to v3 becoming the default entry point, not owned by this feature.

Engineering-level task breakdown lives in [trd.md §17](./trd.md).

## 15. Open questions

Product-owned. Items copied from [feature.md §16](./feature.md) that are product decisions rather than technical ones.

- **PQ-1:** Who owns product, design, QA and comms for this feature? All `TBD`, as with every prior v3 feature. — owner: Chirag — needed by: engineering start (for comms only; does not block code).
- **PQ-2:** Is telemetry worth adding to this tool, and if so what events measure G-5 and G-6 (feature.md Q-1)? Should the decisions endpoint log exclusion counts? — owner: product — needed by: 90-day review, not build.
- **PQ-3:** Is the "Keeping" pill copy verbatim-required on the informational cards, given those categories can never be anything but kept (feature.md Q-8)? — owner: design — needed by: implementation of FR-5.3.
- **PQ-4:** Is 50 rows per page right, and should it be user-adjustable (feature.md Q-7)? — owner: Chirag — needed by: implementation of FR-6.3.
- **PQ-5:** ~~When a category switch is toggled, are its per-item overrides cleared or preserved?~~ **Resolved 2026-08-05: cleared.** "Exclude this whole category" means exactly that, with no invisible exceptions carried over from a choice the user made and then undid. Now specified as feature.md FR-7.2a; no longer blocking.
- **PQ-6:** ~~Are decisions saved on every toggle, or only when the user clicks Continue?~~ **Resolved 2026-08-05: saved once, on Continue** — matching the Source and Destination steps, and making "saving failed, so we did not advance" a statement with one meaning. Accepted cost: a refresh before continuing discards unsaved toggles. The contradiction between UC-2 and AC-6.4 has been corrected in feature.md (FR-7.5); no longer blocking.
- **PQ-7:** Should previously-excluded items that no longer exist in the export be surfaced to the user, or silently ignored as FR-7.7 requires (feature.md Q-3)? — owner: Chirag — needed by: implementation of FR-7.7.

## 16. References

- [feature.md](./feature.md)
- [trd.md](./trd.md)
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Audit Report Step - Prototype copy copy"** — the reference design: analyzing state and its four check rows, impact panel, "Worth a look" and "Just so you know" sections, flagged-items table with filters and search, auto-seed disclosure, sticky footer, toast. The same project also holds an earlier page named "Audit Report Step - Prototype" which is **not** the reference.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Content Map and Audit"** — sibling page sharing the visual language.
- [docs/features/migration-wizard-chrome/feature.md](../migration-wizard-chrome/feature.md) — the chrome this page renders inside; owns the step copy that feature.md A-6 makes authoritative over the design.
- [docs/features/cs-source-selection/feature.md](../cs-source-selection/feature.md) — the export this audit reads (DEP-1).
- [docs/features/cs-destination-selection/prd.md](../cs-destination-selection/prd.md) — precedent for the no-flag rollout and no-analytics positions taken in §9 and §10.
