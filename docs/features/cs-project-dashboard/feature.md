# Feature Spec: CS→CS Project Dashboard

- **Slug:** `cs-project-dashboard`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-03
- **Last updated:** 2026-08-05

> **Revision 2026-08-05 — organization scoping removed.** A v3 project is no longer
> organization-specific. It belongs to a **user in a region**, and organization is
> neither a field on the record, a dimension of the read scope, nor a segment in
> any URL. This removed one use case (organization switching), the organization
> control from the top bar, and the `?orgId=` dependency the wizard carried.
>
> IDs were renumbered to stay dense, so **`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`
> and `DEP-*` in this revision do not match the previous one** — the PRD, TRD and
> test-case matrix were regenerated against these. Resolved and superseded entries
> in §16 keep their original numbers deliberately, because they are decision
> history and downstream documents cite them.
>
> Note that this does **not** touch the *destination* organization: the Destination
> panel still selects a region and an organization for the target stack. That is a
> different concept that happens to share the word.

## 1. Summary

A landing page for the v3 (Contentstack → Contentstack) migration tool that lists every migration project the user owns, lets the user search that list by name, open an existing project to resume where they left off, and create a new project. It reproduces the functionality of the v2 tool's Projects page while following the visual design of the "CS to CS Dashboard" page in the Claude Design project (§17).

## 2. Problem statement

The v3 tool has no project list. `ui/v3/pages/Projects/index.tsx` is an explicit placeholder whose only content is a hard-coded link reading "Open demo project → migration step 1", and the link points at `/v3/projects/demo-project/migration/steps/1` — a project id that does not exist and a step segment (`1`) the wizard cannot resolve, so it silently falls back to the Source step.

The concrete consequences today:

1. **There is no way to create a v3 project.** `api/v3` exposes no create endpoint, and `api/v3/models/project.store.ts` has no create function. The only way a v3 project record comes into existence is as a side effect of `upsertV3Source` or `upsertV3Destination` writing against a project id supplied in the URL.
2. **There is no way to list v3 projects.** `project.store.ts` can read exactly one project, and `getV3Project(projectId)` takes only a project id — so the read is not scoped to a region or an owner either. Work already done is unreachable unless the user still has the URL, and a URL that is kept is readable by anyone (see Q-8).
3. **The v3 project URLs demand an organization that nothing supplies.** Every project-scoped endpoint is mounted at `/v3/org/:orgId/project/:projectId/...`, so the wizard reads `orgId` from a `?orgId=` query parameter typed by hand. Without it, the Destination panel skips its mount-time reads entirely, so resume does not load and the Proceed action stays permanently disabled. This is recorded as TQ-2 in `docs/features/migration-wizard-chrome/trd.md`. That path segment exists only because a project used to be organization-scoped; with this revision it is removed rather than supplied.
4. **A v3 project record cannot describe itself.** `V3Project` is `{ id, org_id, source?, destination?, created_at, updated_at }` — no name, no description, no status, no owner, no region. A list of projects would have nothing to show but opaque ids.

Users of the v2 tool have all of the above and reasonably expect it in v3. Until this feature exists, v3 is usable only by someone who keeps project URLs by hand, which makes it undemoable and untestable by anyone other than its authors.

## 3. Target users / personas

- **Migration operator (PRIMARY, and the only persona)** — a Contentstack solutions/TSO engineer who runs a CS→CS migration for a customer. Works on several migrations concurrently, often over several days, and frequently leaves a migration part-configured and returns to it. Cares about: finding the right project quickly, seeing at a glance which projects are unfinished, and resuming exactly where they stopped rather than re-walking the wizard.

The previous revision listed a secondary "solutions architect / migration lead" persona, inferred solely from the presence of an organization switcher in the design. With organization scoping removed there is nothing left that persona was needed to justify, so it has been dropped rather than left as an unvalidated assumption.

## 4. Goals & success metrics

- **G-1:** A migration operator can find and reopen any existing project without needing a stored URL — measured by: 100% of the projects belonging to the (region, owner) pair appear in the list.
- **G-2:** Reopening a project resumes at the furthest step that project has reached, not the first step — measured by: for a project with a persisted `destination`, opening it from the list lands on the Destination step.
- **G-3:** A migration operator can create a project and begin configuring its source without leaving the flow — measured by: creating a project navigates directly into the wizard's first step with no intermediate page.
- **G-4:** No v3 URL requires an organization — measured by: every project-scoped v3 endpoint resolves from a project id alone, and the Destination panel's mount-time reads succeed with no query parameters present.
- **G-5:** Post-launch adoption and time-to-find metrics — `TBD — Open Question` (Q-11).

## 5. Non-goals / out of scope

- **Organization scoping or grouping of projects.** Confirmed decision (2026-08-05): a project is not organization-specific. It is not filtered by organization, does not record one, and no URL carries one. Reintroducing organization grouping later would be its own feature and its own migration.
- **An organization switcher.** Removed with the above. The design's top bar is built around one; what replaces it is FR-1.1 and is flagged as a drafted deviation (Q-16).
- **Importing an existing project from an archive.** v2 offers this beside "Create New" in a dropdown. v2's import consumes v2's own export format, which packages the project record plus its content-type-mapper and field-mapper stores — none of which exist in v3. There is nothing to import until v3 has a corresponding export.
- **Exporting a project.** Same reason, and no design exists for it.
- **Deleting a project from this page.** The design contains no delete affordance on the card or in the header, and v2 also places delete inside a project's Settings rather than on the list. Where a v3 project gets deleted at all is Q-6.
- **Renaming or editing a project after creation.** No design, and v2 does not do it from the list either.
- **Dark mode.** The dashboard design ships neither dark tokens nor a toggle, and `ui/v3/styles/theme.css` defines no dark values. Adding them is a v3-wide change touching the Source panel, the Destination panel and the wizard chrome, so it is its own feature.
- **A "Choose Migration Path" page.** The design's back control points at one, but that page is a separate feature. Here the control is rendered disabled — see FR-2.2.
- **Server-side search or pagination.** v2 filters client-side over the full list and this feature matches that. The threshold at which that stops being acceptable is Q-10.
- **Multi-user or shared projects.** Projects are scoped to their owner, matching v2. Transferring ownership (v2 carries a `former_owner_ids` field) is not in scope.
- **A "Failed" status badge.** The design defines only three badges, and v3 has no signal that could produce a failure — see Q-4.
- **Changing v2's Projects page in any way.** v3 is standalone; this feature adds a v3 page and v3 endpoints and touches no v2 code.

