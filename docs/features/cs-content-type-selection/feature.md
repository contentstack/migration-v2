# Feature Spec: Content mapping — content type selection

- **Slug:** `cs-content-type-selection`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-10
- **Last updated:** 2026-08-10

## 1. Summary

The first of three interfaces in the v3 Content mapping step. It lists every content type found in the exported source stack, lets the operator tick the ones that should migrate, and — for a content type that already exists in the destination stack under the same name — lets them decide whether the source schema wins, the destination schema is left alone, or the two are merged.

## 2. Problem statement

v3 can connect a source stack, export it, and audit it — but it cannot yet scope a migration. Today the operator's only options are "migrate everything that was exported" or "do not migrate". There is no way to say *these twelve content types, not the other hundred*.

The second gap is worse, because it is silent. A destination stack is frequently **not empty** — it may be a staging stack, a partially-migrated stack, or a stack someone else built. When a source content type and a destination content type share a name, the tool currently has no expressed intent for what should happen. Any behaviour it picks is a guess, and two of the three plausible guesses destroy work: overwriting a destination schema the destination team authored, or silently skipping content the operator expected to arrive.

This screen is where both intents get captured, before anything is written to the destination.

## 3. Target users / personas

- **Migration engineer (PRIMARY)** — runs the migration end to end, usually against a stack they did not author. Cares about: scoping a migration down to what is actually wanted, and not discovering after the fact that the tool overwrote a schema in the destination.
- **Content operations owner (SECONDARY)** — knows which models are live and which are abandoned. Cares about: recognising the content types by name, and understanding what "already in destination" means for their existing content before agreeing to it.

## 4. Goals & success metrics

- **G-1:** An operator can scope a migration to a subset of source content types — measured by: a saved selection containing fewer content types than the export contains, replayable on revisit.
- **G-2:** No destination content type is modified without an explicitly recorded intent — measured by: every content type saved with `alreadyInDestination = true` carries one of the three conflict modes; zero saved records with a conflicting type and no mode.
- **G-3:** An operator is warned before removing a content type another selected content type depends on — measured by: the confirmation appears in 100% of unticks that break a reference from a currently-selected type, and never otherwise.
- **G-4:** Selections survive navigation and revisit — measured by: no selection loss on leaving and returning to the step. `TBD — Open Question` for a numeric target (Q-4).

## 5. Non-goals / out of scope

- **Field mapping and schema restructuring (interface 2).** Move, add field, add block, convert group → modular block, add fields from another source content type, the destination content type dropdown, and Compare changes are all a separate feature. This screen renders the `map fields →` affordance but disables it.
- **Entry selection (interface 3).** Choosing which entries of a type migrate is a separate feature. This screen renders the `entries →` affordance but disables it. It is also expected to change before it is built.
- **The Review scope screen.** That is step 5 (Preview) in the wizard tracker, a separate feature.
- **Automatic selection of referenced content types.** Ticking a type does NOT tick the types it references. The dependency graph is computed, but used only to warn on untick (UC-5) — never to change a selection on the operator's behalf.
- **Counting dependencies in the footer.** The footer count is the number of ticked content types, nothing more. The prototype's `1 manual · 4 auto · 1 global` breakdown and the `≈ N entries` estimate are explicitly not built.
- **Entry-level semantics of `Merge`.** `Merge` in this feature describes a **schema** outcome only. What happens to entries of a merged content type is undecided and deferred (Q-1).
- **Writing anything to the destination stack.** This screen records intent. No content type is created, updated or deleted in the destination by this feature.
- **Selecting global fields, assets, taxonomies or locales.** Only content types are selectable here.
- **Resolving broken references.** An operator may save a selection whose references are unsatisfiable; this feature warns (UC-5) but does not prevent it.

## 6. Use cases

### UC-1: Choose which content types migrate

- **Actor:** Migration engineer
- **Trigger:** The operator reaches the Content mapping step with a completed source export.
- **Preconditions:** A project exists with a successful source export on disk, and a destination stack has been selected and persisted.
- **Main flow:**
  1. The screen lists every content type in the source export, each with a checkbox, its display name, and its uid.
  2. The operator ticks the content types that should migrate.
  3. The footer count updates to the number of ticked content types.
- **Postconditions / success state:** The working selection holds exactly the ticked content types. Nothing is persisted yet.
- **Alternate flows:**
  - The operator unticks a previously ticked content type; if UC-5's condition holds, the confirmation appears first.
