# Feature Spec: Project deletion and unique project names

- **Slug:** `cs-project-lifecycle`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-12
- **Last updated:** 2026-08-12
- **Revision note:** corrected at the spec stage on 2026-08-12 before PRD/TRD were
  written — the project count in §2/§4 was wrong (18 records / 17 named, not 14), and
  EC-15 plus C-4 were added after a malformed legacy record was found in the live store.

> **Relationship to `cs-project-dashboard`.** This spec ADDS two capabilities to the
> existing v3 project dashboard; it does not restate it. `docs/features/cs-project-dashboard/feature.md`
> remains the source of truth for listing, searching, resuming and creating projects,
> and its IDs are untouched. The IDs in this document are a separate namespace.
>
> Both capabilities live in one spec rather than two because they are coupled: name
> uniqueness is only tolerable if a name can be released again, and releasing a name is
> what deletion does. Specifying either alone would leave the other's behaviour
> undefined.

## 1. Summary

A migration operator can delete a project they no longer need, which removes it from
the dashboard and reclaims the disk its exported content occupied. Separately, creating
a project with a name that is already in use is refused, so two projects in the same
workspace can never share a name.

## 2. Problem statement

Two problems, both observed in the live store today.

**Projects accumulate and cannot be removed.** The store currently holds **18 records —
17 named projects plus one malformed legacy seed row** (`demo-project`, which carries
only `id` and `created_at`). Most of the 17 are one-off tests created while building the
wizard ("Test", "Test again", "source check", "Fixes"). There is no way to remove any of them — deletion was
explicitly out of scope when the dashboard was built (recorded as TRR-2 in
`api/v3/controllers/project.controller.ts`). The operator's list therefore only ever
grows, and the dashboard's core purpose per `cs-project-dashboard` — "finding the right
project quickly, seeing at a glance which projects are unfinished" — degrades with every
throwaway project. There is also a storage cost: exported content now lives at
`exportData/<projectId>/`, and the current five exports occupy **160 MB**, none of which
can be reclaimed through the product.

**Names collide silently.** `name` is validated for presence, length (≤200) and leading
whitespace, but not uniqueness. Applying this feature's own comparison rule (case-folded
and trimmed) to the live store finds exactly one collision today: **two projects both
named "Chirag Sample"**. Separately, 17 projects share only 5 source stacks between them,
and 16 of them point at an export folder that exists. Once two
projects carry the same name, the dashboard gives the operator no way to tell them
apart: the card shows the name, and resuming the wrong one means configuring a
migration against a stack they did not intend.

## 3. Target users / personas

- **Migration operator (PRIMARY, and the only persona)** — a Contentstack solutions/TSO
  engineer who runs a CS→CS migration for a customer. Works on several migrations
  concurrently over several days and frequently leaves one part-configured. Cares here
  about: clearing away finished and abandoned projects so the dashboard stays legible,
  reclaiming disk taken by exports they no longer need, and never mistaking one project
  for another because two share a name.

Carried over verbatim from `cs-project-dashboard` §3, which established this as the
single persona. No new persona is introduced.

## 4. Goals & success metrics

- **G-1:** An operator can remove a project they no longer need, without filesystem
  access — measured by: deletion available from the dashboard for every project the
  operator owns, and 0 remaining product paths that require manually removing a folder.
- **G-2:** Disk occupied by a deleted project's export is reclaimed — measured by:
  `exportData/<projectId>/` absent after deletion, verified for a project whose export
  is non-empty.
- **G-3:** No two live projects in one workspace share a name — measured by: create
  refused for a name already in use, case- and whitespace-insensitively.
- **G-4:** No existing project becomes unreachable or is silently modified by this
  change — measured by: all 17 named projects currently in the store, including the two
  duplicate "Chirag Sample" records, still list and open after the change; and the
  malformed `demo-project` row stays out of the list exactly as it is today.

## 5. Non-goals / out of scope

- **Renaming a project.** Not requested. Noted explicitly because a rename would need
  the same uniqueness check, and adding rename later without it would reopen the hole
  this feature closes.
