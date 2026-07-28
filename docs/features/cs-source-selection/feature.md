# Feature Spec: Contentstack Source Selection (Content Map & Audit — Source panel)

- **Slug:** `cs-source-selection`
- **Status:** Draft
- **Author:** Ayush Sahu
- **Created:** 2026-07-28
- **Last updated:** 2026-07-28

## 1. Summary

On the "Content Map and Audit" step of the Contentstack-to-Contentstack migration wizard (Step 3 of 7), the **Source panel** lets a user choose what to migrate *from* — either a live Contentstack stack (Region → Organization → Stack → Branch, whole-stack or specific modules) or an uploaded Contentstack export bundle (`.zip`, validated against its manifest, whole-file or specific modules) — and kick off the read/extract that produces the content graph shown alongside it. New backend endpoints (a new, **fully standalone `api/v3` router** mounted under `/v3`, sharing no code with the v2 API) back the dropdown data, the export/extract operations, and persistence of the selection to the project.

## 2. Problem statement

Contentstack-to-Contentstack migration currently has no first-class "pick your source" experience: users cannot, in one place, choose between reading a live stack and uploading an existing export bundle, scope the migration to specific modules, or see the shape of what they are about to migrate before committing. Today this forces users to guess what will be pulled, over-migrate entire stacks when they only need a subset, and discover missing/mismatched content types only after the migration runs. The Source panel closes that gap by making the source explicit, scoped, and previewable (via the content graph) before any downstream mapping begins.

## 3. Target users / personas