- **Priority:** P0

### UC-2: Find a content type in a large list

- **Actor:** Migration engineer
- **Trigger:** The source export contains more content types than fit on one screen.
- **Preconditions:** As UC-1.
- **Main flow:**
  1. The list initially renders a first page of content types and states how many of the total are shown.
  2. The operator either presses the load-more control to append the next page, or types a term into the search box.
  3. Searching filters the full set of content types by name, not only the loaded page.
- **Postconditions / success state:** The operator can reach and tick any content type in the export.
- **Alternate flows:**
  - The search matches nothing; an empty-result state is shown and no rows are listed.
  - The operator clears the search; the list returns to its paged state with the previously loaded page size retained.
- **Priority:** P0

### UC-3: Select or clear every content type at once

- **Actor:** Migration engineer
- **Trigger:** The operator wants all content types, or wants to start from an empty selection.
- **Preconditions:** As UC-1.
- **Main flow:**
  1. The operator ticks the select-all control.
  2. Every content type in the export is ticked — not only the ones currently loaded or currently matching a search.
  3. The operator unticks the select-all control; every content type is unticked.
- **Postconditions / success state:** The working selection contains all content types, or none.
- **Alternate flows:**
  - A search term is active: select-all applies to the matching content types only, and its label reflects the matching count.
- **Priority:** P1

### UC-4: Decide what happens to a content type that already exists in the destination

- **Actor:** Content operations owner
- **Trigger:** The operator ticks a content type whose name matches a content type in the destination stack.
- **Preconditions:** The destination stack's content types have been read successfully.
- **Main flow:**
  1. The row carries an `already in destination` label from the moment the list renders, whether or not it is ticked.
  2. On ticking the row, a three-option control appears offering `Use source`, `Keep destination` and `Merge`.
  3. `Use source` is pre-selected.
  4. The operator may change the choice; it is recorded against that content type.
- **Postconditions / success state:** The working selection records a conflict mode for that content type.
- **Alternate flows:**
  - The operator unticks the row; the control disappears and no conflict mode is retained for an unselected content type.
- **Priority:** P0

### UC-5: Untick a content type that a selected content type references

- **Actor:** Migration engineer
- **Trigger:** The operator unticks content type `X` while a ticked content type `Y` has a reference field pointing at `X`.
- **Preconditions:** The reference graph has been computed from the source schemas.
- **Main flow:**
  1. The operator unticks `X`.
  2. A confirmation dialog appears, naming the ticked content types that reference `X`.
  3. The operator confirms; `X` is unticked.
- **Postconditions / success state:** `X` is not in the working selection, and the operator has been told which selected content types now have unsatisfiable references.
- **Alternate flows:**
  - The operator cancels; `X` remains ticked and nothing else changes.
  - No ticked content type references `X`; `X` is unticked immediately with no dialog.
- **Priority:** P0

### UC-6: Save the selection without leaving the step

- **Actor:** Migration engineer
- **Trigger:** The operator presses the save control in the panel header.
- **Preconditions:** A working selection exists.
- **Main flow:**
  1. The operator presses the save control.
  2. The selection and its conflict modes are written to the project record.
  3. The operator is told the save succeeded and remains on the step.
- **Postconditions / success state:** The persisted selection equals the working selection.
- **Alternate flows:**
  - The write fails; an error is surfaced and the working selection is left untouched.
- **Priority:** P0

### UC-7: Move on to the next step

- **Actor:** Migration engineer
- **Trigger:** The operator presses the wizard footer's primary action.
- **Preconditions:** A working selection exists.
- **Main flow:**
  1. The operator presses the footer action.
  2. The current selection and conflict modes are persisted.
  3. Only on a successful write does the wizard advance.
- **Postconditions / success state:** The selection is persisted and the wizard has moved to the next step.
- **Alternate flows:**
  - The write fails; the wizard does not advance, an error is surfaced, and the working selection is preserved.
- **Priority:** P0

### UC-8: Return to a previously saved selection

- **Actor:** Migration engineer
- **Trigger:** The operator navigates back to the Content mapping step in a project where a selection was saved earlier.
- **Preconditions:** A persisted selection exists on the project record.
- **Main flow:**
  1. The screen loads the source content type list.
  2. Content types present in the persisted selection render ticked, with their saved conflict modes restored.
  3. The footer count reflects the restored selection.