- **Retroactively de-duplicating existing names.** The two "Chirag Sample" projects stay
  as they are. Enforcement is at create time only; a data migration would change records
  the operator did not ask us to touch.
- **Restoring a deleted project ("undo" / trash view).** The record survives as
  `isDeleted: true`, but no product surface reads it back. The exported content is
  genuinely gone (§FR-1.4), so a restore would return a project whose data is missing —
  worse than no restore at all.
- **Bulk delete / multi-select.** One project at a time.
- **Cross-workspace uniqueness.** Two different operators, or the same operator in two
  regions, may each have a project named "Migration Test". Uniqueness is scoped exactly
  as every other read in the project store is (region + owner).
- **Deleting the source stack in Contentstack.** Deletion here affects this tool's own
  records and its export folder. Nothing is deleted in Contentstack.

## 6. Use cases

### UC-1: Delete a project

- **Actor:** Migration operator
- **Trigger:** The operator chooses to delete a project from its card on the dashboard.
- **Preconditions:** The operator is signed in; the project exists and belongs to their
  region + owner scope.
- **Main flow:**
  1. The operator opens the delete action on the project's card.
  2. A confirmation dialog appears, naming the project being deleted.
  3. The operator confirms.
  4. The project is marked deleted and its export folder is removed from disk.
  5. The dashboard list refreshes without that project.
- **Postconditions / success state:** The project no longer appears in the list or opens
  by URL; `exportData/<projectId>/` no longer exists; every other project is unchanged.
- **Alternate flows:**
  - The operator dismisses the dialog → nothing is deleted, the list is unchanged.
  - The project has never been exported → deletion still succeeds; there is no folder to
    remove.
- **Priority:** P0

### UC-2: Create is refused for a name already in use

- **Actor:** Migration operator
- **Trigger:** The operator submits the create-project form with a name that an existing
  live project in their scope already uses.
- **Preconditions:** The operator is signed in; a live project named `Migration Test`
  exists in their scope.
- **Main flow:**
  1. The operator opens the create-project dialog and types `Migration Test`.
  2. The operator submits.
  3. The request is refused; the dialog stays open showing why.
  4. The operator changes the name and submits again, which succeeds.
- **Postconditions / success state:** No second project named `Migration Test` exists;
  the operator's typed name and description are not lost when the refusal is shown.
- **Alternate flows:**
  - The name differs only by case or surrounding whitespace (`migration test`,
    `Migration Test `) → also refused (FR-2.2).
  - The clash is detected in the browser before submit → the operator is told without a
    round trip, but the server still enforces the rule (FR-2.6).
- **Priority:** P0

### UC-3: A deleted project's name becomes available again

- **Actor:** Migration operator
- **Trigger:** The operator deletes a project and then creates a new one with the same
  name.
- **Preconditions:** A live project named `Migration Test` exists in the operator's
  scope.
- **Main flow:**
  1. The operator deletes `Migration Test` (UC-1).
  2. The operator creates a new project named `Migration Test`.
  3. Creation succeeds.
- **Postconditions / success state:** A new live project named `Migration Test` exists
  with a new id; the deleted record still carries the old name and remains invisible.
- **Alternate flows:** None.
- **Priority:** P1

## 7. User flows (optional detail)

Covered inline in §6. One point of sequencing is behavioural rather than cosmetic and is
specified as FR-1.3: the record is marked deleted BEFORE the folder is removed, so a
failure to mark leaves the data intact.

## 8. Functional requirements

### FR — Delete: server

- **FR-1.1:** The system MUST expose an endpoint that deletes one project identified by
  its id.
- **FR-1.2:** The system MUST set `isDeleted` to `true` on the project record rather than
  removing the record from the store.
- **FR-1.3:** The system MUST set `isDeleted` to `true` before removing any files from
  disk, so that a failure to update the record leaves the exported content in place.
- **FR-1.4:** The system MUST remove the directory `exportData/<projectId>/` and all its
  contents when a project is deleted.
- **FR-1.5:** The system MUST resolve the target project through the caller's region +
  owner scope, and MUST respond 404 when the id is unknown, already deleted, or outside
  that scope — the three cases being indistinguishable to the caller.
