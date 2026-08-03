# TRD: Migration Wizard Chrome (shared header, step tracker & footer)

- **Slug:** `migration-wizard-chrome`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** Chirag Chavan
- **Engineers:** TBD
- **Created:** 2026-07-30
- **Last updated:** 2026-07-30

## 1. Overview

A `ui/v3`-only layout component that wraps every migration step: app bar, seven-step tracker, and sticky footer. It is the first piece of v3 that is **shared chrome rather than a feature panel**, so its central design problem is the contract by which a panel tells it "my gate is satisfied, and here is my advance work".

Per confirmed decision that contract is a **React context** (`StepGate`), not Redux: gate state is per-render UI state and the advance work is a callback, neither of which belongs in a persisted store. Also per confirmed decision, **step completion is derived from each step's own persisted document** rather than a new progress store — so this feature adds **no new database entity and no new API endpoint**. It reads one existing endpoint (`cs-source-selection`'s persisted-source read) for the app bar's stack name.

Almost entirely frontend. The only backend consideration is whether the existing persisted-source read is enough to answer "is this step complete" for every step (see TQ-1).

See [prd.md §1](./prd.md) and [feature.md §1](./feature.md).

## 2. Scope

- **In scope:** new `ui/v3` layout components (app bar, step tracker, sticky footer); the `StepGate` React context and its provider/consumer hooks; a static step-list definition (labels, titles, action labels, status lines); route→step derivation; navigation for Back / gate / tracker; deriving step completion from existing persisted step documents; wiring the Destination panel as the first `StepGate` publisher.
- **Out of scope:** the step panels' own content (`cs-source-selection`, `cs-destination-selection`, and the five unbuilt steps); the toast surface (feature.md §5); any new persisted entity or API; the v2 application's navigation; migrating the Source panel into the chrome — that is **Stage 2** ([prd.md §9](./prd.md)), tracked here as T-9 but explicitly sequenced after Stage 1 ships.

## 3. Requirements traceability

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1, FR-1.2 | TR-2 | App bar; step index/title read from the step list |
| FR-1.3, FR-1.4, FR-1.5, FR-1.6 | TR-3 | Source indicator; reuses Source's persisted-source read |
| FR-2.1, FR-2.2, FR-2.3, FR-2.4 | TR-4, TR-8 | Tracker rendering; completion marks come from the derived progress |
| FR-2.5, FR-2.6, FR-2.7 | TR-4, TR-6, TR-8 | Interactivity limited to completed + current |
| FR-3.1, FR-3.2 | TR-5 | Sticky footer layout |
| FR-3.3, FR-3.4 | TR-5, TR-6 | Back, disabled on the first step |
| FR-3.5, FR-3.6 | TR-5, TR-1 | Status line from the step list; Audit's varies with its own state |
| FR-4.1, FR-4.2, FR-4.3 | TR-5, TR-7 | Gate disabled state, label, hover explanation |
| FR-4.4, FR-4.6 | TR-6, TR-7 | Advance work awaited; navigate only on success; re-entrancy guard |
| FR-4.5 | TR-7 | One gate state + one advance action shared with any in-panel button |
| FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5 | TR-1 | All copy lives in the step-list definition |
| FR-6.1, FR-6.2 | TR-6 | Chrome owns navigation; current step derived from the route |
| FR-6.3 | TR-2 | Panels render as the chrome's children |
| FR-6.4, FR-6.5 | TR-7 | `StepGate` context; absent registration ⇒ satisfied |
| NFR-1, NFR-2 | TR-4, TR-5 | Tracker/footer semantics + keyboard operability |
| NFR-3 | TR-6 | Navigation must not clear panel state |
| NFR-7 | TR-10 | Step-transition logging |

### Technical requirements