- **Postconditions / success state:** The operator sees exactly what they last saved.
- **Alternate flows:**
  - A persisted content type is no longer present in the export (the source was re-exported); it is dropped from the restored selection (EC-11).
- **Priority:** P1

## 7. User flows (optional detail)

Covered inline in §6. One cross-screen note: this screen is rendered inside the shared migration wizard chrome (`migration-wizard-chrome`). The chrome owns the app bar, the step tracker, the Back control and the primary action. This panel contributes only its body, a status line, and a step gate — it does not render a footer of its own and does not navigate.

## 8. Functional requirements

### FR — Source data

- **FR-1.1:** The system MUST read the list of source content types from the project's completed export on disk, not from the source stack over the network.
- **FR-1.2:** The system MUST expose, for each source content type, its uid and its display title.
- **FR-1.3:** The system MUST compute a reference graph from the source content type schemas, recording for each content type the set of content type uids its reference fields point at.
- **FR-1.4:** The reference graph computation MUST descend into nested field containers — groups, modular block types, and global field schemas — so that a reference field nested inside them is not missed.
- **FR-1.5:** The system MUST treat a reference field naming multiple target content types as producing one graph edge per named target.
- **FR-1.6:** The system MUST exclude a content type's self-reference from the graph edges used to trigger UC-5's confirmation.

### FR — Destination data

- **FR-2.1:** The system MUST read the destination stack's content types using the destination management token stored on the project record.
- **FR-2.2:** The system MUST mark a source content type as already present in the destination when a destination content type shares its **uid**.
- **FR-2.3:** The uid comparison in FR-2.2 MUST be exact and case-sensitive.
- **FR-2.4:** When the destination content types cannot be read, the system MUST still render the source list and MUST NOT mark any content type as already present in the destination.

### FR — List, search and paging

- **FR-3.1:** The list MUST render an initial page of content types and MUST state how many of the total are currently shown.
- **FR-3.2:** The list MUST provide a control that appends the next page of content types.
- **FR-3.3:** The load-more control MUST NOT be rendered when every content type is already shown.
- **FR-3.4:** The search MUST filter on content type display title, case-insensitively.
- **FR-3.5:** The search MUST filter the complete set of source content types, not only the pages already loaded.
- **FR-3.6:** While a search term is active, the paging controls MUST NOT be rendered and every match MUST be listed.
- **FR-3.7:** Clearing the search MUST restore the paged list at the page size that was loaded before the search began.
- **FR-3.8:** A search matching no content type MUST render an empty-result state and no content type rows.
- **FR-3.9:** Newly appended rows MUST render with their persisted or working tick state, never unticked-by-default.

### FR — Selection

- **FR-4.1:** Each content type row MUST expose a checkbox whose checked state is that content type's presence in the working selection.
- **FR-4.2:** Ticking a row MUST add that content type to the working selection; unticking MUST remove it.
- **FR-4.3:** The select-all control MUST add every content type in the export to the working selection, not only those currently rendered.
- **FR-4.4:** Unticking the select-all control MUST empty the working selection.
- **FR-4.5:** While a search term is active, the select-all control MUST act on the matching content types only, and its label MUST state the number of matches.
- **FR-4.6:** The select-all control MUST render as checked only when every content type in its current scope is in the working selection.
- **FR-4.7:** Ticking a content type MUST NOT add any other content type to the working selection.

### FR — Destination conflict

- **FR-5.1:** A content type marked as already present in the destination MUST render a persistent `already in destination` label, whether or not it is ticked.
- **FR-5.2:** A three-option control offering `Use source`, `Keep destination` and `Merge` MUST be rendered for a content type that is both ticked and already present in the destination.
- **FR-5.3:** That control MUST NOT be rendered for a content type that is not ticked.
- **FR-5.4:** That control MUST NOT be rendered for a ticked content type that is not present in the destination.
- **FR-5.5:** When the control first appears for a content type, `Use source` MUST be the selected option.
- **FR-5.6:** Changing the option MUST record the new mode against that content type in the working selection.
- **FR-5.7:** The absence of a conflict decision MUST NOT block saving or advancing.
- **FR-5.8:** Unticking a content type MUST discard its conflict mode; re-ticking it MUST start again at `Use source`.
- **FR-5.9:** Each conflict option MUST carry an explanation of its outcome: `Use source` — "Replace the destination schema with the source content type"; `Keep destination` — "Leave the destination schema untouched — only entries migrate"; `Merge` — "Keep destination fields and add the new fields from the source".

### FR — Reference confirmation