- **FR-1.6:** The system MUST respond 200 on a successful deletion.
- **FR-1.7:** The system MUST NOT delete, move or truncate any directory outside
  `exportData/<projectId>/`.
- **FR-1.8:** The system MUST NOT include the project name, description, or the source
  stack api key in any log line emitted by the deletion path.
- **FR-1.9:** A deleted project MUST NOT be returned by the project list or by a read of
  a single project.
- **FR-1.10:** Store writers that record migration state against a project
  (`upsertV3Source`, `setV3Graph`, `setV3AuditDecisions`, `setV3DestinationToken`) MUST
  refuse to write to a project whose `isDeleted` is `true`, responding 404 as
  `setV3ContentTypeSelection` already does.
- **FR-1.11:** An export job whose project is deleted while the job is running MUST NOT
  recreate `exportData/<projectId>/`, and MUST NOT persist a content graph for that
  project.

### FR — Delete: UI

- **FR-2.1:** The dashboard MUST offer a delete action on each project card.
- **FR-2.2:** Choosing the delete action MUST open a confirmation dialog before anything
  is deleted.
- **FR-2.3:** The confirmation dialog MUST display the name of the project being deleted.
- **FR-2.4:** The confirmation dialog MUST state that the project's exported content will
  be removed and that the action cannot be undone.
- **FR-2.5:** Dismissing or cancelling the dialog MUST leave the project unchanged.
- **FR-2.6:** After a successful deletion the dashboard MUST refresh so the deleted
  project is no longer listed, without a full page reload.
- **FR-2.7:** While a deletion is in flight the confirm control MUST be disabled, so one
  confirmation cannot issue two deletions.
- **FR-2.8:** A failed deletion MUST leave the project visible in the list and surface
  the failure to the operator.

### FR — Name uniqueness: server

- **FR-3.1:** The system MUST refuse to create a project whose name matches that of an
  existing live project in the caller's region + owner scope.
- **FR-3.2:** The comparison MUST ignore letter case and leading/trailing whitespace, so
  `Migration Test`, `migration test` and `Migration Test ` are all treated as the same
  name.
- **FR-3.3:** The comparison MUST consider only live projects; a project whose
  `isDeleted` is `true` MUST NOT reserve its name.
- **FR-3.4:** The system MUST respond 409 when refusing a duplicate name.
- **FR-3.5:** The system MUST NOT create any project record when refusing a duplicate
  name.
- **FR-3.6:** The refusal MUST NOT reveal anything about projects outside the caller's
  scope: a name in use by a different region or owner MUST be accepted.
- **FR-3.7:** The uniqueness rule MUST be enforced server-side regardless of any
  client-side check.

### FR — Name uniqueness: UI

- **FR-4.1:** The create-project dialog MUST show the reason when creation is refused for
  a duplicate name.
- **FR-4.2:** The create-project dialog MUST retain the operator's typed name and
  description when a refusal is shown, so nothing has to be retyped.
- **FR-4.3:** The create-project dialog MUST remain open when creation is refused.
- **FR-4.4:** The dialog SHOULD indicate a clash against a name already visible in the
  loaded project list before the operator submits.

## 9. Non-functional requirements

- **NFR-1 (Performance):** Deleting a project whose export folder contains 160 MB across
  ~10,000 files MUST complete within 30 seconds. Recursive deletion is I/O-bound, so the
  bound is generous by intent; the requirement exists so that a slow delete is treated as
  a defect rather than accepted.
- **NFR-2 (Security):** The delete endpoint MUST require a valid session token and MUST
  operate only within the caller's region + owner scope. The path removed MUST be
  constructed through the same sanitising helper every other export path uses, so a
  malformed project id cannot widen the deletion.
- **NFR-3 (Accessibility):** The confirmation dialog MUST be reachable and operable by
  keyboard, MUST carry `role="dialog"` with `aria-modal="true"` and an accessible name,
  and MUST return focus to a sensible element when closed — matching the existing dialog
  in `ui/v3/components/contentMapping/ContentMappingPanel.tsx`.
- **NFR-4 (Reliability):** A deletion MUST be either applied (record marked, folder gone)
  or not applied (record live, folder intact). It MUST NOT be possible to end with a
  live project whose export folder has been removed.