- **TR-1:** A static, data-driven **step-list definition** — the single source of truth for the seven steps: stable id, route segment, tracker label, app-bar title, primary-action label, footer status line, and disabled-state explanation. Adding a step must be a data change, not a code change (FR-2.1, FR-5.1–5.5). Entries whose copy is unresolved (Migrate/Verify labels and status lines, four app-bar titles) are explicitly marked pending rather than guessed — see TQ-4.
- **TR-2:** A **chrome layout component** rendering app bar → tracker → `children` → footer, with the sticky-footer layout, and constraining its own content to the design's centred column width (FR-1.1, FR-1.2, FR-6.3). Column width is TQ-6.
- **TR-3:** The **source indicator**: reads the project's persisted source via `cs-source-selection`'s existing `GET /v3/org/:orgId/project/:projectId/source`, renders the stack name, falls back to "Not selected" when absent or on failure, and truncates without layout shift (FR-1.3–1.6, EC-1, EC-7, EC-8). **No new endpoint.**
- **TR-4:** The **step tracker** component: complete / active / upcoming treatments, interactivity limited to completed + current, and assistive-tech semantics that do not rely on colour alone (FR-2.1–2.7, NFR-1).
- **TR-5:** The **sticky footer** component: Back, status line, primary action; disabled states; the hover explanation exposed to assistive tech as well as on pointer hover (FR-3.1–3.6, FR-4.1–4.3, NFR-1, NFR-2).
- **TR-6:** **Navigation ownership**: derive the current step from the route, and perform routing for Back (one earlier, disabled on the first), the gate (one later, only after the panel's advance work succeeds), and tracker clicks (completed steps only). Navigation must not clear a panel's persisted state (FR-6.1, FR-6.2, FR-3.4, FR-2.6, NFR-3).
- **TR-7:** The **`StepGate` React context**. A panel registers `{ satisfied: boolean, blockedReason?: string, advance?: () => Promise<boolean> }`; the chrome reads it for the gate's disabled state, label tooltip, and click behaviour. A step that registers nothing is treated as satisfied (FR-6.4, FR-6.5, EC-11). The same registered value backs any in-panel advance button, so the two cannot diverge (FR-4.5). The chrome guards re-entrancy while `advance()` is in flight (FR-4.6).
- **TR-8:** **Derived step completion.** A step is complete when its own persisted document exists and satisfies that step's completeness test — for Source, a succeeded export; for Destination, a persisted `destination`. Implemented as a per-step predicate on the step-list definition so each step owns its own test. No new store, no new field (feature.md Q-2, resolved by confirmed decision). **Steps with no persisted document can never read complete** — see TRR-1.
- **TR-9:** **Destination panel wiring**: the Destination panel registers its existing `canProceed` derivation as `satisfied`, its "Prepare the source first to continue." text as `blockedReason`, and its existing `proceedToContentMapping` thunk as `advance()` — returning `true` only when the persist succeeded. Its own in-panel button switches to reading the same registered value (FR-4.5, and `cs-destination-selection` FR-6.1/FR-6.3).
- **TR-10:** **Step-transition logging** with project id and from/to step, excluding secrets (NFR-7). Mechanism follows whatever the v3 client already uses; no new logging infrastructure.

## 4. Architecture

- **Components touched:** none in `api/` — this feature adds no endpoint and no schema. Within `ui/v3`, the existing `pages/Migration` route host is replaced by the chrome, and `components/destination/DestinationPanel` gains a `StepGate` registration. `components/source/*` is **untouched in Stage 1** (prd.md §9) and migrated in Stage 2 (T-9). v2 is untouched.
- **New components:**
  - `ui/v3/components/wizard/WizardChrome.tsx` — the layout shell (owner: FE).
  - `ui/v3/components/wizard/WizardAppBar.tsx`, `WizardStepTracker.tsx`, `WizardFooter.tsx` — the three regions (owner: FE).
  - `ui/v3/components/wizard/steps.ts` — the step-list definition, including each step's completeness predicate (owner: FE).
  - `ui/v3/components/wizard/StepGateContext.tsx` — the context, a `useRegisterStepGate()` hook for panels, and a `useStepGate()` hook for the chrome (owner: FE).
  - `ui/v3/components/wizard/useWizardNavigation.ts` — route→step derivation and the three navigation actions (owner: FE).
- **State:** no new Redux slice. Gate registration lives in React context (confirmed decision); step completion is derived on read from the already-loaded persisted step documents. The only new persistent-ish state is none.
- **Data flow (happy path):**
  1. The wizard route renders `WizardChrome`, which derives the current step from the route segment against `steps.ts` (TR-6).
  2. The chrome reads the project's persisted source once for the app bar's stack name (TR-3) and for Source's completeness predicate.
  3. The chrome reads the persisted destination for Destination's completeness predicate (TR-8) — reusing the read the Destination panel already performs.
  4. The tracker renders complete/active/upcoming from those predicates plus the current step's index (TR-4).
  5. The panel for the current step renders as `children` and registers its `StepGate` on mount (TR-7).
  6. The footer renders Back (disabled on step 1), the step's status line, and the primary action labelled from `steps.ts` and disabled per the registered gate (TR-5).
  7. User clicks the primary action → the chrome awaits the panel's `advance()` → on `true`, routes to the next step; on `false` or a rejection, stays put (TR-6, EC-3).
- **Data flow (error path):** the persisted-source read failing degrades the app bar to "Not selected" and Source's completeness to false — it never blocks the chrome from rendering (EC-8). A panel's `advance()` rejecting is treated as `false`; the panel surfaces its own error, the chrome only declines to navigate.
- **Concurrency / ordering constraints:** `advance()` is guarded against re-entry (FR-4.6) — this matters concretely, because Destination's advance mints a management token and creates real Contentstack artefacts. Back during an in-flight advance is TQ-3.

## 5. Data model

- **DM-1: no new persisted entity, no schema change.** Confirmed decision: step completion is derived from existing per-step documents rather than recorded. `WizardProgress` in feature.md §10 is a **read model computed on demand**, not stored.
- **`WizardStep` (feature.md §10) — static code-level definition, not data.** Lives in `steps.ts` (TR-1). Shape (proposal):
  ```
  { id, routeSegment, trackerLabel, appBarTitle,
    actionLabel, statusLine, blockedExplanation?,
    isComplete(ctx) => boolean }
  ```
  `statusLine` must support a state-dependent form, because the Audit step's line varies with its own state (FR-5.3) — modelled as a function of the step's context rather than a constant string.
- **`StepGate` (feature.md §10) — transient, not persisted.** `{ satisfied, blockedReason?, advance? }`, held in React context only (TR-7).
- **`Source` / `Destination` (read-only dependencies):** no schema change. This feature reads the persisted `source` (for the app-bar name and Source's completeness) and the persisted `destination` (for Destination's completeness). It writes to neither.

## 6. API contracts

**No new endpoints, no new events.** This is a deliberate consequence of the two confirmed decisions (React-context gate registration; completion derived from existing documents).

### Reused endpoints (NOT re-implemented here — owned by the sibling features)
- `GET /v3/org/:orgId/project/:projectId/source` → the persisted `source` document. Used for the app bar's stack name (TR-3) and Source's completeness predicate (TR-8). Owned by `cs-source-selection`.
- `GET /v3/org/:orgId/project/:projectId/destination` → the persisted `destination` document. Used for Destination's completeness predicate (TR-8). Owned by `cs-destination-selection`.

⚠️ Both reads are **org-scoped**, and the v3 wizard route carries no `orgId` — `cs-destination-selection`'s own TDD report records this as an unresolved gap, currently worked around with a `?orgId=` query param. The chrome inherits that problem and makes it more visible, because the app bar needs the source read on *every* step. See TQ-2.

### Events
None new.

## 7. Integration points

- **INT-1 (DEP-1):** `cs-source-selection`'s persisted-source read — we call it read-only for the app-bar stack name and Source's completeness — contract owner: `cs-source-selection` (Ayush Sahu) — fallback: treat as "Not selected" / not-complete (EC-1, EC-8) — realizes DEP-1.
- **INT-2 (DEP-2):** `cs-destination-selection` — the first `StepGate` publisher. Its `canProceed` becomes `satisfied`, its "Prepare the source first to continue." becomes `blockedReason`, and its `proceedToContentMapping` becomes `advance()`. Bidirectional: the panel must now return a success boolean it does not currently return — realizes DEP-2 via TR-9.
- **INT-3 (DEP-3):** the standalone `/v3` architecture, routing and auth conventions — we reuse the pattern and the existing route host — realizes DEP-3.
- **INT-4 (DEP-4):** the shared `/v3` design-system tokens in `ui/v3/styles/theme.css` — the chrome must consume existing tokens rather than introduce values. Note the sibling feature's TDD report records three shared primitives (`.v3-label`, `.v3-field`, `.v3-btn`) as drifting from the design system; the footer's buttons will inherit that drift — realizes DEP-4, see TRR-5.
- **INT-5 (DEP-5):** step completion — **no external integration required**, since the confirmed decision derives it from INT-1 and INT-2's documents. Realizes DEP-5 by removing the dependency rather than satisfying it.
- **INT-6 (DEP-6, forward):** the five unbuilt steps (Audit, Content mapping, Preview, Migrate, Verify) will each register a `StepGate` and supply a `steps.ts` entry including a completeness predicate. Contract defined here; consumed later — realizes DEP-6.

## 8. Technology choices

- **TC-1: `StepGate` via React context, not Redux** — chosen (confirmed decision). Gate state is per-render UI state and `advance()` is a callback; neither is serialisable or persisted, so Redux would be the wrong home. Alternatives considered: a `wizard` Redux slice (rejected — puts callbacks in the store); a central registry importing every panel's selectors and thunks (rejected — inverts the dependency so the chrome would import from all seven features).
- **TC-2: step completion derived from existing persisted documents, not a stored progress field** — chosen (confirmed decision). Each step already owns its own data; a `completedSteps` array would be a second source of truth able to drift from it. Alternative rejected: explicit `completedSteps` on the v3 project record. Accepted cost: a step with no persisted document can never read complete (TRR-1).
- **TC-3: no feature flag, gated by the `/v3` route** — chosen (confirmed decision), matching both sibling features; this repo has no flag system. Alternative rejected: an env flag, despite this feature wrapping a shipped panel — mitigated instead by sequencing Source's migration into Stage 2.
- **TC-4: the step list is data, not routing config** — chosen. Order, copy and completeness predicates live in one array so a new step is one entry. This is what makes PR-3's "expect one contract revision" cheap.

## 9. Sequencing & phases

- **Phase 1 (frame, no behaviour):** TR-1, TR-2, TR-4, TR-5 — the app bar, tracker and footer render from the step list, with navigation and gating stubbed. Independently reviewable against the design; no dependency on any panel.
- **Phase 2 (navigation):** TR-6 — route→step derivation, Back, tracker clicks. Unlocks UC-1, UC-4, UC-5 except the completion marks.
- **Phase 3 (gating):** TR-7, TR-9 — the `StepGate` context and the Destination panel's registration, including switching its in-panel button onto the shared gate. Unlocks UC-3 and UC-6, and satisfies FR-4.5.
- **Phase 4 (completion + source indicator):** TR-3, TR-8 — the app bar's source name and the tracker's completion marks. Deferred to last because both depend on the org-scoped reads and therefore on TQ-2.
- **Phase 5 (Stage 2, separate):** T-9 — migrate the Source panel into the chrome and remove its own navigation. **Gated on `cs-source-selection`'s owner signing off** (prd.md §12); not part of Stage 1's ship.

## 10. Testing strategy

Test-cases skill generates detailed cases from feature.md ACs; this is the placement plan. `ui/` component tests via vitest + jsdom + Testing Library, matching both sibling features.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit (component) | `ui/v3` wizard app-bar tests | Title + "Step 3 of 7 · …" |
| AC-1.2 | unit (component) | wizard tracker tests | Exactly seven steps, in order |
| AC-1.3 | unit (component) | wizard tracker tests | complete / active / upcoming split at Destination |
| AC-1.4 | unit (component) | wizard tracker tests | First step ⇒ nothing complete |
| AC-1.5 | unit (component) | wizard tracker tests | Last step ⇒ six complete |
| AC-2.1 | integration | app bar + persisted-source read (mocked) | Real stack name rendered |
| AC-2.2 | unit (component) | app bar tests | "Source: Not selected" |
| AC-2.3 | unit (component) | app bar tests | Truncation, no height change |
| AC-3.1 | unit (component) | wizard footer tests | Enabled + correct label when gate satisfied |
| AC-3.2 | integration | footer + StepGate + navigation | Advance succeeds ⇒ navigate + mark complete |
| AC-3.3 | unit (component) | wizard footer tests | Disabled when gate unsatisfied |
| AC-3.4 | unit (component) | wizard footer tests | Disabled click ⇒ no nav, `advance` not called |
| AC-3.5 | integration | footer + StepGate | `advance()` false/rejects ⇒ no navigation |
| AC-3.6 | unit (component) | wizard footer tests | Re-entrancy guard — `advance` called once |
| AC-3.7 | unit (component) | StepGate context tests | No registration ⇒ enabled (FR-6.5) |
| AC-4.1 | unit (component) | wizard footer tests | Back present + disabled on step 1 |
| AC-4.2 | unit (component) | navigation tests | Destination ⇒ Back goes to Audit |
| AC-4.3 | integration | navigation + Destination panel | Round trip restores persisted selection (NFR-3) |
| AC-5.1 | unit (component) | tracker tests | Completed step click navigates |
| AC-5.2 | unit (component) | tracker tests | Upcoming step click does nothing |
| AC-5.3 | unit (component) | tracker tests | Current step click is a no-op |
| AC-6.1 | unit (component) | wizard footer tests | Destination status line verbatim |
| AC-6.2 | unit (component) | wizard footer tests | Source status line verbatim |
| AC-6.3 | unit (component) | wizard footer tests | Audit not ready |
| AC-6.4 | unit (component) | wizard footer tests | Audit ready, nothing excluded |
| AC-6.5 | unit (component) | wizard footer tests | Audit ready, "12 excluded, 480 will migrate" |
| AC-6.6 | unit (component) | wizard footer tests | Source disabled explanation |
| AC-6.7 | unit (component) | wizard footer tests | Audit disabled explanation |

- **Fixtures / test data:** a synthetic step list (so tracker tests don't depend on the real seven), synthetic persisted `source` / `destination` documents in complete and incomplete states, and a fake `StepGate` registration. No PII, no real tokens.
- **Mocks:** the persisted-source and persisted-destination reads (INT-1, INT-2); the router, so navigation assertions check the intended target rather than a real URL change; a stub `advance()` resolving true / false / rejecting.
- **Test-only hook:** a helper to render the chrome at an arbitrary step with an arbitrary gate registration, so each AC can be set up in one line.
- **Notable gap:** AC-6.3–6.5 specify the Audit step's status lines, but **the Audit step does not exist** — those tests must drive the chrome with a synthetic Audit-shaped step context rather than the real panel. Flagged so the test-case stage does not assume a real Audit integration.
- **CI signal:** `ui/` vitest green. Note the pre-existing gap recorded in the sibling feature's TDD report: `ui/vitest.config.ts` limits coverage to `src/**`, so nothing under `v3/**` — including this feature — appears in coverage numbers.

## 11. Observability

- **Logs:** step-transition events with `projectId`, `fromStep`, `toStep`, and `via` (back / gate / tracker); plus gate-blocked (with reason) and advance-failed. Never log secrets — the chrome handles none, but `advance()` implementations may (Destination mints a management token), so the chrome must log only the boolean outcome, never the panel's payload. Level: info for transitions, warn for blocked/failed.
- **Metrics:** counters — `v3_wizard_step_changed` (label: via), `v3_wizard_gate_blocked` (label: step/reason), `v3_wizard_advance_failed` (label: step). Wiring is a TQ — no metrics backend is confirmed, the same gap as both sibling features.
- **Alerts / Dashboards / Traces:** none for v1.

## 12. Security

- **Auth / authz:** no new routes, so no new auth surface. The chrome renders inside the existing v3 route guard; the reads it performs are already-authenticated v3 endpoints.
- **PII / secrets:** the chrome holds none. The one real risk is indirect: `advance()` callbacks may carry secret material (Destination's management-token secret), so the chrome MUST treat `advance()` as opaque — awaiting a boolean and never logging, storing or re-dispatching its payload (see §11).
- **Threat model deltas:** one worth stating. The chrome makes navigation a shared concern, so a bug in the gate could let a user advance past a step whose conditions are unmet. For Destination that would mean advancing without a persisted destination or without a created token. FR-4.4's "navigate only on success" is therefore a security-adjacent requirement, not just a UX one — and AC-3.5 is its test.
- **Secret handling:** unchanged; no new mechanism.
- **Compliance:** none new (self-hosted).

## 13. Performance

References feature.md NFR-4 and NFR-6.

- **Expected load:** low concurrency (self-hosted, few operators); the chrome is pure client-side rendering.
- **Hot paths:** the persisted-source read, which the app bar needs on **every** step — the one genuine performance consideration here. NFR-4 requires it not be re-fetched per step change; it should be read once per project view and shared, not fetched by the app bar on each navigation. Concrete budget is TQ-5.
- **Rendering:** the tracker is seven static items; no virtualisation or memoisation concerns.
- **Load-test plan:** none. Not a server-side feature.

## 14. Rollout / feature flag

- **Flag name:** none ([prd.md §9](./prd.md)). Gated by the v3 wizard route existing.
- **Default state at merge:** the chrome wraps the Destination panel only (Stage 1). The Source panel continues to render exactly as today, with its own navigation intact.
- **Gated code paths:** `ui/v3/components/wizard/**`, plus the Destination panel's `StepGate` registration and the v3 migration route host.
- **Config surface:** none new.
- **Per-stage flip:** manual, matching the sibling features. Stage 2 (Source migration) is a separate change with its own review.

## 15. Rollback plan

- **How to disable (Stage 1):** stop rendering `WizardChrome` in the v3 migration route and restore the previous route host. The Destination panel keeps its own in-panel advance button (feature.md C-2), so it remains fully usable without the chrome — **this is the main reason keeping that button is defensible engineering, not just design deference.**
- **Data cleanup on rollback:** none. This feature persists nothing and adds no schema (DM-1), so there is no data to reverse.
- **What breaks if we rollback mid-flow:** a user mid-navigation loses only the chrome; every step's own persisted selection is untouched, because the chrome never writes. Nothing in Source, Destination, or v2 breaks.
- **⚠️ Asymmetric risk after Stage 2:** once T-9 removes the Source panel's own navigation, rolling the chrome back leaves **Source with no navigation at all**. Rollback after Stage 2 therefore requires reverting T-9 as well, not just unmounting the chrome. Treat Stage 1 and Stage 2 as separately revertible changes and never squash them.
- **Rollback SLA:** minutes for Stage 1 (unmount one component). Stage 2 is a code revert, not a config change — plan for a deploy.

## 16. Risks & mitigations (technical)

- **TRR-1:** Deriving completion from persisted documents (TC-2) means a step with no persisted document can **never** read complete — so with five of seven steps unbuilt, the tracker will show Content mapping onward as incomplete even for a user who has passed through them — likelihood high / impact medium — accepted for now since those steps don't exist; but the tracker must not be presented as authoritative progress until they persist state (prd.md PR-1). Revisit if a step ships without persisting anything.
- **TRR-2:** Both reads the chrome depends on are **org-scoped** while the v3 route carries no `orgId` (§6). The sibling feature already works around this with `?orgId=`, and the chrome makes the gap worse by needing the source read on every step — likelihood high / impact high — resolve TQ-2 before Phase 4; Phases 1–3 are deliberately sequenced to not depend on it.
- **TRR-3:** `advance()` is an async callback owned by a panel, so the chrome cannot bound its duration or guarantee it is idempotent. Destination's creates real Contentstack artefacts — a double-fire would mint two management tokens — likelihood medium / impact high — FR-4.6's re-entrancy guard is mandatory, not optional, and AC-3.6 must be a real test rather than a rendering assertion.
- **TRR-4:** Stage 2 modifies a shipped feature's navigation. If the chrome's contract is wrong, the failure surfaces in Source, which this team does not own — likelihood medium / impact medium — get the Destination integration (Phase 3) proven before starting T-9, so Source migrates onto a contract with one real consumer already behind it.
- **TRR-5:** The footer's buttons inherit the three shared-primitive deviations (`.v3-label`, `.v3-field`, `.v3-btn`) recorded in `cs-destination-selection`'s TDD report — so the footer will be visually off-spec in exactly the way the Destination panel already is — likelihood high / impact low — fix the shared primitives once, repo-wide, with both features' owners rather than overriding locally (INT-4).
- **TRR-6:** No narrow-viewport design exists for a seven-step tracker (TQ-7). Implementing it by guess risks a visible regression, since today's single-panel pages have no such constraint — likelihood medium / impact medium — settle TQ-7 in Phase 1, when the tracker is being built anyway.

## 17. Task breakdown

- **T-1:** Step-list definition with copy and completeness predicates — realizes TR-1 — S — no dependency. Entries with unresolved copy explicitly marked pending (TQ-4).
- **T-2:** Chrome layout shell (app bar → tracker → children → footer, sticky footer, centred column) — realizes TR-2 — M — depends on T-1.
- **T-3:** Step tracker component with complete/active/upcoming and a11y semantics — realizes TR-4 — M — depends on T-1.
- **T-4:** Sticky footer component (Back, status line, primary action, disabled states, a11y explanation) — realizes TR-5 — M — depends on T-1.
- **T-5:** Route→step derivation and the three navigation actions — realizes TR-6 — M — depends on T-1, T-2.
- **T-6:** `StepGate` context + `useRegisterStepGate` / `useStepGate` hooks, including the re-entrancy guard — realizes TR-7 — M — depends on T-4.
- **T-7:** Destination panel wiring: register its gate, have `proceedToContentMapping` return success, and point its in-panel button at the shared gate — realizes TR-9 — M — depends on T-6; touches `cs-destination-selection`.
- **T-8:** Source indicator + derived completion marks — realizes TR-3, TR-8 — M — depends on T-3, and on TQ-2 being resolved.
- **T-9 (Stage 2, separate change):** migrate the Source panel into the chrome and remove its own page-level navigation — realizes TR-6 for Source — M — **depends on T-7 proving the contract, and on `cs-source-selection`'s owner signing off.** Must remain independently revertible (§15).
- **T-10:** Step-transition logging — realizes TR-10 — S — depends on T-5.
- **T-11:** Test suites (fixtures, mocks per §10, AC placement) — realizes all TRs — M — parallel with T-2…T-8.

## 18. Open questions

- **TQ-1:** Is "the step's persisted document exists and is valid" the right completeness test for **each** step, and specifically is Source's test "a succeeded export" (rather than merely a persisted selection)? Confirm with `cs-source-selection`'s owner. — owner: Eng (both features) — needed by: T-8. (feature.md Q-2, prd.md PQ-1)
- **TQ-2 (BLOCKING for T-8):** The persisted-source and persisted-destination reads are org-scoped, but the v3 wizard route carries no `orgId`; the sibling feature currently passes `?orgId=`. Fix by adding an org to the route, adding project-scoped read endpoints, or something else? — owner: Eng — needed by: Phase 4 / T-8.
- **TQ-3:** Should Back be blocked while a panel's `advance()` is in flight? — owner: Eng — needed by: T-5. (feature.md Q-9)
- **TQ-4:** Copy still unresolved in the step list: primary-action labels and status lines for Migrate and Verify, disabled-state explanations beyond Source and Audit, and app-bar titles for Source, Destination, Migrate and Verify. — owner: Design — needed by: T-1 completion. (feature.md Q-3, Q-4; prd.md PQ-4, PQ-5)
- **TQ-5:** Performance budget and sharing mechanism for the persisted-source read so the app bar does not re-fetch per step change (NFR-4, §13). — owner: Eng — needed by: T-8. (feature.md Q-5)
- **TQ-6:** Centred column width — the design uses 1100px for the app bar and footer while the shipped Destination panel uses 1180px, so as-designed the footer will not line up with the panel above it. — owner: Design — needed by: T-2. (feature.md Q-10, prd.md PQ-8)
- **TQ-7:** Narrow-viewport treatment for the seven-step tracker — scroll within the tracker, collapse to "Step n of 7", or something else? No mobile design exists. — owner: Design — needed by: T-3. (feature.md Q-7)
- **TQ-8:** Behaviour for a route naming an unknown step, or a valid step the user has not reached — redirect to the furthest reachable step, redirect to Source, or render anyway? Depends on TQ-1. — owner: Eng/Product — needed by: T-5. (feature.md Q-8, EC-5, EC-6)
- **TQ-9:** Metrics backend for §11's counters — the same unresolved gap as both sibling features. — owner: Eng — needed by: T-10.

## 19. References

- [feature.md](./feature.md) · [prd.md](./prd.md)
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**; the app bar, step tracker and sticky footer regions are the reference for this feature (reference only, not mirrored locally).
- [`../cs-source-selection/feature.md`](../cs-source-selection/feature.md) · [`../cs-source-selection/trd.md`](../cs-source-selection/trd.md) — owns the persisted-source read this feature consumes (INT-1), and the panel Stage 2 migrates (T-9).
- [`../cs-destination-selection/feature.md`](../cs-destination-selection/feature.md) · [`../cs-destination-selection/trd.md`](../cs-destination-selection/trd.md) · [`../cs-destination-selection/tdd.md`](../cs-destination-selection/tdd.md) — the first `StepGate` consumer (INT-2). Its TDD report is the source for the org-scoped-route gap (TRR-2), the shared-primitive drift (TRR-5), and the `v3/**` coverage gap (§10).