- **FR-6.1:** When the operator unticks content type `X`, the system MUST determine the set of content types that are currently ticked and hold a reference edge to `X`.
- **FR-6.2:** When that set is non-empty, the system MUST show a confirmation dialog and MUST NOT untick `X` until the operator confirms.
- **FR-6.3:** The dialog MUST name the ticked content types in that set, by display title.
- **FR-6.4:** Confirming MUST untick `X` and MUST change nothing else in the working selection.
- **FR-6.5:** Cancelling MUST leave `X` ticked and MUST change nothing else in the working selection.
- **FR-6.6:** When that set is empty, the system MUST untick `X` immediately and MUST NOT show the dialog.
- **FR-6.7:** The unticking performed by the select-all control (FR-4.4) MUST NOT raise this confirmation.
- **FR-6.8:** A content type referenced only by content types that are NOT ticked MUST NOT raise this confirmation.

### FR — Drill-in affordances

- **FR-7.1:** A ticked content type row MUST render a `map fields` affordance and an `entries` affordance.
- **FR-7.2:** Both affordances MUST be rendered in a disabled state and MUST NOT navigate anywhere.
- **FR-7.3:** Both affordances MUST be absent from a row that is not ticked.
- **FR-7.4:** Both affordances MUST be excluded from the keyboard tab order while disabled.

### FR — Footer and gate

- **FR-8.1:** The panel MUST publish a status line reading the number of ticked content types, worded `N content types ship`, and `1 content type ships` when exactly one is ticked.
- **FR-8.2:** The status line MUST read `No content types selected` when the working selection is empty.
- **FR-8.3:** The status line MUST NOT include a manual/auto/global breakdown, an entry estimate, or an unmapped-field count.
- **FR-8.4:** The wizard footer's primary action for this step MUST be labelled `Move to review`.
- **FR-8.5:** The panel MUST NOT render a footer, a primary action, or a Back control of its own.
- **FR-8.6:** The primary action MUST persist the working selection before the wizard advances, and the wizard MUST advance only when that write succeeds.
- **FR-8.7:** The primary action MUST be disabled while a persist is in flight.

### FR — Persistence

- **FR-9.1:** The panel header MUST expose a save control that persists the working selection without navigating.
- **FR-9.2:** The save control MUST state the number of content types it will save.
- **FR-9.3:** A persisted record MUST contain, for each selected content type, its uid and — when it is already present in the destination — its conflict mode.
- **FR-9.4:** The persisted record MUST be written to the project record, and MUST NOT overwrite any other field of that record.
- **FR-9.5:** On revisiting the step, the working selection MUST be initialised from the persisted record.
- **FR-9.6:** A persisted content type uid that is absent from the current export MUST be dropped when the working selection is initialised.
- **FR-9.7:** A failed persist MUST leave the working selection exactly as the operator left it.
- **FR-9.8:** A successful persist MUST be acknowledged to the operator.
- **FR-9.9:** Persisting MUST NOT create a project; an unknown project MUST be rejected.

## 9. Non-functional requirements

- **NFR-1 (Performance):** Building the content type list and the reference graph from an export containing 200 content types MUST complete in under 2 seconds on the server.
- **NFR-2 (Performance):** Ticking, unticking and searching MUST be resolved on the client against already-loaded data, with no network request per keystroke or per tick.
- **NFR-3 (Security):** The destination management token MUST NOT appear in any response body, log line, or client-visible payload.
- **NFR-4 (Security):** All endpoints introduced by this feature MUST require a valid session, and MUST resolve the project within the caller's scope.
- **NFR-5 (Accessibility):** WCAG 2.1 AA. Every checkbox, the conflict control and the confirmation dialog MUST be operable by keyboard alone, and each MUST carry an accessible name identifying the content type it acts on.
- **NFR-6 (Accessibility):** Selection state, conflict mode and the `already in destination` label MUST be conveyed by text, not by colour alone.
- **NFR-7 (Accessibility):** The confirmation dialog MUST take focus when opened and return focus to the checkbox that raised it when dismissed.
- **NFR-8 (Reliability):** Navigating away from the step and back MUST NOT lose a persisted selection.
- **NFR-9 (Observability):** A failed read of the destination content types MUST be logged with a fixed failure classification, and MUST NOT log the stack API key or the token.
- **NFR-10 (Compatibility):** Chrome, Edge, Firefox and Safari, latest two major versions each — matching the rest of the v3 UI.