- **NFR-5 (Compatibility):** No change to the shape of existing project records beyond
  the value of the existing `isDeleted` field. A project record written before this
  feature MUST remain readable.
- **NFR-6 (Observability):** A deletion MUST emit one log line carrying the project id
  and the outcome, and MUST NOT carry the project name, description or stack api key
  (see FR-1.8).

## 10. Data & entities

- **Entity: `V3Project`** — no new fields. The existing required field `isDeleted:
  boolean` moves from "always `false`, never written" to the field this feature sets.
  Its semantics are already relied upon: the store's scope predicate excludes
  `isDeleted === true` from both the list and single reads, and
  `setV3ContentTypeSelection` already refuses to write to a deleted project.
- **Entity: export folder `exportData/<projectId>/`** — lifecycle changes: previously
  created by an export and never removed by the product; now removed when its project is
  deleted. It holds the exported stack content, the downloaded asset binaries, and the
  audit findings cache (`audit.json`), all of which go with it.
- **Name uniqueness** introduces no stored value. It is a rule evaluated over existing
  records at create time, not a persisted index or constraint.

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** a live project `P` in the operator's scope with an export folder containing
    at least one file
  - **When** the operator confirms deletion of `P`
  - **Then** the response status is 200, `P.isDeleted` is `true`, and
    `exportData/<P.id>/` does not exist
- **AC-1.2:**
  - **Given** a project `P` that has just been deleted
  - **When** the project list is requested for the same scope
  - **Then** `P` is absent from the returned list
- **AC-1.3:**
  - **Given** a project `P` that has just been deleted
  - **When** `P` is requested by its id
  - **Then** the response status is 404
- **AC-1.4:**
  - **Given** two live projects `P` and `Q`, each with its own export folder
  - **When** `P` is deleted
  - **Then** `Q.isDeleted` is `false` and `exportData/<Q.id>/` still exists with its
    contents intact
- **AC-1.5:**
  - **Given** a project id that does not exist in the store
  - **When** deletion is requested for that id
  - **Then** the response status is 404 and no record in the store is modified
- **AC-1.6:**
  - **Given** a live project `P` owned by a different region+owner than the caller
  - **When** the caller requests deletion of `P`
  - **Then** the response status is 404 and `P.isDeleted` remains `false`
- **AC-1.7:**
  - **Given** a live project `P` that has never been exported, so no
    `exportData/<P.id>/` exists
  - **When** the operator confirms deletion of `P`
  - **Then** the response status is 200 and `P.isDeleted` is `true`
- **AC-1.8:**
  - **Given** a live project `P` whose export folder cannot be removed (the filesystem
    rejects the operation)
  - **When** deletion is requested for `P`
  - **Then** `P.isDeleted` is `true` — the record is marked before the folder is touched
    (FR-1.3), so the project does not remain live with data already destroyed
- **AC-1.9:**
  - **Given** the delete confirmation dialog is open for a project named `Migration Test`
  - **When** the dialog is rendered
  - **Then** the text `Migration Test` is present in the dialog, and the dialog states
    that the exported content will be removed and cannot be undone
- **AC-1.10:**
  - **Given** the delete confirmation dialog is open for project `P`
  - **When** the operator cancels the dialog
  - **Then** no delete request is issued and `P` is still listed
- **AC-1.11:**
  - **Given** the delete confirmation dialog is open and a deletion is in flight
  - **When** the operator activates the confirm control a second time
  - **Then** exactly one delete request has been issued
- **AC-1.12:**
  - **Given** a delete request that fails with a server error
  - **When** the failure is returned
  - **Then** the project is still listed and the operator is shown that the deletion
    failed
- **AC-1.13:**
  - **Given** a deleted project `P`
  - **When** a write is attempted against `P` through `upsertV3Source`, `setV3Graph`,
    `setV3AuditDecisions` or `setV3DestinationToken`
  - **Then** each rejects with status 404 and `P`'s stored state is unchanged
- **AC-1.14:**
  - **Given** an export job running for project `P`
  - **When** `P` is deleted before the job reaches its final write
  - **Then** no content graph is persisted for `P` and `exportData/<P.id>/` does not
    exist after the job ends