## 6. Use cases

### UC-1: See every project I own

- **Actor:** Migration operator
- **Trigger:** The user navigates to the v3 projects route.
- **Preconditions:** The user is authenticated (a valid `app_token` exists).
- **Main flow:**
  1. The page requests the projects belonging to the caller's region and user id.
  2. While the request is in flight, the page shows placeholder cards in the grid.
  3. On success, the page renders one card per project, each showing the project name, a fixed source label, a status badge, and a last-modified date.
- **Postconditions / success state:** Every project matching the (region, owner) pair that is not soft-deleted is visible as exactly one card.
- **Alternate flows:**
  - There are no projects → the first-run empty state (UC-5).
  - The request fails → the error state (UC-6).
- **Priority:** P0

### UC-2: Find a project by name

- **Actor:** Migration operator
- **Trigger:** The user types into the search field, or arrives with a `search` query parameter in the URL.
- **Preconditions:** UC-1 has completed; at least one project is loaded.
- **Main flow:**
  1. The user types text into the search field.
  2. The page filters the already-loaded projects by case-insensitive substring match on the project name.
  3. The grid re-renders showing only matching projects.
- **Postconditions / success state:** Only projects whose name contains the search text appear. No network request is made.
- **Alternate flows:**
  - No project matches → the search-empty state (EC-2).
  - The user clears the search → the full list returns.
  - The user opens a project and navigates back → the search text is restored from the URL.
- **Priority:** P0

### UC-3: Resume an existing project

- **Actor:** Migration operator
- **Trigger:** The user activates a project card.
- **Preconditions:** UC-1 has completed; the card's project has a valid id.
- **Main flow:**
  1. The user clicks (or activates by keyboard) a project card.
  2. The page determines the furthest step that project has reached.
  3. The page navigates into the migration wizard at that step, for that project.
- **Postconditions / success state:** The wizard is showing the resumed project at its furthest reached step, and the wizard's own reads succeed with no query parameters supplied.
- **Alternate flows:**
  - The project has nothing persisted → the wizard opens at its first step.
- **Priority:** P0

### UC-4: Create a new project

- **Actor:** Migration operator
- **Trigger:** The user activates the "New Project" control, or the create control inside the first-run empty state.
- **Preconditions:** The user is authenticated.
- **Main flow:**
  1. A modal opens asking for a project name and an optional description.
  2. The user enters a name and submits.
  3. The project is created, owned by the user, in the user's region.
  4. Any wizard state left over from a previously open project is discarded.
  5. The page navigates into the migration wizard at its first step for the new project.
- **Postconditions / success state:** A new project exists with the supplied name, and the wizard is open on it at its first step.
- **Alternate flows:**
  - The user cancels → no project is created and the list is unchanged.
  - Creation fails → the modal stays open with an error (EC-5).
- **Priority:** P0

### UC-5: First run — there are no projects

- **Actor:** Migration operator
- **Trigger:** UC-1 completes and returns zero projects, with no search text active.
- **Preconditions:** The list request succeeded.
- **Main flow:**
  1. The page shows a first-run empty state explaining that no projects exist yet.
  2. The empty state offers a control to create the first project.
  3. Activating that control opens the same create modal as UC-4.
- **Postconditions / success state:** The user can create their first project without any other control being present.
- **Alternate flows:** None.
- **Priority:** P0

### UC-6: The project list fails to load

- **Actor:** Migration operator
- **Trigger:** The request in UC-1 fails (network error, server error, or an authorization failure other than 401).
- **Preconditions:** The user is authenticated.
- **Main flow:**
  1. The page stops showing placeholder cards.
  2. The page shows an error state stating that the projects could not be loaded.
  3. The error state offers a retry control.
  4. Activating retry re-issues the request.
- **Postconditions / success state:** The failure is visible and recoverable without a page reload; the failure is never rendered as an empty list.
- **Alternate flows:**
  - The failure is a 401 → the shared v3 API client clears the token and redirects to the login entry; this page renders no error of its own.
- **Priority:** P1

## 7. User flows (optional detail)

One flow spans more than one screen. All others are covered inline in §6.

**UC-4 (create) — screen by screen:**

1. Projects list → user activates "New Project" (header) or the create control in the first-run empty state.
2. Modal appears over the list. Two fields: name (required) and description (optional). Submit is disabled until the name is valid.
3. On submit, the modal enters a busy state and the submit control is not re-invocable.
4. On success, the modal closes, leftover wizard state is discarded, and the browser navigates to the wizard's first step for the new project.
5. On failure, the modal stays open, shows the error, and the fields keep the user's input.

The page-level layout and every visual state are specified in the design page named in §17. The requirements below transcribe the behavior and the load-bearing copy from that design; they do not restate its styling.

## 8. Functional requirements

### FR — Top bar

- **FR-1.1:** The page MUST render a top bar containing a product mark, the product name `Migrate to Contentstack`, and a user avatar. The design's top bar carries an organization block in place of the product name; with organization scoping removed there is nothing for that block to show, and matching the wizard chrome's app bar keeps the two surfaces reading as one product. This is a drafted deviation from the design — see Q-16.
- **FR-1.2:** The page MUST render a user avatar showing the authenticated user's initials, derived as the first character of the user's first name followed by the first character of the user's last name, uppercased. This matches how v2 renders the same avatar, so the two versions agree on the same screen.
- **FR-1.3:** The user's first name, last name and email MUST be obtained from a dedicated user endpoint. They MUST NOT be obtained by widening an endpoint that exists for another purpose.
- **FR-1.4:** When the user's names are not both present, the avatar MUST fall back in this exact order: (a) both names present → two initials; (b) only one name present → the first two characters of that name, uppercased; (c) no name but an email present → the first character of the email's local part, uppercased; (d) none of the above → a person icon.
- **FR-1.5:** The avatar MUST NOT render as an empty circle under any condition, because the design's avatar is a filled shape and an empty one reads as a failed image rather than a missing name.
- **FR-1.6:** This top bar MUST NOT reuse the wizard chrome's app bar component; the two are different bars serving different pages, even though they now show the same product name.