## 10. Data & entities

- **Entity: `SourceContentTypeInventory`** — the derived list this screen renders. Purpose: the source of truth for what may be selected. Key contents: per content type, its uid, display title, and the set of content type uids it references. Lifecycle: computed from the export on disk on each load; not persisted; discarded when the export is replaced. Derived, never authored.

- **Entity: `DestinationContentTypeIndex`** — the set of content type uids present in the destination stack. Purpose: deciding which source content types carry the `already in destination` label. Lifecycle: read from the destination stack per load; not persisted; absent when the read fails (FR-2.4).

- **Entity: `ContentTypeSelection`** — the operator's choices for one project, and the only part of this screen they author. Purpose: what interfaces 2 and 3, and ultimately the migration, consume. Key contents: the set of selected content type uids; a conflict mode (`source` / `dest` / `merge`) per selected content type that exists in the destination; a last-updated timestamp. Lifecycle: created on the first save, updated on every subsequent save, persisted with the project, and preserved across re-exports subject to FR-9.6. Scoped with the project (NFR-4).

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** an export containing 6 content types and no persisted selection
  - **When** the Content mapping step loads
  - **Then** 6 rows render, each with an unticked checkbox, a display title and a uid, and the status line reads `No content types selected`
- **AC-1.2:**
  - **Given** the list from AC-1.1
  - **When** the operator ticks the content type `blog_article`
  - **Then** the working selection is exactly `['blog_article']` and the status line reads `1 content type ships`
- **AC-1.3:**
  - **Given** `blog_article` and `product` are ticked
  - **When** the operator reads the status line
  - **Then** it reads `2 content types ship`
- **AC-1.4:**
  - **Given** `blog_article` is ticked and no ticked content type references it
  - **When** the operator unticks `blog_article`
  - **Then** the working selection is empty and the status line reads `No content types selected`
- **AC-1.5:**
  - **Given** an export in which `blog_article` has a reference field pointing at `person`
  - **When** the operator ticks `blog_article`
  - **Then** `person` remains unticked and the status line reads `1 content type ships`

### AC for UC-2

- **AC-2.1:**
  - **Given** an export containing 120 content types and a page size of 25
  - **When** the step loads
  - **Then** 25 rows render and the list states `Showing 25 of 120`
- **AC-2.2:**
  - **Given** the state in AC-2.1
  - **When** the operator presses the load-more control
  - **Then** 50 rows render and the list states `Showing 50 of 120`
- **AC-2.3:**
  - **Given** all 120 content types are shown
  - **When** the operator looks for the load-more control
  - **Then** it is not present
- **AC-2.4:**
  - **Given** 120 content types of which 2 have titles containing `site`, and only the first 8 are loaded
  - **When** the operator types `site` into the search
  - **Then** both matching content types render, including one that was not among the loaded 8
- **AC-2.5:**
  - **Given** a search term matching no content type
  - **When** the results render
  - **Then** no content type rows are present and an empty-result state is shown
- **AC-2.6:**
  - **Given** 50 rows were loaded and then a search was applied
  - **When** the operator clears the search
  - **Then** 50 rows render again, not 25

### AC for UC-3

- **AC-3.1:**
  - **Given** an export containing 120 content types of which 25 are loaded, and an empty selection
  - **When** the operator ticks the select-all control
  - **Then** the working selection contains all 120 content type uids and the status line reads `120 content types ship`
- **AC-3.2:**
  - **Given** the state in AC-3.1
  - **When** the operator presses the load-more control
  - **Then** the 25 newly rendered rows are all ticked
- **AC-3.3:**
  - **Given** every content type is selected
  - **When** the operator unticks the select-all control
  - **Then** the working selection is empty and no confirmation dialog is shown
- **AC-3.4:**
  - **Given** a search term matching exactly 2 content types
  - **When** the operator ticks the select-all control
  - **Then** only those 2 content types are added to the working selection and the control is labelled with the matching count
- **AC-3.5:**
  - **Given** 119 of 120 content types are selected
  - **When** the select-all control renders
  - **Then** it is not in the checked state

### AC for UC-4

- **AC-4.1:**
  - **Given** the destination stack contains a content type with uid `landing_page` and the source export also contains `landing_page`
  - **When** the list renders and `landing_page` is unticked
  - **Then** the `landing_page` row shows the label `already in destination` and no conflict control
