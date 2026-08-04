# Feature Spec: Migration Wizard Chrome (shared header, step tracker & footer)

- **Slug:** `migration-wizard-chrome`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-07-30
- **Last updated:** 2026-07-30

## 1. Summary

A single shared frame that wraps every step of the Contentstack-to-Contentstack migration wizard — an app bar naming the product and the current step, a seven-step progress tracker, and a sticky footer holding **Back**, a per-step status line, and the primary "advance" action. Each step's panel (Source, Audit, Destination, Content mapping, Preview, Migrate, Verify) renders inside this frame instead of drawing its own navigation.

## 2. Problem statement

Today each migration step draws its own navigation, or none at all. The already-shipped Source panel and the Destination panel each render a standalone page with an ad-hoc link row, so a user cannot see how many steps the migration has, which step they are on, which steps they have finished, or how to go back — the wizard does not visibly exist as a wizard. Every new step re-invents the same chrome, which guarantees the steps drift apart visually and behaviourally (the Destination panel already grew its own full-width advance button because there was no shared footer to put one in). Without a shared frame, "step 4 of 7" is knowledge that lives only in the designer's head.

## 3. Target users / personas

- **Migration operator (primary)** — a Contentstack developer or solutions engineer running a stack-to-stack migration. Cares about knowing where they are in a multi-step process, what remains, and how to move forward or step back without losing work.
- **Partner / implementation consultant (secondary)** — runs migrations on a customer's behalf, often across several sessions. Cares most about resuming: seeing at a glance which steps are already complete.

Primary persona: **Migration operator**.

## 4. Goals & success metrics

- **G-1:** A user can tell, on every step, which step they are on and how many remain. — measured by: users reaching Content mapping without needing to ask which step is which. Target `TBD — Open Question` (Q-1).
- **G-2:** Every migration step presents the same navigation affordances in the same place. — measured by: 0 steps shipping their own bespoke header, tracker, or Back control after this lands.
- **G-3:** A user can return to any step they have already completed without losing that step's saved selection. — measured by: 0 reported cases of a backward navigation discarding persisted state.
- **G-4:** The primary advance action is never enabled when its step's conditions are unmet. — measured by: 0 cases of a user advancing past a step whose gate was unsatisfied.

## 5. Non-goals / out of scope