### FR — Title row

- **FR-2.1:** The page MUST render the literal heading `Migration Projects`.
- **FR-2.2:** The page MUST render the design's back control in a disabled state. It MUST NOT navigate anywhere, and it MUST be excluded from keyboard tab order.
- **FR-2.3:** The page MUST render a search field whose placeholder is the literal string `Search projects`.
- **FR-2.4:** The page MUST render a primary action whose label is the literal string `New Project`.
- **FR-2.5:** The `New Project` action MUST be a single control, not a dropdown or menu.
- **FR-2.6:** The `New Project` action MUST NOT be rendered when the project list has loaded successfully and contains zero projects; in that case the first-run empty state's own create control is the only create affordance (FR-8.4).
- **FR-2.7:** The `New Project` action MUST be rendered whenever the loaded project list contains one or more projects, including while a search is filtering all of them out of view.

### FR — Project list and grid

- **FR-3.1:** The page MUST request the project list once on mount, with no organization parameter of any kind.
- **FR-3.2:** Re-rendering the page for any reason MUST NOT re-issue the list request. The only paths that issue it are the initial mount and an explicit retry (FR-8.8).
- **FR-3.3:** The page MUST retain the unfiltered list separately from the filtered view, so that "no projects exist" and "no projects match the search" are distinguishable.
- **FR-3.4:** The grid MUST render exactly one card per project in the filtered view.
- **FR-3.5:** The grid MUST reflow the number of columns to the available width without a horizontal scrollbar appearing on the page body.
- **FR-3.6:** The page MUST NOT paginate; the full list is rendered at once.

### FR — Project card

- **FR-4.1:** Each card MUST render its project's name.
- **FR-4.2:** A project name too long to fit MUST be truncated visually only; the full name MUST remain present in the document so it stays selectable and copyable.
- **FR-4.3:** Each card MUST render the literal label `Source` above the literal value `Contentstack`. This value is fixed for every project in this feature, because every v3 project is a Contentstack-to-Contentstack migration.
- **FR-4.4:** Each card MUST render the literal label `Project Status` above a status badge (FR-5).
- **FR-4.5:** Each card MUST render, in its footer, a clock indicator and the project's last-modified time.
- **FR-4.6:** The last-modified time MUST be rendered as a relative description when the project was modified less than 7 days ago (for example `3 hours ago`, `2 days ago`, with singular and plural handled), and as an absolute date in `MMM D, YYYY` form (for example `May 15, 2026`) when it was modified 7 days ago or longer.
- **FR-4.7:** The entire card MUST be a single activatable control; there MUST NOT be separately clickable sub-regions within it.
- **FR-4.8:** Activating a card MUST navigate into the migration wizard for that project, at the step determined by FR-4.9.
- **FR-4.9:** The step a card opens MUST be the furthest step that project has reached, derived from the project's persisted documents: a persisted `destination` opens the Destination step; a persisted `source` whose export succeeded opens the Audit step; anything else opens the wizard's first step. See Q-2.
- **FR-4.10:** Activating a card whose project has no valid id MUST NOT navigate.
- **FR-4.11:** The navigation target MUST identify the project and the step and nothing else. It MUST NOT carry an organization, and the wizard's own reads MUST succeed from the project id alone.
- **FR-4.12:** Each card MUST be reachable and activatable by keyboard alone.

### FR — Status badge

- **FR-5.1:** The status badge MUST NOT read from a stored status field. It MUST be derived from the project's persisted documents on every render.
- **FR-5.2:** A project with neither a persisted `source` nor a persisted `destination` MUST render the literal badge text `Draft`.
- **FR-5.3:** A project with a persisted `source` or a persisted `destination`, and which has not completed a migration, MUST render the literal badge text `In Progress`.
- **FR-5.4:** Each badge MUST render an icon alongside its text, distinct per status.
- **FR-5.5:** The `Completed` badge MUST be implemented and MUST render the literal badge text `Completed` when a project has completed a migration. Because v3 has no migration-completion signal yet, no project can currently reach this state; the derivation MUST be written such that adding that signal later requires no change to the badge itself.
- **FR-5.6:** A project whose derived status cannot be determined MUST render the `Draft` badge rather than an empty or absent badge.

### FR — Search

- **FR-6.1:** Typing in the search field MUST filter the already-loaded list and MUST NOT issue a network request.
- **FR-6.2:** The filter MUST be a case-insensitive substring match against the project name only.
- **FR-6.3:** The initial value of the search field MUST be taken from the `search` query parameter of the current URL, with surrounding whitespace trimmed.
- **FR-6.4:** Clearing the search field MUST restore the full loaded list.
- **FR-6.5:** The search field MUST offer a visible control to clear its current value when it is non-empty.
- **FR-6.6:** A search consisting only of whitespace MUST be treated as an empty search.

### FR — Create project

- **FR-7.1:** Activating either create control MUST open a modal containing a name field and a description field.
- **FR-7.2:** The name field MUST be required.
- **FR-7.3:** The name field MUST reject a value longer than 200 characters.
- **FR-7.4:** The name field MUST reject a value whose first character is whitespace.
- **FR-7.5:** The description field MUST be optional.
- **FR-7.6:** The description field MUST reject a value longer than 255 characters.
- **FR-7.7:** The modal's submit control MUST be inoperative while the name is invalid.
- **FR-7.8:** Submitting MUST send only the name and the description. The project id, owner, region and timestamps MUST be assigned by the server and MUST NOT be accepted from the client.
- **FR-7.9:** A successful creation MUST discard any wizard state left over from a previously open project before navigating.
- **FR-7.10:** A successful creation MUST navigate into the migration wizard at its first step for the newly created project.
- **FR-7.11:** Cancelling the modal — via its cancel control, its close control, or its overlay — MUST create nothing and leave the list unchanged.
- **FR-7.12:** The submit control MUST NOT be able to start a second creation while a creation is in flight.
- **FR-7.13:** A failed creation MUST leave the modal open, show the failure, and preserve what the user typed.
- **FR-7.14:** The modal's visual treatment MUST follow the existing v3 modals (`CreateStackModal`, `DestRegionLoginModal`), because the design contains no modal for this flow. Flagged as Q-3.