- **AC-4.2:**
  - **Given** the state in AC-4.1
  - **When** the operator ticks `landing_page`
  - **Then** a control offering `Use source`, `Keep destination` and `Merge` appears on that row with `Use source` selected
- **AC-4.3:**
  - **Given** `landing_page` is ticked with `Use source` selected
  - **When** the operator chooses `Merge`
  - **Then** the working selection records the conflict mode `merge` for `landing_page`
- **AC-4.4:**
  - **Given** `landing_page` is ticked with `Merge` selected
  - **When** the operator unticks and re-ticks `landing_page`
  - **Then** the conflict control shows `Use source` selected again
- **AC-4.5:**
  - **Given** the source content type `press_release` has no counterpart in the destination
  - **When** the operator ticks `press_release`
  - **Then** no `already in destination` label and no conflict control are rendered on that row
- **AC-4.6:**
  - **Given** a ticked conflicting content type
  - **When** each conflict option is inspected
  - **Then** each carries its FR-5.9 explanation verbatim

### AC for UC-5

- **AC-5.1:**
  - **Given** `blog_article` is ticked and has a reference field pointing at `person`, and `person` is ticked
  - **When** the operator unticks `person`
  - **Then** a confirmation dialog appears naming `Blog Article`, and `person` is still in the working selection
- **AC-5.2:**
  - **Given** the dialog from AC-5.1
  - **When** the operator confirms
  - **Then** `person` is removed from the working selection and `blog_article` remains in it
- **AC-5.3:**
  - **Given** the dialog from AC-5.1
  - **When** the operator cancels
  - **Then** `person` remains in the working selection and the dialog closes
- **AC-5.4:**
  - **Given** `person` is ticked and `blog_article` — the only content type referencing it — is NOT ticked
  - **When** the operator unticks `person`
  - **Then** `person` is removed immediately and no dialog appears
- **AC-5.5:**
  - **Given** `blog_article` and `product` are both ticked and both reference `person`, and `person` is ticked
  - **When** the operator unticks `person`
  - **Then** the dialog names both `Blog Article` and `Product`
- **AC-5.6:**
  - **Given** a content type whose only reference edge points at itself, and it is ticked
  - **When** the operator unticks it
  - **Then** it is removed immediately and no dialog appears
- **AC-5.7:**
  - **Given** `blog_article` is ticked and references `person` only through a reference field nested inside a modular block
  - **When** the operator unticks `person`
  - **Then** the dialog appears naming `Blog Article`

### AC for UC-6

- **AC-6.1:**
  - **Given** a working selection of `blog_article` (conflict-free) and `landing_page` with mode `merge`
  - **When** the operator presses the save control
  - **Then** the persisted record contains both uids and records `merge` for `landing_page` only
- **AC-6.2:**
  - **Given** the save succeeds
  - **When** the write completes
  - **Then** the operator is shown a success acknowledgement and remains on the Content mapping step
- **AC-6.3:**
  - **Given** a working selection of 3 content types
  - **When** the save control renders
  - **Then** it states that it will save 3 content types
- **AC-6.4:**
  - **Given** a working selection and a server that rejects the write
  - **When** the operator presses the save control
  - **Then** an error is shown and the working selection is unchanged
- **AC-6.5:**
  - **Given** a project record holding a destination management token secret
  - **When** a selection is persisted
  - **Then** the stored token secret is still present and unchanged on that record

### AC for UC-7

- **AC-7.1:**
  - **Given** a working selection that has never been saved
  - **When** the operator presses the wizard footer's primary action
  - **Then** the selection is persisted and only then does the wizard advance
- **AC-7.2:**
  - **Given** a server that rejects the write
  - **When** the operator presses the primary action
  - **Then** the wizard does not advance, an error is shown, and the working selection is preserved
- **AC-7.3:**
  - **Given** the Content mapping step is active
  - **When** the wizard footer renders
  - **Then** its primary action is labelled `Move to review`
- **AC-7.4:**
  - **Given** a persist is in flight
  - **When** the operator presses the primary action a second time
  - **Then** no second write is issued

### AC for UC-8

- **AC-8.1:**
  - **Given** a persisted selection of `blog_article` and `landing_page` with mode `keep destination`
  - **When** the operator returns to the Content mapping step
  - **Then** both rows render ticked, `landing_page` shows `Keep destination` selected, and the status line reads `2 content types ship`
- **AC-8.2:**
  - **Given** a persisted selection containing the uid `retired_type`, which is absent from the current export
  - **When** the step loads
  - **Then** no row is rendered for `retired_type` and it is absent from the working selection