- **The step panels themselves** — Source (`../cs-source-selection/feature.md`), Destination (`../cs-destination-selection/feature.md`), and the not-yet-specified Audit, Content mapping, Preview, Migrate and Verify steps. This feature renders the frame around them and owns navigation between them; it owns none of their content.
- **The toast/notification surface.** The design positions a centred toast just above the sticky footer, but it is a separate concern with its own triggers; confirmed out of scope for this feature.
- **Deciding each step's gate condition.** The chrome asks a panel whether it may advance; what makes a panel ready is that panel's own specification (e.g. the Destination panel's FR-6.1).
- **Removing the Destination panel's in-panel advance button.** Confirmed decision: the footer gate and the panel's own "Proceed to content mapping" button both remain (see FR-4.5 for the consistency rule this forces).
- **Persisting wizard progress.** How "this step is complete" is recorded and retrieved is not defined by this feature (see Q-2) — the chrome consumes a progress signal, it does not design the store.
- **The v2 (non-`/v3`) application's navigation.** This chrome is for the `/v3` migration flow only.
- **Authentication and the region-switch login modal** — owned by the step panels.

## 6. Use cases

### UC-1: See where I am in the migration

- **Actor:** Migration operator
- **Trigger:** User opens any step of the migration wizard.
- **Preconditions:** User is authenticated; a project exists.
- **Main flow:**
  1. The app bar shows the product mark and the title "Migrate to Contentstack".
  2. The app bar shows the current position as "Step {n} of 7 · {step title}".
  3. The step tracker lists all seven steps in order: **Source, Audit, Destination, Content mapping, Preview, Migrate, Verify**.
  4. The current step is marked active; every earlier step is marked complete; every later step is marked upcoming and visually de-emphasised.
  5. The step panel for the current step renders between the tracker and the footer.
- **Postconditions / success state:** The user can identify the current step, its number, the total, and which steps are done.
- **Alternate flows:**
  - **UC-1a (first step):** On Source, no step is marked complete.
  - **UC-1b (last step):** On Verify, all six earlier steps are marked complete.
- **Priority:** P0

### UC-2: See which source I am migrating from

- **Actor:** Migration operator
- **Trigger:** Any step of the wizard is open.
- **Preconditions:** None.
- **Main flow:**
  1. The app bar's right-hand side shows a status dot followed by "Source: **{source stack name}** (Contentstack)".
  2. The name is read from the project's persisted source selection.
- **Postconditions / success state:** The user can confirm which source stack the whole migration refers to without leaving the current step.
- **Alternate flows:**
  - **UC-2a (no source yet):** No source selection is persisted → the indicator reads "Source: **Not selected**" (see EC-1).
  - **UC-2b (long name):** The name is too long for the available width → it is truncated with an ellipsis rather than wrapping or pushing the layout (see EC-7).
- **Priority:** P1

### UC-3: Advance to the next step

- **Actor:** Migration operator
- **Trigger:** User clicks the footer's primary action.
- **Preconditions:** The current step's panel reports that its gate is satisfied.
- **Main flow:**
  1. The footer's primary action shows the label for the current step (see FR-4.2).
  2. User clicks it.
  3. The chrome asks the current panel to complete its own advance work and waits for the result.
  4. The panel reports success.
  5. The chrome navigates to the next step, and the tracker marks the step just left as complete.
- **Postconditions / success state:** The user is on the next step; the step just left is marked complete.
- **Alternate flows:**
  - **UC-3a (gate unsatisfied):** The panel reports its gate is not satisfied → the action is disabled, clicking it does nothing, and no navigation occurs (see EC-2).
  - **UC-3b (panel work fails):** The panel's advance work fails — for example the Destination panel's management-token creation is rejected → the chrome does not navigate and the user stays on the step (see EC-3).
- **Priority:** P0

### UC-4: Go back to the previous step

- **Actor:** Migration operator
- **Trigger:** User clicks the footer's **Back** button.
- **Preconditions:** The user is on any step after the first.
- **Main flow:**
  1. User clicks **Back**.
  2. The chrome navigates to the immediately preceding step.
  3. That step's panel restores its previously persisted selection.
- **Postconditions / success state:** The user is on the preceding step with their earlier selection intact.
- **Alternate flows:**
  - **UC-4a (first step):** On Source, **Back** is rendered but disabled — there is no earlier step inside the wizard.
- **Priority:** P0

### UC-5: Jump back to a step I have already completed

- **Actor:** Migration operator
- **Trigger:** User clicks a step in the tracker.
- **Preconditions:** The clicked step is either already complete or the current step.
- **Main flow:**
  1. User clicks a completed step in the tracker.
  2. The chrome navigates to that step.
  3. That step's panel restores its previously persisted selection.
- **Postconditions / success state:** The user is on the chosen earlier step; later steps remain marked as they were.
- **Alternate flows:**
  - **UC-5a (upcoming step):** The clicked step is after the current one → it is not interactive and nothing happens (see EC-4).
  - **UC-5b (current step):** The user clicks the step they are already on → they stay there; nothing changes.
- **Priority:** P1

### UC-6: Read what this step expects of me

- **Actor:** Migration operator
- **Trigger:** Any step of the wizard is open.
- **Preconditions:** None.
- **Main flow:**
  1. The footer shows a status line describing what the current step expects, to the right of **Back**.
  2. The line changes with the step, and on some steps with that step's own state.
- **Postconditions / success state:** The user knows what the current step wants without reading the whole panel.
- **Alternate flows:**
  - **UC-6a (blocked gate):** The primary action is disabled → hovering it reveals a short explanation of what is missing.
- **Priority:** P1

## 7. User flows (optional detail)

The chrome is a fixed three-region frame, identical on every step: **app bar** (product mark, title, "Step {n} of 7 · {title}", source indicator) → **step tracker** (seven steps, left to right) → **step panel** (the only region that changes) → **sticky footer** (Back · status line · primary action). The footer stays pinned to the bottom of the viewport while the panel scrolls. Navigation happens in exactly three places: **Back** (one step earlier), the footer's primary action (one step later, gated), and a tracker click (any completed step). See UC-1 through UC-6.

## 8. Functional requirements

### FR — App bar
- **FR-1.1:** The app bar MUST display the product mark and the title "Migrate to Contentstack".
- **FR-1.2:** The app bar MUST display the current position in the form "Step {n} of 7 · {step title}", where `{n}` is the 1-based index of the current step.
- **FR-1.3:** The app bar MUST display a source indicator in the form "Source: {source stack name} (Contentstack)", preceded by a status dot.
- **FR-1.4:** The source indicator's stack name MUST be read from the project's persisted source selection, not hard-coded.
- **FR-1.5:** When no source selection is persisted for the project, the source indicator MUST read "Source: Not selected".
- **FR-1.6:** A source stack name too long for the available width MUST be truncated with an ellipsis, and MUST NOT wrap or change the app bar's height.

### FR — Step tracker
- **FR-2.1:** The tracker MUST render exactly these seven steps, in this order: Source, Audit, Destination, Content mapping, Preview, Migrate, Verify.
- **FR-2.2:** The tracker MUST mark every step before the current one as complete, showing a check mark instead of its number.
- **FR-2.3:** The tracker MUST mark the current step as active, visually distinct from both complete and upcoming steps.
- **FR-2.4:** The tracker MUST mark every step after the current one as upcoming, showing its number and visually de-emphasised.
- **FR-2.5:** The tracker MUST make completed steps and the current step interactive, and MUST NOT make upcoming steps interactive.
- **FR-2.6:** Clicking a completed step MUST navigate to that step.
- **FR-2.7:** Clicking the current step MUST leave the user on that step and change nothing.

### FR — Footer
- **FR-3.1:** The footer MUST remain visible at the bottom of the viewport while the step panel scrolls.
- **FR-3.2:** The footer MUST contain a **Back** button, a status line, and a primary action, in that left-to-right order.
- **FR-3.3:** The footer's **Back** button MUST be disabled while the current step is the first step.
- **FR-3.4:** On any step after the first, **Back** MUST navigate to the immediately preceding step.
- **FR-3.5:** The footer MUST display a status line whose text is determined by the current step.
- **FR-3.6:** The footer's status line for a step whose text depends on that step's own state MUST reflect the current state (see FR-4.4).

### FR — Primary action (the gate)
- **FR-4.1:** The footer's primary action MUST be disabled whenever the current step's panel reports that its gate is not satisfied.
- **FR-4.2:** The footer's primary action's label MUST be determined by the current step.
- **FR-4.3:** When the primary action is disabled, hovering it MUST reveal a short explanation of what is missing.
- **FR-4.4:** Clicking the primary action MUST ask the current panel to complete its own advance work, and MUST navigate to the next step only if that work reports success.
- **FR-4.5:** Where a step panel also renders its own advance button, that button and the footer's primary action MUST be driven by the same gate state and MUST trigger the same advance work, so the two can never disagree about whether advancing is possible.
- **FR-4.6:** While the current panel's advance work is in progress, the primary action MUST be non-interactive so the work cannot be triggered twice.

### FR — Copy
- **FR-5.1:** The primary action's label MUST be, per step: Source → "Proceed to audit"; Audit → "Continue to Destination"; Destination → "Proceed to content mapping"; Content mapping → "Continue to preview"; Preview → "Start migration". Labels for Migrate and Verify are `TBD — Open Question` (Q-3).
  - **Corrected 2026-08-04.** The Audit label previously read "Continue to content mapping", which named the step *after* Destination and so skipped a step in the stated order (Source → Audit → Destination → Content mapping). The original string came from the design's Audit page, which was drawn before Destination was inserted into the flow. Note the casing of "Destination" differs from the lower-case targets in the other four labels; whether all five should agree is `TBD — Open Question` (Q-16).
- **FR-5.2:** The footer status line MUST be, per step: Source → "Configure your source stack, then proceed to the audit."; Destination → "Configure the destination stack, then proceed to content mapping."; Content mapping → "Select content types, then map fields or pick entries inside each type."; Preview → "Review the scope below, then run a test migration or start the real one." Text for Migrate and Verify is `TBD — Open Question` (Q-3).
- **FR-5.3:** The footer status line for the Audit step MUST read "Generating audit — you can continue once it finishes" while the audit is not ready; "Audit complete — nothing excluded" when it is ready and nothing was excluded; and "Audit complete — {excluded} excluded, {migrating} will migrate" when it is ready and something was excluded.
- **FR-5.4:** The disabled primary action's hover explanation MUST be "Review your source, then proceed to the audit" on Source, and "Finish the audit to continue" on Audit. Explanations for other steps are `TBD — Open Question` (Q-3).
- **FR-5.5:** The app bar's step title MUST be "Audit report" for Audit, "Content mapping" for Content mapping, and "Preview & run" for Preview. Titles for Source, Destination, Migrate and Verify are `TBD — Open Question` (Q-4) — the design does not show them, and they are not simply the tracker labels.

### FR — Composition & navigation ownership
- **FR-6.1:** The chrome MUST own step navigation: it determines the current step, performs the navigation for Back, the primary action, and tracker clicks, and step panels MUST NOT navigate between steps themselves.
- **FR-6.2:** The chrome MUST derive the current step from the application route, so that a reloaded or shared URL lands on the same step.
- **FR-6.3:** Every step panel MUST render inside the chrome, between the tracker and the footer.
- **FR-6.4:** A step panel MUST be able to tell the chrome (a) whether its gate is satisfied, (b) an explanation when it is not, and (c) how to perform its advance work.
- **FR-6.5:** A step panel that publishes no gate information MUST be treated as having a satisfied gate, so a step with no conditions is not permanently blocked.

## 9. Non-functional requirements

- **NFR-1 (Accessibility):** The tracker MUST expose the current step to assistive technology as the current item in a list of steps, and MUST NOT convey completion by colour alone. Interactive steps, Back and the primary action MUST be keyboard-operable with a visible focus indicator. Target: WCAG 2.1 AA.
- **NFR-2 (Accessibility):** A disabled primary action's explanation MUST be available to assistive technology, not only as a pointer-hover tooltip.
- **NFR-3 (Reliability):** Navigating backward via Back or the tracker MUST NOT discard any selection the target step has already persisted.
- **NFR-4 (Performance):** Changing step MUST NOT re-fetch the source indicator's data; it is read once per project view. Exact budget `TBD — Open Question` (Q-5).
- **NFR-5 (Compatibility):** MUST work on the browsers already supported by the migration UI. Exact matrix `TBD — Open Question` (Q-6).
- **NFR-6 (Responsive):** The seven-step tracker MUST remain readable and MUST NOT cause horizontal page scrolling at the supported viewport widths. Behaviour below the width where seven steps fit is `TBD — Open Question` (Q-7).
- **NFR-7 (Observability):** Step transitions SHOULD be logged with the project identifier and the from/to step, excluding any secret values.

## 10. Data & entities

- **Entity: `WizardStep` (new, static)** — the ordered list of the seven steps. Each entry has a stable identifier, a tracker label, an app-bar title, a primary-action label, and a status line. Ordering is meaningful: it defines "earlier", "later", Back, and advance.
- **Entity: `WizardProgress` (read model, new)** — which steps are complete for a project, used to decide tracker completion marks and which steps are interactive. How this is derived and persisted is **not defined by this feature** — see Q-2.
- **Entity: `Source` (read-only dependency)** — the persisted source selection owned by `cs-source-selection`; this feature reads only the source stack's display name for FR-1.4.
- **Entity: `StepGate` (transient contract, new)** — what a step panel publishes to the chrome: whether its gate is satisfied, an explanation when not, and its advance work. Not persisted.

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** the wizard is open on the Destination step
  - **When** the chrome renders
  - **Then** the app bar shows "Migrate to Contentstack" and "Step 3 of 7 · {Destination's app-bar title}".
- **AC-1.2:**
  - **Given** the wizard is open on any step
  - **When** the tracker renders
  - **Then** it lists exactly seven steps in the order Source, Audit, Destination, Content mapping, Preview, Migrate, Verify.
- **AC-1.3:**
  - **Given** the wizard is open on the Destination step (index 3 of 7)
  - **When** the tracker renders
  - **Then** Source and Audit are marked complete with a check mark, Destination is marked active, and Content mapping, Preview, Migrate and Verify are marked upcoming with their numbers.
- **AC-1.4:**
  - **Given** the wizard is open on the Source step
  - **When** the tracker renders
  - **Then** no step is marked complete.
- **AC-1.5:**
  - **Given** the wizard is open on the Verify step
  - **When** the tracker renders
  - **Then** all six earlier steps are marked complete.

### AC for UC-2

- **AC-2.1:**
  - **Given** the project's persisted source selection names the stack "marketing-prod"
  - **When** the app bar renders
  - **Then** the source indicator reads "Source: marketing-prod (Contentstack)".
- **AC-2.2:**
  - **Given** no source selection is persisted for the project
  - **When** the app bar renders
  - **Then** the source indicator reads "Source: Not selected".
- **AC-2.3:**
  - **Given** the persisted source stack's name is longer than the space available in the app bar
  - **When** the app bar renders
  - **Then** the name is truncated with an ellipsis and the app bar's height is unchanged.

### AC for UC-3

- **AC-3.1:**
  - **Given** the wizard is on the Destination step and its panel reports its gate is satisfied
  - **When** the footer renders
  - **Then** the primary action is enabled and labelled "Proceed to content mapping".
- **AC-3.2:**
  - **Given** the wizard is on the Destination step with a satisfied gate
  - **When** the user clicks the primary action and the panel's advance work reports success
  - **Then** the chrome navigates to the Content mapping step and Destination is marked complete in the tracker.
- **AC-3.3:**
  - **Given** the wizard is on a step whose panel reports its gate is not satisfied
  - **When** the footer renders
  - **Then** the primary action is disabled.
- **AC-3.4:**
  - **Given** the primary action is disabled because the gate is not satisfied
  - **When** the user clicks it
  - **Then** no navigation occurs and the panel's advance work is not started.
- **AC-3.5:**
  - **Given** the wizard is on a step with a satisfied gate
  - **When** the user clicks the primary action and the panel's advance work reports failure
  - **Then** the chrome does not navigate and the user remains on that step.
- **AC-3.6:**
  - **Given** the panel's advance work has been started and has not yet finished
  - **When** the user clicks the primary action again
  - **Then** the advance work is not started a second time.
- **AC-3.7:**
  - **Given** the wizard is on a step whose panel publishes no gate information
  - **When** the footer renders
  - **Then** the primary action is enabled.

### AC for UC-4

- **AC-4.1:**
  - **Given** the wizard is on the Source step
  - **When** the footer renders
  - **Then** the **Back** button is present and disabled.
- **AC-4.2:**
  - **Given** the wizard is on the Destination step
  - **When** the user clicks **Back**
  - **Then** the chrome navigates to the Audit step.
- **AC-4.3:**
  - **Given** the wizard is on the Destination step, whose selection was previously persisted, and the user navigates back and then forward again
  - **When** the Destination step renders
  - **Then** its previously persisted selection is restored.

### AC for UC-5

- **AC-5.1:**
  - **Given** the wizard is on the Destination step, so Source and Audit are complete
  - **When** the user clicks Source in the tracker
  - **Then** the chrome navigates to the Source step.
- **AC-5.2:**
  - **Given** the wizard is on the Destination step
  - **When** the user clicks Preview in the tracker
  - **Then** nothing happens and the user remains on Destination.
- **AC-5.3:**
  - **Given** the wizard is on the Destination step
  - **When** the user clicks Destination in the tracker
  - **Then** the user remains on Destination and nothing changes.

### AC for UC-6

- **AC-6.1:**
  - **Given** the wizard is on the Destination step
  - **When** the footer renders
  - **Then** the status line reads "Configure the destination stack, then proceed to content mapping."
- **AC-6.2:**
  - **Given** the wizard is on the Source step
  - **When** the footer renders
  - **Then** the status line reads "Configure your source stack, then proceed to the audit."
- **AC-6.3:**
  - **Given** the wizard is on the Audit step and the audit is not yet ready
  - **When** the footer renders
  - **Then** the status line reads "Generating audit — you can continue once it finishes".
- **AC-6.4:**
  - **Given** the wizard is on the Audit step, the audit is ready, and nothing was excluded
  - **When** the footer renders
  - **Then** the status line reads "Audit complete — nothing excluded".
- **AC-6.5:**
  - **Given** the wizard is on the Audit step, the audit is ready, 12 items were excluded and 480 will migrate
  - **When** the footer renders
  - **Then** the status line reads "Audit complete — 12 excluded, 480 will migrate".
- **AC-6.6:**
  - **Given** the wizard is on the Source step and its gate is not satisfied
  - **When** the user hovers the disabled primary action
  - **Then** the explanation "Review your source, then proceed to the audit" is revealed.
- **AC-6.7:**
  - **Given** the wizard is on the Audit step and the audit is not ready
  - **When** the user hovers the disabled primary action
  - **Then** the explanation "Finish the audit to continue" is revealed.

## 12. Edge cases & error scenarios

- **EC-1:** No source selection is persisted for the project → the app bar's source indicator reads "Source: Not selected"; the chrome still renders normally.
- **EC-2:** The current panel's gate is not satisfied → the primary action is disabled, clicking it does nothing, and the panel's advance work is not started.
- **EC-3:** The current panel's advance work fails (for example the Destination step's management-token creation is rejected) → the chrome does not navigate; the user remains on the step so the panel can show its own error.
- **EC-4:** The user clicks a step later than the current one in the tracker → nothing happens; upcoming steps are not interactive.
- **EC-5:** The route names a step that does not exist in the seven-step list → expected behaviour is `TBD — Open Question` (Q-8).
- **EC-6:** The route names a valid step the user has not reached yet (e.g. a shared or bookmarked deep link to Preview on a fresh project) → expected behaviour is `TBD — Open Question` (Q-8).
- **EC-7:** The persisted source stack's name is very long → truncated with an ellipsis in the app bar; the layout does not shift.
- **EC-8:** Reading the persisted source for the app bar fails or times out → the source indicator falls back to "Source: Not selected" and the failure does not block the chrome from rendering.
- **EC-9:** The viewport is too narrow for seven tracker steps side by side → behaviour is `TBD — Open Question` (Q-7); the page MUST NOT scroll horizontally.
- **EC-10:** The user clicks **Back** while a panel's advance work is in progress → expected behaviour is `TBD — Open Question` (Q-9).
- **EC-11:** A step panel reports its gate is satisfied but publishes no advance work → the chrome navigates to the next step without asking the panel to do anything.