### FR — Loading, empty and error states

- **FR-8.1:** While the project list request is in flight, the grid MUST render placeholder cards occupying the same grid position and approximate dimensions as real cards, so that the layout does not shift when real cards replace them.
- **FR-8.2:** The placeholder cards MUST NOT be activatable.
- **FR-8.3:** When the request succeeds with zero projects and no search text is active, the page MUST render a first-run empty state.
- **FR-8.4:** The first-run empty state MUST contain a control that opens the same create modal as `New Project`.
- **FR-8.5:** When a search is active and no project matches, the page MUST render a search-empty state whose heading is the literal string `No projects match your search` and whose body is the literal string `Try a different name or clear the search.`
- **FR-8.6:** The search-empty state MUST NOT be shown when the search field is empty, and the first-run empty state MUST NOT be shown when a search is active.
- **FR-8.7:** When the project list request fails, the page MUST render an error state containing a retry control, and MUST NOT render either empty state.
- **FR-8.8:** Activating retry MUST re-issue the project list request without a page reload.
- **FR-8.9:** The first-run empty state's copy and the placeholder cards' visual treatment are drafted by this feature because the design specifies neither. Both are flagged for design sign-off as Q-1.

### FR — Data and scoping

- **FR-9.1:** A project record MUST carry a human-readable name.
- **FR-9.2:** A project record MUST carry an optional description.
- **FR-9.3:** A project record MUST carry the Contentstack region it was created in.
- **FR-9.4:** A project record MUST carry the id of the user who owns it.
- **FR-9.5:** A project record MUST carry a soft-delete marker, and the list MUST exclude records whose marker is set.
- **FR-9.6:** The project list MUST return only records matching all three of: the caller's region, the caller's user id, and not soft-deleted.
- **FR-9.7:** A project record MUST NOT carry an organization field. Organization is not a property of a project (§5).
- **FR-9.8:** A project record MUST NOT carry a stored status field, because status is derived (FR-5.1).
- **FR-9.9:** Every project-list and project-create endpoint MUST require a valid session and MUST reject a request without one.
- **FR-9.10:** `name`, `region` and `owner` MUST be required fields on the project record, not optional ones. A record MUST NOT be creatable without all three, including when a project record is created as a side effect of persisting a source or a destination document.
- **FR-9.11:** Reading a single project MUST apply the same three-way scope as FR-9.6 — region, owner, and not soft-deleted. A project that fails the scope MUST NOT be readable by supplying its id directly.
- **FR-9.12:** A read that fails the FR-9.11 scope MUST be answered as "not found", never as "forbidden", so that the response does not confirm the existence of a project the caller is not entitled to see.
- **FR-9.13:** No v3 endpoint path MUST contain an organization segment. The project list and create endpoints, and the project-scoped source and destination endpoints, MUST all resolve from a project id alone.
- **FR-9.14:** Project records persisted before this feature exists have no `name`, `region` or `owner` and are therefore excluded by FR-9.6 and unreadable under FR-9.11. This is accepted: no backfill is performed, and the scope MUST NOT be relaxed to accommodate them. Such records remain in the store, inert and invisible, until deleted manually.

## 9. Non-functional requirements

- **NFR-1 (Performance):** With 200 projects loaded, typing a character in the search field MUST update the rendered grid within 100 ms, measured from keystroke to committed render, on a mid-range laptop.
- **NFR-2 (Performance):** The project list request MUST be issued at most once per page mount. Re-rendering the page for any other reason MUST NOT re-issue it.
- **NFR-3 (Security):** Every project endpoint MUST require a valid `app_token` and MUST derive the caller's user id and region from that token, never from the request body, path or query string.
- **NFR-4 (Security):** A project name and description are user-supplied strings rendered into the page; they MUST be rendered as text and MUST NOT be interpreted as markup.
- **NFR-5 (Accessibility):** All new interactive controls MUST be reachable and operable by keyboard alone, MUST expose an accessible name, and MUST show a visible focus indicator. Target: WCAG 2.1 AA.
- **NFR-6 (Accessibility):** The status badge MUST NOT convey its meaning by color alone; its text is the primary signal.
- **NFR-7 (Reliability):** A failed project list request MUST NOT be rendered as an empty list, and MUST be recoverable without a page reload.
- **NFR-8 (Compatibility):** The page MUST render correctly in the browsers already supported by the v3 UI. Exact versions: `TBD — Open Question` (Q-12).
- **NFR-9 (Observability):** Project creation MUST be logged with the new project id. The project name and description MUST NOT appear in logs, as they are customer-supplied content.

## 10. Data & entities

- **Entity: `V3Project` (existing, extended)** — the persisted v3 project record, today `{ id, org_id, source?, destination?, created_at, updated_at }` in `api/v3/models/types.ts`. This feature adds four **required** fields — `name` (human-readable), `region` (the Contentstack region the project was created in), `owner` (the id of the user who created and owns it), and `isDeleted` (soft-delete marker) — plus one optional field, `description`. Required rather than optional is deliberate (FR-9.10): optional fields are what allowed the existing nameless, ownerless record to be created as a side effect of a source write, and making them required is what prevents a recurrence. The existing `org_id` field is **removed**, not renamed (FR-9.7). No status field is added — status is derived (FR-5.1, FR-9.8). Lifecycle: created by the create action in UC-4; `updated_at` advances whenever the source or destination document is written; excluded from both listings and single reads once `isDeleted` is set.

- **Entity: user identity (read-through, not persisted by this feature)** — the authenticated user's first name, last name and email, used only for the top bar's avatar (FR-1.2–FR-1.5). Supplied by a dedicated user endpoint (FR-1.3, DEP-7). Not stored in any v3 record and not logged (NFR-9).