### AC for UC-2

- **AC-2.1:**
  - **Given** a live project named `Migration Test` in the operator's scope
  - **When** creation is requested with the name `Migration Test`
  - **Then** the response status is 409 and the number of projects in the scope is
    unchanged
- **AC-2.2:**
  - **Given** a live project named `Migration Test` in the operator's scope
  - **When** creation is requested with the name `migration test`
  - **Then** the response status is 409
- **AC-2.3:**
  - **Given** a live project named `Migration Test` in the operator's scope
  - **When** creation is requested with the name `  Migration Test  `
  - **Then** the response status is 409
- **AC-2.4:**
  - **Given** a live project named `Migration Test` in the operator's scope
  - **When** creation is requested with the name `Migration Test 2`
  - **Then** the response status is 200 and the new project exists
- **AC-2.5:**
  - **Given** a live project named `Migration Test` owned by region `EU` / owner `u2`
  - **When** a caller scoped to region `NA` / owner `u1` requests creation with the name
    `Migration Test`
  - **Then** the response status is 200 and the new project exists
- **AC-2.6:**
  - **Given** the create dialog contains the name `Migration Test` and a description
    `Q3 rollout`
  - **When** the server refuses with 409
  - **Then** the dialog is still open, the name field still contains `Migration Test`,
    the description still contains `Q3 rollout`, and the refusal reason is shown in an
    element with `role="alert"`

### AC for UC-3

- **AC-3.1:**
  - **Given** a project named `Migration Test` that has been deleted
  - **When** creation is requested with the name `Migration Test`
  - **Then** the response status is 200 and a new project exists with a different id
- **AC-3.2:**
  - **Given** a project named `Migration Test` that has been deleted, and a new live
    project created with the same name
  - **When** the project list is requested
  - **Then** exactly one project named `Migration Test` is returned

## 12. Edge cases & error scenarios

- **EC-1:** Delete requested for an id that does not exist → 404, nothing modified
  (AC-1.5).
- **EC-2:** Delete requested for a project already deleted → 404. The second request
  reports the same "no such project" outcome as any other unknown id, rather than
  reporting success for something it did not do.
- **EC-3:** Delete requested for a project outside the caller's scope → 404, identical to
  a non-existent id, so the response cannot be used to discover another operator's
  projects (AC-1.6).
- **EC-4:** Delete requested without a valid session → rejected by the existing auth
  guard before reaching the handler.
- **EC-5:** The project has no export folder (never exported, or already removed) → the
  deletion still succeeds; a missing folder is the desired end state (AC-1.7).
- **EC-6:** The export folder cannot be removed (permissions, a file held open) → the
  record is already marked deleted, so the project disappears from the dashboard and the
  folder is left orphaned. Preferred over the reverse ordering, which would destroy data
  belonging to a project still shown as live (AC-1.8).
- **EC-7:** A project is deleted while an export job for it is running → the job must not
  recreate the folder and must not persist a graph (FR-1.11, AC-1.14). Without this the
  job's final rename would resurrect a folder for a project the operator had deleted.
- **EC-8:** The operator confirms deletion twice (double activation, or a slow network) →
  one delete request only (FR-2.7, AC-1.11).
- **EC-9:** Create submitted with a name differing from an existing one only by case or
  surrounding whitespace → 409 (AC-2.2, AC-2.3).
- **EC-10:** Create submitted with an empty or whitespace-only name → the existing
  presence rule applies and returns 400; the uniqueness check must not turn this into a
  409, because "you must provide a name" and "that name is taken" are different problems.
- **EC-11:** Two create requests with the same new name arrive concurrently → at most one
  project with that name exists afterwards. See Q-2: the store is a single-process
  lowdb file, so this is bounded by that, but the outcome must not be two live projects
  sharing a name.
- **EC-12:** Create submitted with a name that a project in a DIFFERENT region or owner
  scope uses → accepted (AC-2.5).
- **EC-13:** The store already contains two projects sharing a name (true today:
  "Chirag Sample") → both continue to list and open. No error, no migration, no
  retroactive rejection.