## 13. Dependencies & integrations

- **DEP-1:** The persisted `source` selection owned by `cs-source-selection` (`../cs-source-selection/feature.md`) — read-only, for the app bar's source stack name (FR-1.4). Contract owner: `cs-source-selection`.
- **DEP-2:** The `cs-destination-selection` feature (`../cs-destination-selection/feature.md`) — it is the first panel that will publish a `StepGate` and an advance action to this chrome, and it keeps its own in-panel advance button (FR-4.5). Its FR-6.1 gating logic and its FR-6.3 advance work become the chrome's first consumer. Bidirectional contract; needs joint sign-off.
- **DEP-3:** The standalone `/v3` architecture, routing and auth conventions established by `cs-source-selection`. This chrome must live in `/v3` and share nothing with the v2 app.
- **DEP-4:** The shared `/v3` design-system tokens and primitives (`ui/v3/styles/theme.css`) — the chrome must use them rather than introducing new values.
- **DEP-5:** The whichever-feature-owns-it source of `WizardProgress` (Q-2). Blocking for the tracker's completion marks and for FR-2.5's interactivity rule.
- **DEP-6 (forward):** The not-yet-specified Audit, Content mapping, Preview, Migrate and Verify features will each need to publish a `StepGate` to this chrome, and each needs its copy strings (Q-3, Q-4) settled.