- **Entity: derived project status (not persisted)** — a value in {`Draft`, `In Progress`, `Completed`} computed per render from a project's persisted `source` and `destination` documents. Owned by the presentation layer; never stored, so it can never be stale. `Completed` is unreachable until a migration-completion signal exists (FR-5.5).

- **Entity: derived resume step (not persisted)** — the wizard step a project opens at, computed per render from the same two documents (FR-4.9). Never stored. This deliberately differs from v2, which stores a `current_step` number on the project record; see Q-2.

## 11. Acceptance criteria

### AC for UC-1

- **AC-1.1:**
  - **Given** the caller owns 3 projects in their region
  - **When** the projects page finishes loading
  - **Then** exactly 3 project cards are rendered, one per project
- **AC-1.2:**
  - **Given** the projects page has been requested and the response has not yet arrived
  - **When** the page renders
  - **Then** placeholder cards are visible, no real project card is visible, and no empty state is visible
- **AC-1.3:**
  - **Given** the store contains 4 of the caller's projects, one of which is soft-deleted
  - **When** the projects page finishes loading
  - **Then** exactly 3 project cards are rendered and the soft-deleted project is absent
- **AC-1.4:**
  - **Given** the store contains a project owned by a different user, and a project in a different region
  - **When** the projects page finishes loading
  - **Then** neither of those two projects is rendered
- **AC-1.5:**
  - **Given** a project named `Marketing stack sync`, last modified 10 days ago, with no persisted source and no persisted destination
  - **When** its card renders
  - **Then** the card shows the name `Marketing stack sync`, the label `Source` with the value `Contentstack`, the label `Project Status` with the badge text `Draft`, and an absolute date in `MMM D, YYYY` form
- **AC-1.6:**
  - **Given** a project last modified 3 hours ago
  - **When** its card renders
  - **Then** the footer reads `3 hours ago` and not an absolute date

### AC for UC-2

- **AC-2.1:**
  - **Given** the loaded list contains `Marketing stack sync`, `Docs stack copy` and `Blog content move`
  - **When** the user types `stack` into the search field
  - **Then** exactly 2 cards are rendered — `Marketing stack sync` and `Docs stack copy` — and no network request is issued
- **AC-2.2:**
  - **Given** the loaded list contains `Marketing stack sync`
  - **When** the user types `MARKETING` into the search field
  - **Then** the `Marketing stack sync` card is rendered, proving the match is case-insensitive
- **AC-2.3:**
  - **Given** a search for `stack` is filtering the list down to 2 of 3 projects
  - **When** the user clears the search field
  - **Then** all 3 cards are rendered again
- **AC-2.4:**
  - **Given** the page is opened at a URL whose query string contains `search=blog`
  - **When** the page finishes loading
  - **Then** the search field contains `blog` and the grid is filtered to matching projects only
- **AC-2.5:**
  - **Given** the loaded list contains 3 projects
  - **When** the user types `zzzz` into the search field
  - **Then** no cards are rendered, the heading `No projects match your search` is visible, and the first-run empty state is not visible

### AC for UC-3

- **AC-3.1:**
  - **Given** a project with id `P1` that has a persisted `destination`
  - **When** the user activates that project's card
  - **Then** the application navigates into the migration wizard for project `P1` at the Destination step
- **AC-3.2:**
  - **Given** a project with id `P2` that has neither a persisted source nor a persisted destination
  - **When** the user activates that project's card
  - **Then** the application navigates into the migration wizard for project `P2` at its first step
- **AC-3.3:**
  - **Given** a project with id `P3` that has a persisted `source` whose last export succeeded and no persisted `destination`
  - **When** the user activates that project's card
  - **Then** the application navigates into the migration wizard for project `P3` at the Audit step
- **AC-3.4:**
  - **Given** the current URL contains no query parameters
  - **When** the user activates a project card and the wizard mounts
  - **Then** the wizard's project-scoped reads are issued from the project id alone rather than being skipped, and the navigation target contains no organization segment or parameter
- **AC-3.5:**
  - **Given** a project card whose project has an empty id
  - **When** the user activates that card
  - **Then** no navigation occurs
- **AC-3.6:**
  - **Given** the projects page has rendered 3 cards
  - **When** the user moves focus with the keyboard to the second card and activates it with the Enter key
  - **Then** the same navigation occurs as for a pointer click on that card
- **AC-3.7:**
  - **Given** a project with id `P4` owned by a different user, whose id the caller has obtained
  - **When** the caller requests that project directly by its id rather than through the list
  - **Then** the response is "not found", it does not contain the project, and it does not indicate that the project exists
- **AC-3.8:**
  - **Given** a project with id `P5` owned by the caller but created in a different region from the caller's current session
  - **When** the caller requests that project directly by its id
  - **Then** the response is "not found", matching the fact that the list also excludes it

### AC for UC-4

- **AC-4.1:**
  - **Given** the projects page has loaded with at least one project
  - **When** the user activates the control labelled `New Project`
  - **Then** a modal opens containing a name field and a description field
- **AC-4.2:**
  - **Given** the create modal is open and the name field is empty
  - **When** the user attempts to submit
  - **Then** no create request is issued and the modal stays open
- **AC-4.3:**
  - **Given** the create modal is open
  - **When** the user enters a 201-character name
  - **Then** the name is rejected, a validation message is shown, and no create request is issued
- **AC-4.4:**
  - **Given** the create modal is open
  - **When** the user enters the name ` Leading space`
  - **Then** the name is rejected and no create request is issued
- **AC-4.5:**
  - **Given** the create modal is open
  - **When** the user enters a 256-character description alongside a valid name
  - **Then** the description is rejected and no create request is issued
- **AC-4.6:**
  - **Given** the create modal is open with the name `EU region migration` and no description
  - **When** the user submits and the server responds with the created project
  - **Then** the create request body contains only the name and the description, and contains no project id, owner or region
- **AC-4.7:**
  - **Given** a create request has succeeded for a new project with id `P9`
  - **When** the modal closes
  - **Then** leftover wizard state from any previously open project has been discarded, and the application navigates into the migration wizard for project `P9` at its first step
- **AC-4.8:**
  - **Given** the create modal is open with a valid name entered
  - **When** the user cancels the modal
  - **Then** no create request is issued and the project list is unchanged