- **EC-14:** A project record written before this feature, carrying `isDeleted: false` →
  behaves exactly as today; it is deletable and it reserves its name.
- **EC-15:** A MALFORMED legacy record — one missing `name`, `region`, `owner` and
  `isDeleted` entirely — must not break either capability. Such a row exists today
  (`demo-project`, holding only `id` and `created_at`). It must not be returned by the
  list, must not reserve any name, and must not cause the uniqueness scan to fail.
  Load-bearing because the scan reads `name` off every record in the caller's scope, and
  a missing `name` would throw where a nullable one is merely skipped; and because
  `isDeleted !== true` treats an ABSENT flag as live, which is correct but must be
  deliberate rather than incidental.

## 13. Dependencies & integrations

- **DEP-1:** `api/v3/models/project.store.ts` — owner of the project record, the scope
  predicate that already excludes deleted projects, and `createV3Project`. Both
  capabilities are implemented against it. Contract owner for FR-1.2, FR-1.9, FR-3.1.
- **DEP-2:** `api/v3/utils/migrationData.util.ts` — supplies the export directory path.
  Read-only dependency, but load-bearing for NFR-2: its `safeSegment` sanitisation is
  what confines the deletion to the intended folder.
- **DEP-3:** `api/v3/services/export.service.ts` — must honour FR-1.11 (an in-flight
  export for a deleted project must not recreate the folder or persist a graph).
- **DEP-4:** `ui/v3/components/projects/ProjectCard.tsx` and `ProjectsTopBar.tsx` — where
  the delete affordance and the refreshed list appear.
- **DEP-5:** `ui/v3/components/projects/CreateProjectModal.tsx` — already accepts an
  `error` prop rendered in an element with `role="alert"` and
  `data-testid="create-project-error"`, so the 409 message has an existing surface and
  FR-4.1 needs no new UI element.
- **DEP-6:** `api/v3/services/auditScan.service.ts` — no direct change, but its findings
  cache lives inside the export folder and is therefore removed with it. Named so that
  the coupling is recorded rather than discovered.

## 14. Assumptions & constraints

- **A-1:** Soft deletion is the intended model, not a hard row removal. Basis: the
  `isDeleted` field already exists, is required on every record, and is already honoured
  by the store's scope predicate and by `setV3ContentTypeSelection`.
- **A-2:** Removing the export folder is acceptable and intended, making deletion
  effectively irreversible in practice even though the record survives. Confirmed by the
  operator; it is why FR-2.4 requires the dialog to say so.
- **A-3:** No design exists for either flow. Confirmed by the operator on 2026-08-12:
  the copy and placement of the delete affordance, the confirmation dialog and the
  refusal message follow the app's existing conventions, enumerated in the resolution of
  Q-1. The copy in §11 is therefore normative.
- **C-1:** The project store is a single lowdb JSON file read and written whole. Any
  uniqueness check is a scan over the loaded records; there is no database constraint to
  lean on.
- **C-2:** The tool runs locally, single-user (recorded in
  `docs/plans/source-export-revamp.md`). This bounds EC-11 but does not remove it, since
  one operator can still issue two requests.
- **C-3:** v3 imports nothing from `api/src`; both capabilities must be implemented
  inside `api/v3` and `ui/v3`.
- **C-4:** The store is not schema-validated on read, so records need not carry every
  field declared on `V3Project`. One record in the live store (`demo-project`) carries
  only `id` and `created_at`. Both capabilities must therefore tolerate absent fields
  rather than assume the declared type (EC-15).

## 15. Risks