## 14. Assumptions & constraints

- **A-1:** The wizard is linear: every step has exactly one successor and one predecessor, in the FR-2.1 order. No branching.
- **A-2:** The seven-step list is fixed for this release; steps are not added, removed or reordered at runtime.
- **A-3:** The current step is always derivable from the route (FR-6.2); the chrome holds no separate notion of "where I am".
- **A-4:** A step panel and the chrome render in the same client application, so the `StepGate` contract can be an in-process one rather than an API.
- **A-5:** The design's app bar and footer constrain their content to a 1100px-wide centred column, whereas the existing Destination panel uses 1180px. Assumed to be reconciled in favour of one value — see Q-10.
- **C-1:** Must consume only the existing `/v3` design-system tokens and primitives; no new component library.
- **C-2:** The Destination panel's existing in-panel advance button stays (confirmed decision), so this feature cannot assume the footer is the only advance affordance.

## 15. Risks

- **R-1:** `WizardProgress` (Q-2) is undefined, yet the tracker's completion marks and FR-2.5's interactivity both depend on it — likelihood high / impact high — settle Q-2 before implementation; only Source and Destination have any notion of completion today, so a naive "derive from the route" reading would mark steps complete that a user merely walked past.
- **R-2:** Keeping both the footer gate and the Destination panel's in-panel button doubles the advance affordance, and the two could drift into disagreeing about whether advancing is possible — likelihood medium / impact high — FR-4.5 requires a single shared gate state and a single shared advance action; treat any duplication of that logic as a defect.
- **R-3:** Five of the seven steps do not exist yet, so their gate conditions and copy (Q-3, Q-4) are unknown — likelihood high / impact medium — build the chrome data-driven over the step list so a new step is a data addition, not a code change.
- **R-4:** Moving navigation into the chrome (FR-6.1) touches the already-shipped Source panel, which currently draws its own page-level navigation — likelihood medium / impact medium — coordinate with `cs-source-selection`'s owner before changing it.
- **R-5:** Seven steps plus the app bar's source indicator is a lot of horizontal content; narrow viewports may not accommodate it (Q-7, NFR-6) — likelihood medium / impact low — decide the narrow-viewport treatment before implementation rather than discovering it in review.