- **AC-4.9:**
  - **Given** the create modal is open with a valid name and a create request is in flight
  - **When** the user activates the submit control a second time
  - **Then** exactly one create request has been issued in total
- **AC-4.10:**
  - **Given** the create modal is open with the name `EU region migration`
  - **When** the create request fails
  - **Then** the modal remains open, the failure is shown, and the name field still contains `EU region migration`

### AC for UC-5

- **AC-5.1:**
  - **Given** the caller owns zero projects
  - **When** the project list request succeeds
  - **Then** the first-run empty state is visible and the search-empty state is not
- **AC-5.2:**
  - **Given** the first-run empty state is visible
  - **When** the top bar and title row render
  - **Then** no control labelled `New Project` is present
- **AC-5.3:**
  - **Given** the first-run empty state is visible
  - **When** the user activates its create control
  - **Then** the same create modal as UC-4 opens
- **AC-5.4:**
  - **Given** the caller owns one project
  - **When** the project list request succeeds
  - **Then** the control labelled `New Project` is present and the first-run empty state is not

### AC for UC-6

- **AC-6.1:**
  - **Given** the project list request fails with a 500 response
  - **When** the page settles
  - **Then** an error state with a retry control is visible, no placeholder cards remain, and neither empty state is visible
- **AC-6.2:**
  - **Given** the error state is visible after a failed request
  - **When** the user activates retry and the retried request succeeds with 2 projects
  - **Then** 2 project cards are rendered and the error state is gone, with no page reload having occurred
- **AC-6.3:**
  - **Given** the project list request fails with a 401 response
  - **When** the page settles
  - **Then** this page renders no error state of its own, because the shared v3 API client has cleared the session and redirected to the login entry

## 12. Edge cases & error scenarios

- **EC-1:** The caller owns zero projects → the first-run empty state (FR-8.3), never a bare grid and never the search-empty state.
- **EC-2:** A search matches no project → the search-empty state with the heading `No projects match your search` and the body `Try a different name or clear the search.` (FR-8.5).
- **EC-3:** A search consisting only of whitespace → treated as an empty search; the full list is shown, not the search-empty state (FR-6.6).
- **EC-4:** The project list request fails (network, 500, timeout) → the error state with retry (FR-8.7). A failure is never rendered as an empty list.
- **EC-5:** The create request fails → the modal stays open, shows the failure, and preserves the user's input (FR-7.13).
- **EC-6:** The create request fails with a name conflict → behavior depends on whether duplicate names are permitted at all, which is Q-13.
- **EC-7:** The session expires and any request returns 401 → the shared v3 API client clears the token and redirects to the login entry; this page shows no error of its own (AC-6.3).
- **EC-8:** A project record has no name, no region or no owner (true of records persisted before this feature) → the record is excluded from the list by FR-9.6 and is not readable by id under FR-9.11, so no card is rendered for it and the card never has to handle an empty heading. The scope MUST NOT be relaxed to make such a record visible (FR-9.14).
- **EC-9:** A project is requested by id and fails the three-way scope of FR-9.11 — wrong owner, wrong region, or soft-deleted → answered as "not found", never as "forbidden" (FR-9.12, AC-3.7, AC-3.8).
- **EC-10:** A project name is longer than the card width → truncated visually only, with the full name kept in the document (FR-4.2).
- **EC-11:** A project name contains characters that are meaningful in markup → rendered as literal text, never interpreted (NFR-4).
- **EC-12:** A project's derived status cannot be determined → the `Draft` badge, never an empty badge (FR-5.6).
- **EC-13:** The user submits the create modal twice in rapid succession → exactly one project is created (FR-7.12, AC-4.9).
- **EC-14:** A project was created in a region other than the caller's current session region → excluded from the list and unreadable by id (FR-9.6, FR-9.11). This is the specific reason the region filter is required: a Contentstack session is region-scoped, so a project from another region could not be operated on even if it were visible.
- **EC-15:** The store contains many projects (for example 500) → the full list is rendered without pagination (FR-3.6); the point at which that becomes unacceptable is Q-10.
- **EC-16:** The authenticated user has a first name but no last name → the avatar renders the first two characters of the first name, uppercased (FR-1.4 clause b).
- **EC-17:** The authenticated user has neither a first nor a last name, which is common for SSO-provisioned Contentstack users → the avatar renders the first character of the email's local part, uppercased (FR-1.4 clause c).
- **EC-18:** The authenticated user has no name and no email → the avatar renders a person icon, never an empty circle (FR-1.4 clause d, FR-1.5).
- **EC-19:** The user endpoint (DEP-7) fails or is unavailable → the avatar falls back through FR-1.4 to the person icon, and the project list still loads, because the two are independent requests.

## 13. Dependencies & integrations

- **DEP-1:** `migration-wizard-chrome` — this page navigates into the wizard, and the resume step in FR-4.9 is expressed in that feature's step vocabulary. Read-only dependency on its step definitions; contract owner is `migration-wizard-chrome`. Its open question TQ-2 (`orgId` arriving via `?orgId=`) is closed by FR-9.13 removing the segment entirely, making this dependency bidirectional.
- **DEP-2:** `cs-source-selection` — supplies the persisted `source` document that FR-4.9 and FR-5.2/FR-5.3 read to derive the resume step and the status badge. **Bidirectional and breaking:** its project-scoped persistence endpoints lose their `/org/:orgId` segment under FR-9.13, so its service, its callers and its tests change in step. Contract owner is `cs-source-selection`.
- **DEP-3:** `cs-destination-selection` — supplies the persisted `destination` document read for the same two derivations. **Bidirectional and breaking** for the same reason as DEP-2: its persistence endpoints lose the organization segment, and the `orgId` prop threaded into its panel disappears.
- **DEP-4:** The v3 project store (`api/v3/models/project.store.ts`) — must gain a list capability and a create capability, and its single read must gain the three-way scope. Blocking: no part of this feature works without them.
- **DEP-5:** The v3 project type (`api/v3/models/types.ts`) — must gain the fields in §10 and lose `org_id`. Blocking.
- **DEP-6:** The shared v3 API client (`ui/v3/auth/apiClient.ts`) — supplies session handling and the 401 redirect this page relies on rather than implementing its own (AC-6.3). Read-only.
- **DEP-7:** A dedicated v3 user endpoint — required by FR-1.2–FR-1.5. The v3 session payload carries only a user id, a region and an SSO flag, so the session is not a source for the user's display name. New to this feature; no other feature depends on it, and it replaces the previous revision's approach of widening the organizations endpoint (Q-5).