- **R-1:** Deleting the wrong folder — likelihood low / impact high (irrecoverable loss
  of a customer's exported content). Mitigation: the path is built only through
  `stackDataDir`'s sanitising helper (NFR-2, FR-1.7), and an explicit test asserts that a
  malformed project id cannot escape `exportData/`.
- **R-2:** A deletion that half-applies, leaving a live project whose export is gone —
  likelihood low / impact high (the project appears usable and silently is not).
  Mitigation: FR-1.3's ordering plus NFR-4, tested by AC-1.8.
- **R-3:** An in-flight export resurrecting a deleted project's folder — likelihood low /
  impact medium (orphaned data on disk, and a graph written for a project the operator
  deleted). Mitigation: FR-1.11, tested by AC-1.14.
- **R-4:** The uniqueness check accidentally matching against deleted projects —
  likelihood medium / impact medium (the operator deletes a project and then cannot reuse
  its name, which reads as a bug). Mitigation: FR-3.3, tested by AC-3.1.
- **R-5:** Case-insensitive comparison mangling non-ASCII names — likelihood low / impact
  low. Mitigation: comparison is a case-fold plus trim only, never a strip of characters;
  a name is stored exactly as typed and only the comparison is normalised.
- **R-6:** The existing duplicate names ("Chirag Sample") being read as a bug once
  uniqueness exists — likelihood medium / impact low. Mitigation: EC-13 states the
  intended behaviour explicitly so it is not "fixed" by accident.

## 16. Open questions

- ~~**Q-1:**~~ **RESOLVED 2026-08-12 — no design exists; follow the app's existing
  conventions.** The copy quoted in §11 stands as the specification rather than as a
  proposal awaiting a design. Concretely, "existing conventions" means these named
  precedents, so the visual phase has a verifiable target rather than a subjective one:
  - Dialog semantics and focus handling — `ui/v3/components/contentMapping/ContentMappingPanel.tsx`
    (`role="dialog"`, `aria-modal="true"`, an accessible name, focus returned on close),
    already required by NFR-3.
  - Refusal message surface — the existing `error` prop of
    `ui/v3/components/projects/CreateProjectModal.tsx`, rendered in an element with
    `role="alert"` and `data-testid="create-project-error"` (DEP-5).
  - Delete affordance styling — the controls already on
    `ui/v3/components/projects/ProjectCard.tsx`.
  - Colour, spacing, radius and typography — the tokens in `ui/v3/styles/theme.css`; no
    new one-off values.

  Consequence for the downstream `tdd` stage: its Phase 3 is a CONSISTENCY check against
  the components named above, not a pixel diff against a reference design. A new
  hardcoded value where a token exists is the defect that phase looks for.
- **Q-2:** How far should EC-11 (two concurrent creates with the same name) be pushed?
  A check-then-write over a single lowdb file has a window between the two. Given C-2
  (local, single-user) the pragmatic answer is to accept the window and rely on the
  check; the alternative is serialising creates. — owner: Chirag Chavan — needed by:
  implementation of FR-3.1.
- **Q-3:** Should the delete action be exposed only on the card, or also from inside an
  opened project's wizard chrome? This spec covers the card only (FR-2.1). — owner:
  Chirag Chavan — needed by: UI implementation.
- **Q-4:** `isDeleted: true` records accumulate in `projects.json` forever, since nothing
  reads or prunes them. Is a retention rule wanted (for example, prune records deleted
  more than N days ago), or is unbounded growth of small records acceptable? — owner:
  Chirag Chavan — needed by: not blocking; can follow.

## 17. Out-of-band references

- `docs/features/cs-project-dashboard/feature.md` — the dashboard this feature extends:
  listing, searching, creating and resuming projects. Its `UC-*`/`FR-*`/`AC-*` IDs are a
  separate namespace from this document's and are unchanged.
- `docs/plans/source-export-revamp.md` — establishes the `exportData/<projectId>/<stackApiKey>/`
  layout that makes FR-1.4 possible (one folder per project), and records the
  local/single-user deployment context cited in C-2.
- `api/v3/controllers/project.controller.ts` — carries the note "v3 cannot delete either
  (trd.md TRR-2)", which this feature supersedes. The note must be updated so the code
  does not contradict itself.
- No design file, by decision (see the resolution of Q-1). The visual precedents this
  feature follows instead are `ui/v3/components/contentMapping/ContentMappingPanel.tsx`
  (dialog), `ui/v3/components/projects/CreateProjectModal.tsx` (error surface),
  `ui/v3/components/projects/ProjectCard.tsx` (card controls) and
  `ui/v3/styles/theme.css` (tokens).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`,
`DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill
will cite them. Do not renumber without updating consumers.