## 16. Open questions

- **Q-1:** Success-metric threshold for G-1. — owner: Product — needed by: PRD.
- **Q-2 (BLOCKING):** How is "this step is complete" determined and persisted (`WizardProgress`, DEP-5)? Deriving it from the current route would mark steps complete that the user only passed through. Which feature owns this store? — owner: Eng/Product — needed by: implementation start.
- **Q-3:** Primary-action labels, footer status lines and disabled-state explanations for the steps the design does not cover: Migrate and Verify (FR-5.1, FR-5.2, FR-5.4). — owner: Design — needed by: those steps' own specs.
- **Q-4:** App-bar step titles for Source, Destination, Migrate and Verify (FR-5.5). The design shows only Audit → "Audit report", Content mapping → "Content mapping", Preview → "Preview & run", and these are not simply the tracker labels. — owner: Design — needed by: implementation start.
- **Q-5:** Performance budget for NFR-4 (source-indicator fetch). — owner: Eng — needed by: TRD.
- **Q-6:** Exact supported browser matrix (NFR-5). — owner: Product/QA — needed by: test-case stage.
- **Q-7:** Narrow-viewport treatment for the seven-step tracker — scroll horizontally within the tracker, collapse to "Step 3 of 7" only, or something else (NFR-6, EC-9)? The design provides no mobile layout. — owner: Design — needed by: implementation start.
- **Q-8:** Behaviour for a route naming an unknown step (EC-5) or a valid step the user has not reached (EC-6) — redirect to the furthest reachable step, redirect to Source, or render it anyway? Depends on Q-2. — owner: Eng/Product — needed by: TRD.
- **Q-9:** Should **Back** be blocked while a panel's advance work is in progress (EC-10)? — owner: Eng — needed by: TRD.
- **Q-10:** The design constrains the app bar and footer to a 1100px centred column while the shipped Destination panel uses 1180px (A-5). Which is correct, and should both be the same? — owner: Design — needed by: implementation start.
- **Q-11:** The seven-step list in this spec (FR-2.1) is taken from the design and includes Preview and Verify, which `cs-destination-selection`'s own spec does not mention in its description of the flow (its Q-2 / R-4 flag exactly this conflict). Confirmed here as the design's seven steps — does `cs-destination-selection`'s "After you proceed" copy need updating to match? — owner: Product/Design — needed by: PRD.
- **Q-16:** The five primary-action labels in FR-5.1 do not agree on casing for the step they name: four use a lower-case target ("Proceed to audit", "Proceed to content mapping", "Continue to preview") while the corrected Audit label uses "Continue to **D**estination". Should all five be lower-case, all five title-case, or is the inconsistency intended? — owner: Design — needed by: release.

## 17. Out-of-band references

- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**. This spec cites three regions of that page: the **app bar** (product mark, title, "Step n of 7" label, source indicator), the **step tracker** (seven steps with complete/active/upcoming treatments), and the **sticky footer** (Back, status line, gated primary action). The step panels on that same page are out of scope here — Source and Destination are covered by their own specs, and the centred toast above the footer is explicitly out of scope (§5).
- `../cs-source-selection/feature.md` — sibling spec; owns the Source panel and the persisted source this feature reads (DEP-1).
- `../cs-destination-selection/feature.md` — sibling spec; the chrome's first `StepGate` consumer, and the origin of the retained in-panel advance button (DEP-2, C-2).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