- **AC-8.3:**
  - **Given** a project with no persisted selection
  - **When** the step loads
  - **Then** every row renders unticked and the status line reads `No content types selected`

## 12. Edge cases & error scenarios

- **EC-1:** The project has no completed source export → the step MUST show an explanation and a route back to the Source step, and MUST NOT render an empty content type list that reads as "this stack has no content types".
- **EC-2:** The export exists but its content type data cannot be read or parsed → the same error state as EC-1, distinguishable in logs but not necessarily in the UI.
- **EC-3:** The export contains zero content types → an empty state stating the export contains no content types, with the primary action disabled and the status line reading `No content types selected`.
- **EC-4:** The destination content types cannot be read (network failure, revoked token, insufficient scope) → the source list still renders, no row carries `already in destination`, no conflict control is offered, and the operator is told the destination could not be checked.
- **EC-5:** No destination management token is stored on the project → treated exactly as EC-4.
- **EC-6:** The persist request fails with a server error → an error is surfaced, the working selection is untouched, and the wizard does not advance.
- **EC-7:** The persist request targets a project that does not exist or is out of the caller's scope → rejected; no project is created.
- **EC-8:** The operator presses the primary action twice in rapid succession → exactly one write is issued.
- **EC-9:** Two browser tabs save different selections for the same project → last write wins, with no merge and no conflict warning. `TBD — Open Question` whether that is acceptable (Q-5).
- **EC-10:** A source content type's reference field names a content type uid that does not exist in the export → the dangling edge is ignored for UC-5 purposes and MUST NOT crash the graph computation.
- **EC-11:** The source is re-exported and previously selected content types no longer exist → those uids are dropped from the restored selection (FR-9.6) without an error.
- **EC-12:** The source is re-exported and a previously selected content type still exists but its references changed → the restored selection is unchanged; the reference graph is recomputed from the new export.
- **EC-13:** A source content type and a destination content type share a uid but have entirely different schemas → still marked `already in destination`; distinguishing them is interface 2's problem, not this screen's.
- **EC-14:** The export contains 500+ content types → the list remains paged and searchable, and NFR-1 still holds.
- **EC-15:** A search term contains regular-expression metacharacters → treated as a literal substring, not as a pattern.
- **EC-16:** The operator unticks a content type that references itself and is referenced by nothing ticked → no dialog (AC-5.6).
- **EC-17:** Select-all is pressed while a search is active and then the search is cleared → only the matched content types are selected; the rest remain unticked.

## 13. Dependencies & integrations

- **DEP-1:** `migration-wizard-chrome` — blocking. Owns the app bar, tracker, Back control, status line and primary action. This feature changes the Content mapping step's `actionLabel` to `Move to review` and supplies the step's status line and gate through the existing step-gate contract.
- **DEP-2:** The v3 source export on disk (`cs-source-selection`) — blocking, read-only. Supplies `content_types` for the list and the reference graph.
- **DEP-3:** The v3 destination selection and its stored management token (`cs-destination-selection`) — blocking, read-only. Supplies the credential used to read the destination stack's content types.
- **DEP-4:** The v3 project record store — blocking. Owns `ContentTypeSelection` persistence, and already holds the encrypted destination token that FR-9.4 must not disturb.
- **DEP-5:** Contentstack Content Management API — external, read-only here. Used to list destination content types.
- **DEP-6:** Interfaces 2 (field mapping) and 3 (entry selection) — non-blocking, downstream. They will consume `ContentTypeSelection`. This feature must not foreclose their needs; the disabled affordances in FR-7 are their entry points.
- **DEP-7:** `cs-audit-report` — non-blocking. Audit exclusions cover entries and assets, not content types, so they do not filter this list (A-4).

## 14. Assumptions & constraints

- **A-1:** The operator reaches this step only after a successful source export and a persisted destination selection; the wizard's own gating enforces that ordering.
- **A-2:** Content type identity across stacks is the uid. Two content types with the same uid are the same model; display titles are for humans only.
- **A-3:** `Merge` describes a schema outcome only. Nothing in this feature migrates, updates or deduplicates entries.
- **A-4:** Audit exclusions do not affect this screen, because content types were never made excludable in the audit — only unpublished entries and unused assets are.
- **A-5:** The reference graph derived from the source export is complete enough for UC-5's warning. References expressed outside a `reference` field — for example a uid embedded in free text — are out of scope.
- **A-6:** The number in the footer is the count of ticked content types and nothing else; it deliberately does not describe what the migration will actually pull in.
- **C-1:** v3 is standalone: this feature must import nothing from `api/src` or `ui/src`, and must mount only through the existing `/v3` router and `/v3/*` route seams.
- **C-2:** The destination management token is module-scoped and stored encrypted; it can be used but never returned to the client.
- **C-3:** The UI convention in v3 is inline style objects referencing `theme.css` custom properties; this feature follows it.