- **Migration operator (primary)** — a Contentstack developer or solutions engineer running a stack-to-stack migration. Cares about selecting the correct source stack/branch or export file, scoping to the right modules, and confirming the content shape before proceeding.
- **Partner / implementation consultant (secondary)** — migrates content on behalf of a customer, often from an export bundle handed to them (no direct access to the customer's live org). Cares primarily about the "From a file" path.

Primary persona: **Migration operator**.

## 4. Goals & success metrics

- **G-1:** A user can fully specify a Contentstack source (stack or file) and trigger the read/extract from a single panel — measured by: task-completion rate of the Source step ≥ 95% among users who reach it. (Threshold `TBD — Open Question`, see Q-1.)
- **G-2:** Users scope migrations to specific modules when they don't need the whole stack/file — measured by: % of migrations using "Specific module(s)" (baseline/target `TBD — Open Question`, see Q-1).
- **G-3:** The source selection persists across reloads so a mid-flow refresh never loses the user's choices — measured by: 0 reported cases of lost source selection after refresh.
- **G-4:** The content graph accurately reflects the extracted source — measured by: graph entity counts (content types, assets, entries, global fields, references) match the export/extract result 100% of the time.

## 5. Non-goals / out of scope

- **Destination panel** (Region/Org/new-stack name, import authentication, language mapping) — visible in the same design but explicitly out of scope for this spec; covered separately.
- **Field/content-type mapping** — the next wizard step; this feature ends once the source is read and the graph is produced.
- **The step tracker / cross-step navigation** — the seven-step header is shared chrome, not owned by this feature.
- **Non-Contentstack source connectors** (Contentful, Drupal, AEM, Sitecore, WordPress) — this feature is Contentstack-source only (`feature/cs-to-cs`).
- **Running the actual migration/import** — out of scope; this feature only reads/extracts the source and previews it.
- **Editing/creating source stacks** — the user selects an existing stack; stack creation is not part of the Source panel.

## 6. Use cases

### UC-1: Select a live Contentstack stack as the source

- **Actor:** Migration operator
- **Trigger:** User lands on the Content Map & Audit step with the "From a stack" tab active (default).
- **Preconditions:** User is authenticated; a project exists; the user has at least one accessible Contentstack organization.
- **Main flow:**
  1. User selects a **Region** from the Region dropdown.
  2. User selects an **Organization** (options load for the chosen region).
  3. User selects a **Stack** (options load for the chosen org). Hint reads: "All content types, entries and assets in this stack will be read."
  4. The **Branch** row shows the active branch (default `main`); user may click **Change** to pick a different branch.
  5. User leaves scope as **Whole stack** (default) or switches to **Specific module**.
  6. User clicks the source action button (e.g. "Start export").
  7. System reads the source and, on completion, renders the **content graph** (types in dependency order) with entity stat counts.
- **Postconditions / success state:** Source selection is persisted to the project; the content graph and stats are populated; the user may proceed to the next step.
- **Alternate flows:**
  - **UC-1a (Specific module):** At step 5 the user picks "Specific module", opens the module dropdown, and checks one or more modules (each shows a count). The export is scoped to the checked modules only.
  - **UC-1b (Change branch):** At step 4 the user opens the branch selector and selects a non-default branch; subsequent read uses that branch.
- **Priority:** P0

### UC-2: Select an uploaded Contentstack export file as the source

- **Actor:** Partner / implementation consultant (or Migration operator)
- **Trigger:** User switches the source segmented control to the **"From a file"** tab.
- **Preconditions:** User is authenticated; a project exists; user has a Contentstack export bundle (`.zip`) available.
- **Main flow:**
  1. User clicks the dropzone ("Drop a migration file or click to browse") and selects a `.zip` export bundle.
  2. The selected file card shows the file name, size, and "selected just now"; helper text notes "The file is scanned locally — no data leaves your machine until you proceed."
  3. User clicks the extract action (e.g. "Extract & validate").
  4. System validates the bundle and renders a **"What's in this file"** manifest listing each module and its count, plus a file meta line.
  5. User leaves scope as **Everything in this file** (default) or switches to **Specific modules**.
  6. User proceeds; system produces the content graph from the extracted file.
- **Postconditions / success state:** File is validated, manifest displayed, source selection persisted, content graph populated.
- **Alternate flows:**
  - **UC-2a (Specific modules):** At step 5 the user opens the file-module dropdown and checks modules. Modules required by checked entries are auto-forced and labelled "required by entries" (cannot be unchecked while their dependents are checked).
  - **UC-2b (Upload another file):** User clicks "Upload another file" to discard the current bundle and start over.
  - **UC-2c (Remove file):** Before validating, user clicks the remove (×) control on the file card to clear the selection and return to the dropzone.
- **Priority:** P0

### UC-3: View and navigate the content graph

- **Actor:** Migration operator
- **Trigger:** A source read/extract completes successfully.
- **Preconditions:** UC-1 or UC-2 completed; graph data is available.
- **Main flow:**
  1. The right side of the Source panel switches from the empty state to the graph.
  2. Stat tiles show counts for Content types, Assets, Entries, Global fields, and References.
  3. Nodes render in dependency order (top to bottom) with reference edges drawn between them.
  4. User pans (drag) and zooms (in / out / reset controls) to inspect the graph.
- **Postconditions / success state:** User can read the source's structure and relationships before proceeding.
- **Alternate flows:**
  - **UC-3a (Empty state):** Before any read completes, the panel shows "Relationship between content types will be shown here once the export completes."
- **Priority:** P1

### UC-4: Resume a previously configured source

- **Actor:** Migration operator
- **Trigger:** User returns to the Content Map & Audit step (reload, or navigating back from a later step).
- **Preconditions:** A source selection was previously persisted for this project.
- **Main flow:**
  1. System loads the persisted source selection for the project.
  2. The correct tab (stack or file), region/org/stack/branch or file reference, scope choice, and selected modules are restored.
  3. If a prior read/extract completed, the content graph is restored (or made re-fetchable).
- **Postconditions / success state:** The user sees their prior source configuration exactly as left.
- **Priority:** P1

## 7. User flows (optional detail)

The Source panel is a single screen with two mutually exclusive modes toggled by a segmented control ("From a stack" / "From a file"):

- **From a stack:** Region → Organization → Stack (cascading dropdowns) → Branch (with Change) → scope radio (Whole stack / Specific module) → optional module multi-select → single action button. See UC-1.
- **From a file:** Dropzone → selected-file card → extract/validate action → manifest table → scope radio (Everything / Specific modules) → optional module multi-select (with forced dependencies) → two-button action row ("Upload another file" + extract). See UC-2.
- **Content graph (right column):** empty state until a read completes, then stats + pannable/zoomable node graph. See UC-3.

## 8. Functional requirements

### FR — Mode & layout
- **FR-1.1:** The Source panel MUST present two mutually exclusive modes, "From a stack" and "From a file", selectable via a segmented control, with "From a stack" active by default.
- **FR-1.2:** Switching modes MUST show that mode's controls and hide the other mode's controls without losing already-entered data for the hidden mode within the same session.
- **FR-1.3:** The Source panel header MUST display the source name, source meta line, and a status badge (pill) reflecting the current source state.

### FR — From a stack
- **FR-2.1:** The system MUST provide a Region dropdown whose options are the Contentstack regions available to the user.
- **FR-2.2:** The system MUST provide an Organization dropdown whose options are the organizations available in the selected Region.
- **FR-2.3:** The system MUST provide a Stack dropdown whose options are the stacks in the selected Organization.
- **FR-2.4:** Region, Organization, and Stack MUST each be marked required (`*`) and MUST be selected in that order; a downstream dropdown MUST remain disabled/empty until its upstream selection is made.
- **FR-2.5:** The system MUST display the active Branch (defaulting to `main`) and MUST let the user change it via a "Change" control.
- **FR-2.6:** The system MUST offer a scope choice of "Whole stack" (default) or "Specific module".
- **FR-2.7:** When "Specific module" is selected, the system MUST show a multi-select dropdown of modules, each with an item count, and MUST allow checking/unchecking individual modules.
- **FR-2.8:** The system MUST provide a single primary action button that triggers the source read; the button MUST show a loading state while the read is in progress.
- **FR-2.9:** The system MUST NOT allow the read to start until Region, Organization, and Stack are all selected (and, for "Specific module", at least one module is checked).

### FR — From a file
- **FR-3.1:** The system MUST provide a dropzone that accepts a Contentstack export bundle (`.zip`) via drag-drop or click-to-browse.
- **FR-3.2:** After a file is chosen, the system MUST show a file card with the file name, size, and selection recency, plus a remove (×) control that clears the selection.
- **FR-3.3:** The system MUST validate the uploaded bundle and, on success, render a "What's in this file" manifest listing each module and its count, plus a file meta line.
- **FR-3.4:** The system MUST offer an import scope of "Everything in this file" (default) or "Specific modules".
- **FR-3.5:** When "Specific modules" is selected, the system MUST show a multi-select dropdown of the file's modules, each with a count.
- **FR-3.6:** When a checked module depends on another module (e.g. entries requiring their content types/assets), the system MUST auto-check the required module, label it "required by entries", and prevent it from being unchecked while a dependent module remains checked.
- **FR-3.7:** The system MUST provide two actions in file mode: "Upload another file" (discards current bundle, returns to dropzone) and an extract/validate action (with loading state); both MUST be disabled while an extract is locked in progress (`fileActionsLocked`).
- **FR-3.8:** The system MUST reject files that are not a valid Contentstack export bundle and surface a user-visible error (see EC-3).
- **FR-3.9:** File size MUST be capped at the API's upload limit (100 MB, matching existing project-import multer config); larger files MUST be rejected with a user-visible message.

### FR — Content graph
- **FR-4.1:** Before any source read completes, the graph area MUST show the empty state text "Relationship between content types will be shown here once the export completes."
- **FR-4.2:** After a successful read, the system MUST render stat tiles for Content types, Assets, Entries, Global fields, and References with the extracted counts.
- **FR-4.3:** After a successful read, the system MUST render content-type nodes in dependency order (top to bottom) with reference edges between related types.
- **FR-4.4:** The graph MUST support pan (drag) and zoom in / zoom out / reset controls.

### FR — Persistence & API (`/v2`)
- **FR-5.1:** All new endpoints MUST be mounted under the `/v3` prefix in a new, **fully standalone** `api/v3` router with its own controllers, services, models, and auth middleware. It MUST NOT import or reuse any `api/src` (v2) service, controller, model, or middleware. It MAY use third-party Contentstack tooling and the shared `app_token` JWT secret.
- **FR-5.2:** The system MUST persist the user's source selection (mode; region/org/stack/branch; scope; selected modules; or uploaded-file reference) to the project record so it survives reload (UC-4).
- **FR-5.3:** The system MUST expose endpoints to list regions, organizations (per region), stacks (per org), and branches (per stack) for the "From a stack" dropdowns.
- **FR-5.4:** The system MUST expose an endpoint to list a source's modules with per-module counts (for both stack and file scope selection).
- **FR-5.5:** The system MUST expose an endpoint to start the stack export (scoped to whole-stack or selected modules) and an endpoint to upload+validate+extract a file bundle.
- **FR-5.6:** The system MUST expose an endpoint returning the content-graph data (nodes, edges, and the five entity counts) for the extracted source.

## 9. Non-functional requirements

- **NFR-1 (Performance):** Dropdown list endpoints (regions/orgs/stacks/branches) SHOULD respond p95 < 800ms. Exact thresholds `TBD — Open Question` (Q-2).
- **NFR-2 (Performance):** File upload MUST accept bundles up to 100 MB; extract/validate progress MUST be reflected in the UI (loading/locked state) so the UI never appears frozen. Long-running export/extract time budget `TBD — Open Question` (Q-2).
- **NFR-3 (Security):** All new `/v3` endpoints MUST require a valid authenticated session (v3's own auth middleware validating the shared `app_token` JWT); source credentials/tokens MUST NOT appear in logs.
- **NFR-4 (Accessibility):** New controls MUST meet WCAG 2.1 AA — zoom buttons have `aria-label`s per design; dropdowns/radios/checkboxes MUST be keyboard-operable.
- **NFR-5 (Reliability):** A browser refresh mid-flow MUST NOT lose the source selection (backed by FR-5.2).
- **NFR-6 (Compatibility):** MUST work on the browsers already supported by the migration UI (`TBD — Open Question`, Q-3).
- **NFR-7 (Observability):** Export/extract start, success, and failure MUST be logged with project/stack identifiers (excluding secrets) via the existing logger.

## 10. Data & entities

- **Entity: `Project` (extended)** — MUST gain a persisted `source` selection: mode (`stack` | `file`), and for stack mode: region, orgId, stackApiKey/stackUid, branch, scope (`whole` | `specific`), selectedModules[]; for file mode: uploaded-file reference/id, validated manifest summary, scope (`all` | `specific`), selectedModules[]. Exact field names/shape are a TRD concern.
- **Entity: `SourceModule` (read model)** — a module descriptor: `name`/`label`, `count`, and (file mode) `forced`/`requiredBy` flag. Derived from the stack or the file manifest; not necessarily persisted.
- **Entity: `ContentGraph` (read model)** — nodes (content types in dependency order), edges (references), and counts for content types, assets, entries, global fields, references. Produced by the export/extract; persistence vs. re-fetch is `TBD — Open Question` (Q-4).

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** the Source panel with the "From a stack" tab active and no selections made
  - **When** the panel loads
  - **Then** the Region dropdown is enabled, and the Organization and Stack dropdowns are disabled/empty, and the primary action button is disabled.
- **AC-1.2:**
  - **Given** a Region is selected
  - **When** the Organization dropdown is opened
  - **Then** it lists the organizations available for that region, and selecting one enables the Stack dropdown.
- **AC-1.3:**
  - **Given** Region, Organization, and Stack are all selected and scope is "Whole stack"
  - **When** the user clicks the primary action button
  - **Then** the button enters a loading state, a scoped export request is sent for the selected stack + branch, and on success the content graph and five stat tiles render.
- **AC-1.4:**
  - **Given** a valid stack selection
  - **When** the export completes successfully
  - **Then** the source selection (region, org, stack, branch, scope=whole) is persisted to the project and survives a page reload (see AC-4.1).
- **AC-1.5:**
  - **Given** the Branch row shows `main`
  - **When** the user clicks "Change" and selects a different branch
  - **Then** the Branch row updates to the chosen branch and the subsequent export request uses that branch.

### AC for UC-1a (Specific module)

- **AC-1.6:**
  - **Given** scope is switched to "Specific module"
  - **When** the module dropdown is opened
  - **Then** it lists the stack's modules each with a numeric count, and the primary action button remains disabled until at least one module is checked.
- **AC-1.7:**
  - **Given** two modules are checked in "Specific module" mode
  - **When** the export is started
  - **Then** the export request is scoped to exactly those two modules.

### AC for UC-2

- **AC-2.1:**
  - **Given** the "From a file" tab is active with no file selected
  - **When** the panel renders
  - **Then** the dropzone "Drop a migration file or click to browse" is shown and the extract action is disabled.
- **AC-2.2:**
  - **Given** a valid `.zip` export bundle is selected
  - **When** the file is chosen
  - **Then** a file card shows its name, size, and "selected just now", and a remove (×) control is present.
- **AC-2.3:**
  - **Given** a selected valid bundle
  - **When** the user triggers extract/validate
  - **Then** the actions lock, and on success a "What's in this file" manifest lists each module with a count plus a file meta line.
- **AC-2.4:**
  - **Given** a validated file with scope "Everything in this file" (default)
  - **When** the user proceeds
  - **Then** the content graph renders from the extracted file and the file source selection is persisted to the project.

### AC for UC-2a (Specific modules + forced dependency)

- **AC-2.5:**
  - **Given** scope "Specific modules" and a module that depends on another (entries requiring content types/assets)
  - **When** the dependent module is checked
  - **Then** the required module is auto-checked, labelled "required by entries", and cannot be unchecked while the dependent remains checked.

### AC for UC-2b/2c

- **AC-2.6:**
  - **Given** a selected file (not yet validated)
  - **When** the user clicks the remove (×) control
  - **Then** the file is cleared and the dropzone is shown again.
- **AC-2.7:**
  - **Given** a validated file
  - **When** the user clicks "Upload another file"
  - **Then** the current bundle and manifest are discarded and the dropzone is shown.

### AC for UC-3

- **AC-3.1:**
  - **Given** no source read has completed
  - **When** the Source panel renders
  - **Then** the graph area shows "Relationship between content types will be shown here once the export completes."
- **AC-3.2:**
  - **Given** a successful export/extract with known counts
  - **When** the graph renders
  - **Then** the five stat tiles (Content types, Assets, Entries, Global fields, References) show counts equal to the extract result.
- **AC-3.3:**
  - **Given** the graph is rendered
  - **When** the user clicks zoom-in, zoom-out, and reset, and drags the canvas
  - **Then** the graph scales and pans accordingly and reset returns it to the default view.

### AC for UC-4

- **AC-4.1:**
  - **Given** a source selection was persisted for the project
  - **When** the user reloads the Content Map & Audit step
  - **Then** the correct tab, region/org/stack/branch or file reference, scope, and selected modules are restored to their persisted values.

## 12. Edge cases & error scenarios

- **EC-1:** User has zero accessible organizations (or zero stacks in the chosen org) → the Organization/Stack dropdown shows an empty state and the primary action stays disabled; a message explains no orgs/stacks are available.
- **EC-2:** Required field missing (Region/Org/Stack not chosen, or "Specific module/modules" chosen with none checked) → the primary/extract action stays disabled; no request is sent.
- **EC-3:** Uploaded file is not a valid Contentstack export bundle (wrong format, corrupt zip, missing manifest) → validation fails and a user-visible error is shown; no manifest renders.
- **EC-4:** Uploaded file exceeds the 100 MB limit → upload is rejected with a user-visible size-limit message (matches multer limit).
- **EC-5:** Permission denied when listing orgs/stacks/branches or starting export (expired session / insufficient scope) → the request returns 401/403 and the UI surfaces an auth/permission error rather than silently failing.
- **EC-6:** Network failure or timeout during export/extract → the loading/locked state ends, an error is shown, and the user can retry without re-entering the whole selection.
- **EC-7:** Export/extract returns zero content (empty stack/file) → the graph shows a valid empty/zero state (counts all 0) rather than erroring.
- **EC-8:** User switches tabs (stack ↔ file) mid-configuration → the other mode's controls appear; already-entered data for the hidden mode is retained within the session (FR-1.2) and not silently submitted.
- **EC-9:** Concurrent/stale selection — the persisted source is changed elsewhere (another tab/session) then this session submits → last-write behavior and conflict handling is `TBD — Open Question` (Q-5).
- **EC-10:** Very large graph (many content types/references) → the graph must remain pannable/zoomable and not freeze the UI; performance ceiling `TBD — Open Question` (Q-2).

## 13. Dependencies & integrations

- **DEP-1:** The new standalone `/v3` Express router with its OWN auth middleware, async-router, and validation utilities — v3 MUST NOT reuse the `api/src` versions (contract owner: v3 API).
- **DEP-2:** Contentstack Management API — v3 calls it directly (its own client) for Region/Org/Stack/Branch listing. MUST NOT reuse the v2 `org.service.ts`/`org.controller.ts`.
- **DEP-3:** Contentstack export tooling / SDK — v3 wraps it in its own service for stack export and file extract. MUST NOT reuse the v2 `runCli.service.ts`/`migration.service.ts`.
- **DEP-4:** v3's OWN project persistence (its own model layer over MongoDB) — stores the source selection (FR-5.2). MUST NOT reuse the v2 `projects.service.ts`/model.
- **DEP-5:** File upload via `multer` (memory storage, 100 MB cap) as already configured for project import in `projects.routes.ts`.
- **DEP-6:** The shared design system bundle referenced by the design (`Select`, `Input`, `Button`, `Badge` components) — the UI consumes these; not owned here.
- **DEP-7:** Destination panel feature (out of scope here) consumes the persisted source in the same wizard — contract on the persisted `source` shape is shared.

## 14. Assumptions & constraints

- **A-1:** This feature is Contentstack-source only (branch `feature/cs-to-cs`); the source is always a Contentstack stack or Contentstack export bundle.
- **A-2:** The default branch is `main` when a stack is selected.
- **A-3:** All new endpoints live under the `/v3` prefix in a new, standalone `api/v3` router.
- **A-4:** v3 is **fully standalone** — it re-implements listing, export, persistence, and auth inside `api/v3` and reuses only shared secrets (the `app_token` JWT key) and third-party Contentstack tooling; it reuses no v2 service, controller, model, or middleware (per decision: "fully standalone").
- **A-5:** The step context is fixed as "Step 3 of 7 · Audit report" within the seven-step wizard.
- **C-1:** File uploads are capped at 100 MB by the existing multer configuration.
- **C-2:** The UI must consume the existing design-system components; no new component library is introduced by this feature.

## 15. Risks

- **R-1:** Large stack/file exports may exceed reasonable wait times → likelihood medium / impact high → stream progress, show loading/locked state, and consider async job + polling (design in TRD).
- **R-2:** Cascading dropdowns (region→org→stack→branch) create many round-trips → likelihood medium / impact medium → cache list responses within v3's own client and disable-until-ready where possible.
- **R-3:** File manifest/module dependency logic ("required by entries") is easy to get subtly wrong → likelihood medium / impact medium → cover with explicit tests (AC-2.5) and validate against real export bundles.
- **R-4:** Persisted-source shape must stay compatible with the (out-of-scope) Destination panel and mapping step → likelihood medium / impact high → agree the `source` schema with those consumers before finalizing (Q-6).

## 16. Open questions

- **Q-1:** Success-metric thresholds for G-1/G-2 (completion-rate target, specific-module adoption target) — owner: Product — needed by: PRD.
- **Q-2:** Concrete performance/time budgets for dropdown endpoints, export/extract duration, and max graph size (NFR-1, NFR-2, EC-10) — owner: Eng — needed by: TRD.
- **Q-3:** Exact supported browser matrix for NFR-6 — owner: Product/QA — needed by: test-case stage.
- **Q-4:** Is the produced content graph persisted with the project or re-fetched on return (UC-4 / entity `ContentGraph`)? — owner: Eng — needed by: TRD.
- **Q-5:** Conflict/last-write handling when the persisted source is edited concurrently (EC-9) — owner: Eng — needed by: TRD.
- **Q-6:** Final persisted `source` schema shared with the Destination panel and mapping step (R-4, DEP-7) — owner: Eng — needed by: TRD.
- **Q-7 (resolved in TRD):** Endpoint paths are under `/v3/source/...` in the standalone router (see trd.md §6). — owner: Eng.

## 17. Out-of-band references

- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project; page **"Content Map and Audit"**, **Source panel** only (segmented "From a stack" / "From a file", region/org/stack/branch, module selection, file upload + manifest, and the content-graph column). Destination panel on the same page is out of scope.
- Existing v2 API files are **reference-only** (informative patterns, NOT reused by the standalone v3 router): `api/src/server.ts`, `api/src/routes/{org,projects,migration}.routes.ts`. The v3 endpoints are defined independently under `/v3` (see trd.md §6).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