## 14. Assumptions & constraints

- **A-1:** Every project listed on this page is a Contentstack → Contentstack migration, which is why the card's source value is the fixed string `Contentstack` (FR-4.3) rather than a data-driven value as it is in v2.
- **A-2:** The number of projects one user owns is small enough to render at once and filter in the browser. See Q-10.
- **A-3:** A project's `updated_at` already advances whenever its source or destination document is written, so the card's last-modified time is meaningful without any new write path.
- **A-4:** A user operates in one Contentstack region per session, so scoping projects by the session's region does not hide work the user could otherwise act on. A project created in another region could not be operated on from this session anyway (EC-14).
- **C-1:** v3 is standalone. This feature MUST NOT import from `api/src` or `ui/src`, and MUST NOT modify v2's Projects page, its endpoints or its data. The only shared items remain the `app_token` secret and the shared auth store.
- **C-2:** v3 uses no component library. This page MUST be built from plain markup and the design tokens in `ui/v3/styles/theme.css`, not from `@contentstack/venus-components` as v2's page is.
- **C-3:** v3 hardcodes its copy. Unlike v2's Projects page, which fetches its strings from Contentstack entries, every string on this page is defined in the code and MUST match the design verbatim where the design specifies one.
- **C-4:** The design specifies no loading state, no first-run empty state, no error state, no modal, and no hover values for the card, and its top bar assumes an organization block this revision removes. Those are drafted by this feature and flagged (Q-1, Q-3, Q-15, Q-16) rather than treated as settled design.
- **C-5:** Status cannot express `Completed` or `Failed` today, because v3 has no migration step and therefore no completion or failure signal.

## 15. Risks

- **R-1:** Only two of the design's three badges are reachable — every project reads either `Draft` or `In Progress`, and a stalled or abandoned project is indistinguishable from an active one. Likelihood: certain. Impact: medium. Mitigation: accept for this release as a consequence of the derived-status decision; FR-5.5 requires the `Completed` path be implemented so adding the signal later is not a rework.
- **R-2:** Removing the `/org/:orgId` segment (FR-9.13) changes route contracts owned by `cs-source-selection` and `cs-destination-selection`, so two already-shipped features change alongside this one — three services, five call sites, the `orgId` prop threaded through the Destination panel, and four pre-existing test files. Likelihood: certain. Impact: medium. Mitigation: those features' existing suites are the acceptance signal; the change is mechanical (a URL loses a segment, so its builders lose a parameter) and touches no behaviour of either panel. Alternative rejected: keeping the segment on those routes only, which would leave two route shapes in one API disagreeing about whether a project belongs to an organization, and would keep TQ-2 open.
- **R-3:** Adding `region` and `owner` to the project record and filtering on them (FR-9.6, FR-9.11) makes every project persisted before this feature invisible, because those records have neither field. Likelihood: certain. Impact: verified low — the store contains exactly one such record (`demo-project`, one source with a graph, no destination, no customer data), and recreating it is a single export run. Mitigation: accepted rather than mitigated (FR-9.14). Explicitly rejected alternatives: a backfill, which cannot produce a truthful `owner` and would have to invent one; and treating a missing `region`/`owner` as matching any value, which would permanently weaken a security filter to accommodate one development record and leave every future reader unsure whether the leniency is load-bearing.
- **R-4:** Nothing in v3 can delete a project, and this page deliberately does not add it. The list therefore only grows, and a mistaken project stays forever. Likelihood: certain. Impact: low now, rising with use. Mitigation: Q-6.
- **R-5:** Client-side search over an unpaginated list degrades as project counts grow, and the degradation is invisible until it is severe. Likelihood: low near-term. Impact: medium. Mitigation: NFR-1 sets a measurable bar at 200 projects; Q-10 sets the revisit trigger.
- **R-6:** The first-run empty state and the loading placeholders are authored here without design review, and the first-run state is what every new user sees first. Likelihood: certain. Impact: medium. Mitigation: both flagged as Q-1 for sign-off before release, not before implementation.
- **R-7:** The design's disabled back control (FR-2.2) ships a permanently dead affordance, which users may read as a bug. Likelihood: medium. Impact: low. Mitigation: confirmed decision; revisit when a path-chooser page exists.
- **R-8:** The top bar now differs from the design, because the design's organization block has nothing to show (FR-1.1). Likelihood: certain. Impact: low. Mitigation: the substitute matches the wizard chrome's app bar rather than being invented, and it is flagged for design review as Q-16.

## 16. Open questions

Numbering is stable across the 2026-08-05 revision — resolved and superseded entries keep their original numbers because they are decision history and the PRD and TRD cite them by number.