## 15. Risks

- **R-1:** **`Use source` is the pre-selected conflict mode, and it is the destructive one.** It replaces the destination schema. An operator who ticks a conflicting content type and does not read the control will overwrite a schema the destination team authored. Likelihood: medium — the control is per row and easy to skim past. Impact: high — schema loss in a live destination. Mitigation: FR-5.9 requires each option to state its outcome, FR-5.1 keeps the `already in destination` label permanently visible, and the choice is recorded per content type so it is auditable. Accepted deliberately; `Merge` was the non-destructive alternative and was not chosen.
- **R-2:** **A selection can be saved whose references are unsatisfiable.** UC-5 warns on untick, but an operator who simply never ticks `person` gets no warning at all, and the migration will later produce broken references. Likelihood: high. Impact: medium. Mitigation: none in this feature — dependency resolution is an explicit non-goal. Should be caught downstream, at Review scope or at migrate time.
- **R-3:** **Matching on uid may under-report conflicts.** A destination content type created by hand from the same model often has a different uid, so a real conflict goes unlabelled and the operator gets no choice. Likelihood: medium. Impact: medium. Mitigation: none in v1; recorded as Q-2.
- **R-4:** **The reference graph is computed on the client's behalf but the confirmation is a client decision.** If the graph is stale relative to a re-export, the warning may name the wrong content types. Likelihood: low. Impact: low. Mitigation: FR-1.3's graph is recomputed per load from the current export (EC-12).
- **R-5:** **Select-all over a large export creates a very large working selection.** With 500+ content types, the persisted record and every subsequent screen inherit that scale. Likelihood: low. Impact: medium. Mitigation: NFR-1 bounds the server work; EC-14 keeps the list paged.

## 16. Open questions

- **Q-1:** When `Merge` is chosen, what happens to *entries* of that content type — are they always created, matched-and-updated, or skipped? Deferred by the user during specification. Owner: Chirag Chavan — needed by: before interface 3 is specced, and before any migration writes entries.
- **Q-2:** Should the `already in destination` match fall back to display title when no uid matches, to catch hand-built destination content types (R-3)? Owner: Chirag Chavan — needed by: PRD.
- ~~**Q-3:** What is the initial page size for the content type list?~~ **RESOLVED — 25.** Chosen over the prototype's 8, which would force ~15 load-more presses on a 120-type stack. Recorded as [trd.md](./trd.md) TC-2; AC-2.1, AC-2.2, AC-2.6 and AC-3.1/AC-3.2 are written against it.
- **Q-4:** What is the numeric target for G-4 (selection survival), if any? Owner: Chirag Chavan — needed by: PRD.
- **Q-5:** Is last-write-wins acceptable for two tabs editing one project's selection (EC-9), or is a conflict warning required? Owner: Chirag Chavan — needed by: TRD.
- **Q-6:** Should the operator be warned at save or at `Move to review` when the selection contains unsatisfiable references (R-2), or is that entirely Review scope's job? Owner: Chirag Chavan — needed by: PRD.

## 17. Out-of-band references

- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Migration Tool Prototype"** — the source for all three Content mapping interfaces. This feature transcribes only its first screen: the content type list, the search and load-more controls, the `already in destination` label, the conflict control, and the panel's save control. The prototype's own header and footer bar are NOT transcribed; this panel renders inside the shared wizard chrome instead.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Content Map and Audit"** — an earlier combined exploration of the mapping and audit steps. Superseded for this feature by "Migration Tool Prototype"; listed so a reader who finds it knows it is not the reference.
- `docs/features/migration-wizard-chrome/feature.md` — the chrome this panel renders inside; owns the footer, the primary action and the step gate (DEP-1).
- `docs/features/cs-audit-report/feature.md` — the preceding step; establishes the step-gate and save-on-continue patterns this feature reuses (DEP-7).
- `docs/features/cs-destination-selection/feature.md` — supplies the destination stack and its stored management token (DEP-3).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