- **Q-1:** What is the exact copy for the first-run empty state ("you have no projects yet"), and what is the intended visual treatment of the loading placeholder cards? Both are drafted by this feature because the design specifies neither (FR-8.9, C-4, R-6) — owner: design — needed by: release.
- **Q-2:** Should the resume step be derived from the persisted documents as specified in FR-4.9, or stored on the project record as v2 does with `current_step`? Deriving matches the status decision and needs no new field, but it cannot represent a step the user visited without persisting anything — owner: Chirag Chavan — needed by: TRD.
- **Q-3:** The design contains no create-project modal. Is following the existing v3 modals (`CreateStackModal`, `DestRegionLoginModal`) acceptable, or is a dedicated design needed (FR-7.14)? — owner: design — needed by: implementation.
- **Q-4:** The design defines no `Failed` badge, but a migration can fail. What should a failed project look like once v3 has a migration step? — owner: design — needed by: whenever the Migrate step is specified.
- **Q-5: RE-RESOLVED (2026-08-05).** What should the top bar's avatar show, given that the v3 session payload carries only a user id, a region and an SSO flag and no personal name? **Decision:** a dedicated `GET /v3/user` endpoint returning the user's first name, last name and email; the avatar derives its initials from those, falling back two initials → two characters of whichever single name exists → first character of the email's local part → a person icon, never an empty circle. **This reverses the 2026-08-04 resolution**, which widened the organizations endpoint's response instead. That decision rested entirely on the organization control needing that call anyway, so the name came free; with the control removed nothing calls it, and fetching a list of organizations solely to discard it would be worse than a small dedicated endpoint. Reverting the widening also removes a breaking change to `cs-destination-selection`. Captured as FR-1.2–FR-1.5, EC-16–EC-19, DEP-7.
- **Q-6:** Where does a v3 project get deleted, given that this page deliberately has no delete and v3 has no Settings panel? Should this feature add the soft-delete field only (FR-9.5) and leave the action for later? — owner: Chirag Chavan — needed by: release.
- **Q-7: RESOLVED (2026-08-04).** How should project records persisted before this feature be handled, given that they have no `name`, `region` or `owner` and FR-9.6 would hide them? **Decision:** accept the loss. No backfill, and the scope is not relaxed. Verified scale: the store (`api/database-v3/projects.json`) contains exactly one such record — `demo-project`, one stack-mode source with a graph, no destination, no customer data — and recreating it is a single export run. The record stays in the file, inert and invisible, until deleted manually; nothing needs to be deleted for this feature to work. Two alternatives were rejected: a **backfill**, because it cannot produce a truthful `owner` (there is nothing to derive one from) and would have to guess `region` from the source stack's region, which is a different thing that only coincidentally matches; and a **wildcard match** on missing fields, because it permanently weakens a security filter to accommodate one development record and leaves every future reader unable to tell whether the leniency is load-bearing. To prevent recurrence, `name`, `region` and `owner` are **required** on the record rather than optional — optionality is what allowed a source write to create a nameless, ownerless project as a side effect. Captured as FR-9.10, FR-9.14, EC-8, R-3.
- **Q-8: RESOLVED (2026-08-04).** Should a single-project read be scoped the same way the list is? **Decision:** yes. `getV3Project` currently takes only a project id and applies no scope at all, so filtering the list alone would leave the URL as a bypass — the list would merely stop advertising projects the caller cannot see. Single reads now apply the same scope and answer "not found" rather than "forbidden", so a response never confirms the existence of a project the caller is not entitled to. Captured as FR-9.11, FR-9.12, AC-3.7, AC-3.8, EC-9. *Simplified by the 2026-08-05 revision: the scope is now three-way rather than four-way, which also removed the owner-and-region-only read variant that existed solely because one route carried no organization segment.*
- **Q-9: SUPERSEDED (2026-08-05).** The project record's organization field is persisted as `org_id` while every other field in the v3 model is camel case; should it be renamed to `orgId`? **No longer applicable:** the field is removed entirely rather than renamed (FR-9.7), so there is nothing to rename. Retained for history because the previous revision's FR-9.12 and the earlier test matrix cite it.
- **Q-10:** At what project count do client-side search and an unpaginated grid stop being acceptable, and what happens at that point (A-2, R-5, EC-15)? — owner: Chirag Chavan — needed by: post-launch.
- **Q-11:** What are the post-launch success metrics and their thresholds for G-5? — owner: product — needed by: PRD.
- **Q-12:** Which exact browsers and versions must this page support (NFR-8)? — owner: Chirag Chavan — needed by: release.
- **Q-13:** Are duplicate project names permitted for one user? v2 does not appear to prevent them. If they are prevented, the conflict needs user-visible copy (EC-6) — owner: Chirag Chavan — needed by: implementation.
- **Q-14: SUPERSEDED (2026-08-05).** What should this page show when the authenticated user belongs to no Contentstack organizations at all? **No longer applicable:** the page no longer reads the user's organizations, so belonging to none has no effect on it. Retained for history because the previous revision's EC-8 cites it.
- **Q-15:** The design declares `transition: border-color .15s, box-shadow .15s, transform .15s` on the project card but specifies no hover values. What are the card's hover border, shadow and transform? The sibling design's selected-card treatment is `border-color: --brand-strong`, `box-shadow: 0 0 0 3px var(--ring-focus), var(--shadow-lg)`, `transform: translateY(-2px)` — owner: design — needed by: implementation.
- **Q-16:** The design's top bar is built around an organization block that this revision removes. FR-1.1 substitutes the product name `Migrate to Contentstack`, matching the wizard chrome's app bar. Is that the right substitute, or should the bar be restructured — or dropped in favour of starting the page at the title row? — owner: design — needed by: release.

## 17. Out-of-band references

- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"CS to CS Dashboard"** — the page this feature implements: top bar and avatar, title row (back control, heading, search, `New Project`), the project card grid, the three status badges, and the search-empty state. Its top bar's organization block is deliberately not implemented (FR-1.1, Q-16). Read via the DesignSync connector; not mirrored into this repository.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Choose Migration Path"** — the page the design's back control points at, and the source of the dark-theme token values referenced in §5 and Q-15. Not implemented by this feature.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Content Map and Audit"** — the design behind the already-built Source and Destination panels and the wizard chrome, cited here only because this page navigates into it.
- `docs/features/migration-wizard-chrome/feature.md` and `trd.md` — the wizard this page navigates into; `trd.md` TQ-2 is the `?orgId=` question closed by FR-9.13.
- `docs/features/cs-source-selection/feature.md` — owner of the persisted `source` document read by FR-4.9 and FR-5.3, and of the persistence routes changed by FR-9.13.
- `docs/features/cs-destination-selection/feature.md` — owner of the persisted `destination` document read by FR-4.9 and FR-5.3, and of the persistence routes changed by FR-9.13.
- `ui/src/pages/Projects/index.tsx`, `ui/src/components/ProjectsHeader/index.tsx`, `ui/src/components/Card/index.tsx`, `api/src/services/projects.service.ts` — the v2 implementation whose functionality this feature reproduces. Note that v2 DOES scope projects by organization; this feature deliberately does not (§5). Reference only; v3 imports nothing from v2 (C-1).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
